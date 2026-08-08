import { describe, expect, it } from 'vitest';

import {
  createRng,
  defaultOptions,
  drawGames,
  hasOddEvenBalance,
  longestConsecutiveRun,
  next,
  normalizeOptions,
  sum,
  validateOptions,
  type DrawOptions,
} from './index.ts';

function options(patch: Partial<DrawOptions> = {}): DrawOptions {
  return { ...defaultOptions(), gameCount: 1, ...patch };
}

describe('rng', () => {
  it('같은 seed 는 같은 수열을 만든다', () => {
    const run = (seed: number) => {
      let s = createRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const [v, nextState] = next(s);
        s = nextState;
        out.push(v);
      }
      return out;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('0 이상 1 미만의 값을 만든다', () => {
    let s = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const [v, nextState] = next(s);
      s = nextState;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('상태를 넘기지 않으면 같은 값이 반복된다 (순수성)', () => {
    const s = createRng(99);
    expect(next(s)).toEqual(next(s));
  });
});

describe('filter helpers', () => {
  it('연속 구간 길이를 센다', () => {
    expect(longestConsecutiveRun([3, 4, 5, 10, 20, 21])).toBe(3);
    expect(longestConsecutiveRun([1, 3, 5, 7, 9, 11])).toBe(1);
    expect(longestConsecutiveRun([])).toBe(0);
  });

  it('홀짝 균형은 양쪽 최소 2개를 요구한다', () => {
    expect(hasOddEvenBalance([1, 3, 5, 2, 4, 6])).toBe(true);
    expect(hasOddEvenBalance([1, 3, 5, 7, 9, 2])).toBe(false);
    expect(hasOddEvenBalance([1, 3, 5, 7, 2, 4])).toBe(true);
  });

  it('옵션 정규화는 입력 순서를 지운다', () => {
    const a = normalizeOptions(options({ include: [7, 3, 3], exclude: [9, 1] }));
    const b = normalizeOptions(options({ include: [3, 7], exclude: [1, 9] }));
    expect(a).toEqual(b);
    expect(a.include).toEqual([3, 7]);
  });
});

describe('validateOptions', () => {
  it('게임 수 범위를 검사한다', () => {
    expect(validateOptions(options({ gameCount: 0 }))).toBe(
      'INVALID_GAME_COUNT',
    );
    expect(validateOptions(options({ gameCount: 6 }))).toBe(
      'INVALID_GAME_COUNT',
    );
    expect(validateOptions(options({ gameCount: 3 }))).toBeNull();
  });

  it('고정수는 5개까지', () => {
    expect(
      validateOptions(options({ include: [1, 2, 3, 4, 5, 6] })),
    ).toBe('TOO_MANY_INCLUDE');
  });

  it('고정수와 제외수는 겹칠 수 없다', () => {
    expect(validateOptions(options({ include: [7], exclude: [7] }))).toBe(
      'INCLUDE_EXCLUDE_OVERLAP',
    );
  });

  it('남은 후보가 6개 미만이면 거부한다', () => {
    const exclude = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(validateOptions(options({ exclude }))).toBe('NOT_ENOUGH_CANDIDATES');
  });

  it('잘못된 번호를 거부한다', () => {
    expect(validateOptions(options({ include: [46] }))).toBe('INVALID_BALL');
    expect(validateOptions(options({ exclude: [0] }))).toBe('INVALID_BALL');
    expect(validateOptions(options({ include: [1.5] }))).toBe('INVALID_BALL');
  });

  it('뒤집힌 합계 범위를 거부한다', () => {
    expect(validateOptions(options({ sumRange: [180, 100] }))).toBe(
      'INVALID_SUM_RANGE',
    );
    expect(validateOptions(options({ sumRange: [1, 20] }))).toBe(
      'INVALID_SUM_RANGE',
    );
  });
});

describe('drawGames', () => {
  it('요청한 개수만큼 A~E 라벨로 뽑는다', () => {
    const outcome = drawGames(1234, options({ gameCount: 5 }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.games.map((g) => g.label)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
  });

  it('각 게임은 서로 다른 6개 번호를 오름차순으로 담는다', () => {
    const outcome = drawGames(777, options({ gameCount: 5 }));
    if (!outcome.ok) throw new Error('draw failed');
    for (const game of outcome.result.games) {
      expect(game.numbers).toHaveLength(6);
      expect(new Set(game.numbers).size).toBe(6);
      expect(game.numbers).toEqual([...game.numbers].sort((a, b) => a - b));
      for (const n of game.numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });

  it('같은 seed + 같은 options 는 같은 결과를 만든다', () => {
    const opts = options({
      gameCount: 5,
      include: [7],
      exclude: [13],
      oddEvenBalance: true,
      sumRange: [100, 175],
      maxConsecutive: 2,
    });
    const a = drawGames(20260808, opts, 0);
    const b = drawGames(20260808, opts, 0);
    expect(a).toEqual(b);
  });

  it('다른 seed 는 (대체로) 다른 결과를 만든다', () => {
    const a = drawGames(1, options({ gameCount: 5 }), 0);
    const b = drawGames(2, options({ gameCount: 5 }), 0);
    expect(a).not.toEqual(b);
  });

  it('옵션 입력 순서는 결과를 바꾸지 않는다', () => {
    const a = drawGames(5, options({ include: [3, 11], exclude: [40, 2] }), 0);
    const b = drawGames(5, options({ include: [11, 3], exclude: [2, 40] }), 0);
    expect(a).toEqual(b);
  });

  it('고정수는 모든 게임에 들어가고 제외수는 어디에도 없다', () => {
    const outcome = drawGames(
      99,
      options({ gameCount: 5, include: [1, 5, 9], exclude: [44, 45] }),
    );
    if (!outcome.ok) throw new Error('draw failed');
    for (const game of outcome.result.games) {
      expect(game.numbers).toContain(1);
      expect(game.numbers).toContain(5);
      expect(game.numbers).toContain(9);
      expect(game.numbers).not.toContain(44);
      expect(game.numbers).not.toContain(45);
    }
  });

  it('필터 조건을 실제로 지킨다', () => {
    const outcome = drawGames(
      31337,
      options({
        gameCount: 5,
        oddEvenBalance: true,
        sumRange: [120, 150],
        maxConsecutive: 1,
      }),
    );
    if (!outcome.ok) throw new Error('draw failed');
    for (const game of outcome.result.games) {
      expect(hasOddEvenBalance(game.numbers)).toBe(true);
      expect(sum(game.numbers)).toBeGreaterThanOrEqual(120);
      expect(sum(game.numbers)).toBeLessThanOrEqual(150);
      expect(longestConsecutiveRun(game.numbers)).toBe(1);
    }
  });

  it('불가능한 합계 범위는 예외 대신 FILTER_TOO_STRICT 를 돌려준다', () => {
    const outcome = drawGames(1, options({ sumRange: [21, 22] }));
    expect(outcome).toEqual({ ok: false, reason: 'FILTER_TOO_STRICT' });
  });

  it('고정수가 홀수뿐이면 홀짝 균형과 충돌한다', () => {
    const outcome = drawGames(
      1,
      options({ include: [1, 3, 5, 7, 9], oddEvenBalance: true }),
    );
    expect(outcome).toEqual({ ok: false, reason: 'FILTER_TOO_STRICT' });
  });

  it('연속수 제한과 충돌하는 고정수를 잡아낸다', () => {
    const outcome = drawGames(
      1,
      options({ include: [10, 11, 12], maxConsecutive: 2 }),
    );
    expect(outcome).toEqual({ ok: false, reason: 'FILTER_TOO_STRICT' });
  });

  it('예산을 넘기면 예외 대신 실패 결과를 돌려준다', () => {
    // 남은 후보 7개로 아주 좁은 합계 구간을 요구 — 표본 추출로는 사실상 못 맞춘다.
    const exclude: number[] = [];
    for (let n = 1; n <= 45; n += 1) {
      if (![1, 2, 3, 4, 5, 6, 45].includes(n)) exclude.push(n);
    }
    const outcome = drawGames(1, options({ exclude, sumRange: [22, 22] }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('FILTER_TOO_STRICT');
  });

  it('분포가 한쪽으로 쏠리지 않는다 (모든 번호가 등장)', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) {
      const outcome = drawGames(seed, options({ gameCount: 5 }));
      if (!outcome.ok) throw new Error('draw failed');
      for (const game of outcome.result.games) {
        for (const n of game.numbers) seen.add(n);
      }
    }
    expect(seen.size).toBe(45);
  });
});
