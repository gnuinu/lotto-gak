import { describe, expect, it } from 'vitest';

import {
  findDraw,
  hasDrawData,
  isOfficialDraw,
  latestDraw,
  matchDraw,
  normalizeDraws,
  numberFrequency,
  rankOf,
  recentDraws,
  sortByFrequency,
  type OfficialDraw,
} from './index.ts';

/** 테스트용 가짜 회차. 실제 당첨 번호가 아니다. */
function draw(
  round: number,
  numbers: number[],
  bonus: number,
  date = '2026-01-03',
): OfficialDraw {
  return { round, date, numbers, bonus };
}

const WINNING = draw(1000, [1, 2, 3, 4, 5, 6], 7);

describe('isOfficialDraw', () => {
  it('올바른 회차를 통과시킨다', () => {
    expect(isOfficialDraw(WINNING)).toBe(true);
  });

  it('깨진 데이터를 거른다', () => {
    expect(isOfficialDraw(null)).toBe(false);
    expect(isOfficialDraw({})).toBe(false);
    // 번호가 5개
    expect(isOfficialDraw(draw(1, [1, 2, 3, 4, 5], 7))).toBe(false);
    // 범위 밖
    expect(isOfficialDraw(draw(1, [1, 2, 3, 4, 5, 46], 7))).toBe(false);
    // 중복 번호
    expect(isOfficialDraw(draw(1, [1, 1, 3, 4, 5, 6], 7))).toBe(false);
    // 보너스가 본번호와 겹침
    expect(isOfficialDraw(draw(1, [1, 2, 3, 4, 5, 6], 6))).toBe(false);
    // 회차가 0
    expect(isOfficialDraw(draw(0, [1, 2, 3, 4, 5, 6], 7))).toBe(false);
  });
});

describe('normalizeDraws', () => {
  it('잘못된 항목을 버리고 회차 오름차순으로 정렬한다', () => {
    const list = [
      draw(3, [9, 8, 7, 6, 5, 4], 1),
      { round: 2, date: 'x', numbers: [1, 2], bonus: 3 },
      draw(1, [10, 20, 30, 40, 44, 45], 2),
      'garbage',
    ];
    const result = normalizeDraws(list);
    expect(result.map((d) => d.round)).toEqual([1, 3]);
    // 번호는 오름차순으로 맞춰진다
    expect(result[1].numbers).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('회차 중복은 나중 항목으로 덮어쓴다', () => {
    const result = normalizeDraws([
      draw(5, [1, 2, 3, 4, 5, 6], 7),
      draw(5, [11, 12, 13, 14, 15, 16], 17),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].numbers).toEqual([11, 12, 13, 14, 15, 16]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const original = draw(1, [6, 5, 4, 3, 2, 1], 7);
    const snapshot = [...original.numbers];
    normalizeDraws([original]);
    expect(original.numbers).toEqual(snapshot);
  });
});

describe('rankOf', () => {
  it('등수 규칙을 지킨다', () => {
    expect(rankOf(6, false)).toBe(1);
    expect(rankOf(5, true)).toBe(2);
    expect(rankOf(5, false)).toBe(3);
    expect(rankOf(4, false)).toBe(4);
    expect(rankOf(4, true)).toBe(4); // 4개일 때 보너스는 등수를 바꾸지 않는다
    expect(rankOf(3, false)).toBe(5);
    expect(rankOf(2, true)).toBeNull();
    expect(rankOf(0, false)).toBeNull();
  });
});

describe('matchDraw', () => {
  it('1등', () => {
    const outcome = matchDraw([1, 2, 3, 4, 5, 6], WINNING);
    expect(outcome.rank).toBe(1);
    expect(outcome.matchCount).toBe(6);
    expect(outcome.matched).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('2등은 5개 + 보너스', () => {
    const outcome = matchDraw([1, 2, 3, 4, 5, 7], WINNING);
    expect(outcome.matchCount).toBe(5);
    expect(outcome.bonusMatched).toBe(true);
    expect(outcome.rank).toBe(2);
  });

  it('3등은 5개 (보너스 없음)', () => {
    const outcome = matchDraw([1, 2, 3, 4, 5, 45], WINNING);
    expect(outcome.bonusMatched).toBe(false);
    expect(outcome.rank).toBe(3);
  });

  it('4등 · 5등 · 낙첨', () => {
    expect(matchDraw([1, 2, 3, 4, 44, 45], WINNING).rank).toBe(4);
    expect(matchDraw([1, 2, 3, 43, 44, 45], WINNING).rank).toBe(5);
    expect(matchDraw([1, 2, 42, 43, 44, 45], WINNING).rank).toBeNull();
    expect(matchDraw([40, 41, 42, 43, 44, 45], WINNING).matchCount).toBe(0);
  });

  it('겹친 번호를 오름차순으로 돌려준다', () => {
    const outcome = matchDraw([6, 4, 2, 40, 41, 42], WINNING);
    expect(outcome.matched).toEqual([2, 4, 6]);
  });
});

describe('numberFrequency', () => {
  const draws = [
    draw(1, [1, 2, 3, 4, 5, 6], 45),
    draw(2, [1, 2, 3, 4, 5, 7], 45),
    draw(3, [1, 10, 20, 30, 40, 44], 45),
  ];

  it('45개 번호를 번호순으로 모두 돌려준다', () => {
    const frequency = numberFrequency(draws);
    expect(frequency).toHaveLength(45);
    expect(frequency[0].ball).toBe(1);
    expect(frequency[44].ball).toBe(45);
  });

  it('본번호만 센다 (보너스 제외가 기본)', () => {
    const frequency = numberFrequency(draws);
    const countOf = (ball: number) =>
      frequency.find((f) => f.ball === ball)?.count;
    expect(countOf(1)).toBe(3);
    expect(countOf(2)).toBe(2);
    expect(countOf(7)).toBe(1);
    expect(countOf(45)).toBe(0); // 보너스로만 나왔다
    expect(countOf(43)).toBe(0);
  });

  it('includeBonus 면 보너스도 센다', () => {
    const frequency = numberFrequency(draws, true);
    expect(frequency.find((f) => f.ball === 45)?.count).toBe(3);
  });

  it('총합은 회차수 × 6 이다', () => {
    const total = numberFrequency(draws).reduce((sum, f) => sum + f.count, 0);
    expect(total).toBe(draws.length * 6);
  });

  it('데이터가 없으면 전부 0', () => {
    const frequency = numberFrequency([]);
    expect(frequency).toHaveLength(45);
    expect(frequency.every((f) => f.count === 0)).toBe(true);
  });
});

describe('sortByFrequency', () => {
  it('횟수 내림차순, 동률은 번호 오름차순', () => {
    const sorted = sortByFrequency([
      { ball: 10, count: 2 },
      { ball: 3, count: 5 },
      { ball: 7, count: 2 },
      { ball: 1, count: 9 },
    ]);
    expect(sorted.map((f) => f.ball)).toEqual([1, 3, 7, 10]);
  });

  it('원본을 바꾸지 않는다', () => {
    const input = [
      { ball: 5, count: 1 },
      { ball: 2, count: 9 },
    ];
    sortByFrequency(input);
    expect(input.map((f) => f.ball)).toEqual([5, 2]);
  });
});

describe('회차 조회', () => {
  const draws = [
    draw(10, [1, 2, 3, 4, 5, 6], 7),
    draw(12, [1, 2, 3, 4, 5, 8], 7),
    draw(11, [1, 2, 3, 4, 5, 9], 7),
  ];

  it('latestDraw 는 회차가 가장 큰 항목', () => {
    expect(latestDraw(draws)?.round).toBe(12);
    expect(latestDraw([])).toBeNull();
  });

  it('findDraw', () => {
    expect(findDraw(draws, 11)?.round).toBe(11);
    expect(findDraw(draws, 99)).toBeNull();
  });

  it('recentDraws 는 최신순', () => {
    expect(recentDraws(draws, 2).map((d) => d.round)).toEqual([12, 11]);
    expect(recentDraws(draws, 0)).toEqual([]);
    expect(recentDraws(draws, 99)).toHaveLength(3);
  });

  it('hasDrawData', () => {
    expect(hasDrawData(draws)).toBe(true);
    expect(hasDrawData([])).toBe(false);
  });
});
