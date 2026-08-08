import { create } from 'zustand';

import {
  DEFAULT_MAX_CONSECUTIVE,
  MAX_INCLUDE,
  defaultOptions,
  drawGames,
  latestDraw,
  type Ball,
  type DrawFailureReason,
  type DrawOptions,
  type DrawResult,
  type HistoryEntry,
  type OfficialDraw,
} from '../domain/index.ts';
import { loadOfficialDraws } from '../lib/draws.ts';
import { randomSeed } from '../lib/seed.ts';
import {
  HISTORY_LIMIT,
  loadHistory,
  makeEntryId,
  saveHistory,
} from '../lib/storage.ts';

export type TabId = 'draw' | 'filter' | 'history' | 'win';

/**
 * 당첨 번호 데이터 상태.
 * unavailable = 파일이 아직 배포되지 않았거나 비어 있음. 이때도 추첨은 정상 동작한다.
 */
export type DrawsStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** 번호 그리드에서 한 번호가 가질 수 있는 상태. */
export type BallState = 'none' | 'include' | 'exclude';

interface LottoState {
  tab: TabId;
  options: DrawOptions;
  result: DrawResult | null;
  /** 마지막 추첨 실패 사유. 성공하면 null 로 지워진다. */
  failure: DrawFailureReason | null;
  /** 안내 문구(고정수 5개 초과 등). 도메인 실패와 구분한다. */
  notice: string | null;
  history: HistoryEntry[];

  /** 실제 회차 당첨 번호 (Phase 2). 정적 파일에서 한 번만 읽는다. */
  draws: OfficialDraw[];
  drawsStatus: DrawsStatus;
  /** 당첨 탭에서 보고 있는 회차. */
  selectedRound: number | null;

  setTab: (tab: TabId) => void;
  setGameCount: (count: number) => void;
  cycleBall: (ball: Ball) => void;
  clearBallSelection: () => void;
  setOddEvenBalance: (value: boolean) => void;
  setSumRange: (range: [number, number] | null) => void;
  setMaxConsecutive: (value: number) => void;
  resetFilters: () => void;

  draw: () => void;
  drawWithSeed: (seed: number) => void;
  dismissNotice: () => void;

  restore: (entry: HistoryEntry) => void;
  removeHistoryEntry: (id: string) => void;
  clearHistory: () => void;

  loadDrawData: () => Promise<void>;
  setSelectedRound: (round: number) => void;
}

/**
 * 두 옵션이 추첨 결과에 같은 영향을 주는지 비교한다.
 * 도메인에서 정규화된 옵션끼리만 비교하므로 순서 차이는 이미 사라진 상태다.
 */
function sameOptions(a: DrawOptions, b: DrawOptions): boolean {
  return (
    a.gameCount === b.gameCount &&
    a.oddEvenBalance === b.oddEvenBalance &&
    a.maxConsecutive === b.maxConsecutive &&
    a.include.join(',') === b.include.join(',') &&
    a.exclude.join(',') === b.exclude.join(',') &&
    String(a.sumRange) === String(b.sumRange)
  );
}

function ballStateOf(options: DrawOptions, ball: Ball): BallState {
  if (options.include.includes(ball)) return 'include';
  if (options.exclude.includes(ball)) return 'exclude';
  return 'none';
}

export const useLottoStore = create<LottoState>()((set, get) => ({
  tab: 'draw',
  options: defaultOptions(),
  result: null,
  failure: null,
  notice: null,
  history: loadHistory(),

  draws: [],
  drawsStatus: 'idle',
  selectedRound: null,

  setTab: (tab) => set({ tab }),

  setGameCount: (count) =>
    set((state) => ({
      options: { ...state.options, gameCount: count },
    })),

  /**
   * 지정 없음 → 고정수 → 제외수 → 지정 없음 순으로 순환한다.
   * 고정수가 이미 5개면 고정수 단계를 건너뛰고 제외수로 간다.
   */
  cycleBall: (ball) =>
    set((state) => {
      const { options } = state;
      const current = ballStateOf(options, ball);

      if (current === 'include') {
        return {
          options: {
            ...options,
            include: options.include.filter((n) => n !== ball),
            exclude: [...options.exclude, ball],
          },
          notice: null,
        };
      }

      if (current === 'exclude') {
        return {
          options: {
            ...options,
            exclude: options.exclude.filter((n) => n !== ball),
          },
          notice: null,
        };
      }

      if (options.include.length >= MAX_INCLUDE) {
        return {
          options: { ...options, exclude: [...options.exclude, ball] },
          notice: `고정수는 ${MAX_INCLUDE}개까지예요. ${ball}번은 제외수로 넣었어요.`,
        };
      }

      return {
        options: { ...options, include: [...options.include, ball] },
        notice: null,
      };
    }),

  clearBallSelection: () =>
    set((state) => ({
      options: { ...state.options, include: [], exclude: [] },
      notice: null,
    })),

  setOddEvenBalance: (value) =>
    set((state) => ({
      options: { ...state.options, oddEvenBalance: value },
    })),

  setSumRange: (range) =>
    set((state) => ({ options: { ...state.options, sumRange: range } })),

  setMaxConsecutive: (value) =>
    set((state) => ({
      options: { ...state.options, maxConsecutive: value },
    })),

  resetFilters: () =>
    set((state) => ({
      options: { ...defaultOptions(), gameCount: state.options.gameCount },
      failure: null,
      notice: null,
    })),

  draw: () => get().drawWithSeed(randomSeed()),

  drawWithSeed: (seed) => {
    const { options, history } = get();
    const outcome = drawGames(seed, options);

    if (!outcome.ok) {
      set({ failure: outcome.reason, result: null });
      return;
    }

    // 시드로 재현했을 때 같은 결과가 이력에 겹겹이 쌓이지 않게 막는다.
    const previous = history[0];
    const isRepeat =
      previous !== undefined &&
      previous.result.seed === outcome.result.seed &&
      sameOptions(previous.result.options, outcome.result.options);

    const entry: HistoryEntry = {
      id: makeEntryId(outcome.result.seed, outcome.result.createdAt),
      result: outcome.result,
    };

    set({
      result: outcome.result,
      failure: null,
      // 옵션도 정규화된 형태로 되돌려 UI 표시와 저장된 결과를 일치시킨다.
      options: outcome.result.options,
      history: isRepeat ? history : [entry, ...history].slice(0, HISTORY_LIMIT),
    });
    saveHistory(get().history);
  },

  dismissNotice: () => set({ notice: null }),

  /** 이력의 한 건을 현재 결과로 되돌린다. 옵션까지 함께 복원한다. */
  restore: (entry) =>
    set({
      result: entry.result,
      // 예전 스키마로 저장된 이력이 있어도 빠진 필드는 기본값으로 메운다.
      options: { ...defaultOptions(), ...entry.result.options },
      failure: null,
      notice: null,
      tab: 'draw',
    }),

  removeHistoryEntry: (id) => {
    set((state) => ({ history: state.history.filter((e) => e.id !== id) }));
    saveHistory(get().history);
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistory([]);
  },

  /**
   * 당첨 번호 데이터를 읽는다. 당첨 탭을 처음 열 때만 호출된다.
   * 실패해도 앱의 다른 기능에는 영향이 없다.
   */
  loadDrawData: async () => {
    const status = get().drawsStatus;
    if (status === 'loading' || status === 'ready') return;

    set({ drawsStatus: 'loading' });
    const outcome = await loadOfficialDraws();

    if (!outcome.ok) {
      set({ drawsStatus: 'unavailable' });
      return;
    }

    set({
      draws: outcome.draws,
      drawsStatus: 'ready',
      selectedRound: latestDraw(outcome.draws)?.round ?? null,
    });
  },

  setSelectedRound: (round) => set({ selectedRound: round }),
}));

export { ballStateOf, DEFAULT_MAX_CONSECUTIVE };
