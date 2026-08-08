import { beforeEach, describe, expect, it } from 'vitest';

import { defaultOptions, type HistoryEntry } from '../domain/index.ts';
import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  loadHistory,
  makeEntryId,
  saveHistory,
} from './storage.ts';

/** jsdom 없이 돌리려고 최소한의 localStorage 를 흉내낸다. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
  return store;
}

function entry(seed: number): HistoryEntry {
  return {
    id: `id-${seed}`,
    result: {
      games: [{ label: 'A', numbers: [1, 2, 3, 4, 5, 6] }],
      seed,
      createdAt: seed,
      options: defaultOptions(),
    },
  };
}

let store: Map<string, string>;

beforeEach(() => {
  store = installStorage();
});

describe('저장 · 읽기', () => {
  it('한 바퀴 돌려도 그대로다', () => {
    saveHistory([entry(1), entry(2)]);
    expect(loadHistory().map((e) => e.result.seed)).toEqual([1, 2]);
  });

  it('키는 하나만 쓴다', () => {
    saveHistory([entry(1)]);
    expect([...store.keys()]).toEqual([HISTORY_KEY]);
  });

  it(`${HISTORY_LIMIT}건을 넘으면 앞에서부터만 남긴다`, () => {
    const many = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => entry(i));
    saveHistory(many);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(HISTORY_LIMIT);
    expect(loaded[0].result.seed).toBe(0);
  });
});

describe('깨진 데이터는 조용히 버린다', () => {
  it('JSON 이 아니면 빈 목록', () => {
    store.set(HISTORY_KEY, '{{{');
    expect(loadHistory()).toEqual([]);
  });

  it('배열이 아니면 빈 목록', () => {
    store.set(HISTORY_KEY, '{"nope":1}');
    expect(loadHistory()).toEqual([]);
  });

  it('모양이 어긋난 항목만 골라 버린다', () => {
    store.set(
      HISTORY_KEY,
      JSON.stringify([
        entry(1),
        { id: 'x' }, // result 없음
        { id: 'y', result: { games: 'nope', seed: 1, createdAt: 1, options: {} } },
        null,
        entry(2),
      ]),
    );
    expect(loadHistory().map((e) => e.result.seed)).toEqual([1, 2]);
  });

  it('저장된 값이 없으면 빈 목록', () => {
    expect(loadHistory()).toEqual([]);
  });
});

describe('localStorage 를 못 쓰는 환경', () => {
  it('setItem 이 던져도 앱이 죽지 않는다', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    });
    expect(() => saveHistory([entry(1)])).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });
});

describe('makeEntryId', () => {
  it('같은 시각·시드라도 서로 다른 id 를 만든다 (crypto 있는 환경)', () => {
    const a = makeEntryId(1, 100);
    const b = makeEntryId(1, 100);
    expect(a).not.toBe(b);
  });
});
