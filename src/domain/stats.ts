/**
 * 실제 회차 데이터를 다루는 순수 함수들 (Phase 2).
 *
 * 규칙: 데이터는 **인자로 받는다.** 이 파일은 네트워크도, 파일도, 브라우저 API도
 * 건드리지 않는다. 데이터 로딩은 src/lib/draws.ts 의 일이다.
 *
 * 그리고 이 통계는 어떤 예측도 아니다. 매 회차는 서로 독립이므로 과거 출현 횟수는
 * 다음 회차 확률과 무관하다. UI 문구도 그렇게 유지할 것.
 */

import { isValidBall } from './filter.ts';
import {
  MAX_BALL,
  MIN_BALL,
  PICK_COUNT,
  type Ball,
  type BallFrequency,
  type MatchOutcome,
  type OfficialDraw,
  type Rank,
} from './types.ts';

/** 알 수 없는 값이 OfficialDraw 모양인지 검사한다. 데이터 파일을 믿지 않는다. */
export function isOfficialDraw(value: unknown): value is OfficialDraw {
  if (typeof value !== 'object' || value === null) return false;
  const draw = value as Partial<OfficialDraw>;

  if (!Number.isInteger(draw.round) || (draw.round as number) < 1) return false;
  if (typeof draw.date !== 'string') return false;
  if (!isValidBall(draw.bonus as number)) return false;
  if (!Array.isArray(draw.numbers)) return false;
  if (draw.numbers.length !== PICK_COUNT) return false;
  if (!draw.numbers.every(isValidBall)) return false;
  if (new Set(draw.numbers).size !== PICK_COUNT) return false;
  if (draw.numbers.includes(draw.bonus as Ball)) return false;

  return true;
}

/**
 * 데이터 파일에서 읽은 목록을 정리한다.
 * 잘못된 항목은 버리고, 회차 중복은 제거하고, 번호는 오름차순으로 맞춘다.
 * 결과는 회차 오름차순.
 */
export function normalizeDraws(list: readonly unknown[]): OfficialDraw[] {
  const byRound = new Map<number, OfficialDraw>();

  for (const item of list) {
    if (!isOfficialDraw(item)) continue;
    byRound.set(item.round, {
      round: item.round,
      date: item.date,
      numbers: [...item.numbers].sort((a, b) => a - b),
      bonus: item.bonus,
    });
  }

  return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
}

/** 가장 최근(회차가 가장 큰) 추첨. 목록이 비면 null. */
export function latestDraw(
  draws: readonly OfficialDraw[],
): OfficialDraw | null {
  let latest: OfficialDraw | null = null;
  for (const draw of draws) {
    if (!latest || draw.round > latest.round) latest = draw;
  }
  return latest;
}

export function findDraw(
  draws: readonly OfficialDraw[],
  round: number,
): OfficialDraw | null {
  return draws.find((draw) => draw.round === round) ?? null;
}

/** 최근 count 회차. 최신순(내림차순)으로 돌려준다. */
export function recentDraws(
  draws: readonly OfficialDraw[],
  count: number,
): OfficialDraw[] {
  return [...draws]
    .sort((a, b) => b.round - a.round)
    .slice(0, Math.max(0, count));
}

/** 등수 판정. 6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등, 그 외 낙첨(null). */
export function rankOf(matchCount: number, bonusMatched: boolean): Rank | null {
  if (matchCount === 6) return 1;
  if (matchCount === 5) return bonusMatched ? 2 : 3;
  if (matchCount === 4) return 4;
  if (matchCount === 3) return 5;
  return null;
}

/** 내 번호 6개를 한 회차의 당첨 번호와 대조한다. */
export function matchDraw(
  numbers: readonly Ball[],
  draw: OfficialDraw,
): MatchOutcome {
  const winning = new Set(draw.numbers);
  const matched = numbers.filter((n) => winning.has(n)).sort((a, b) => a - b);
  const bonusMatched = numbers.includes(draw.bonus);

  return {
    matched,
    matchCount: matched.length,
    bonusMatched,
    rank: rankOf(matched.length, bonusMatched),
  };
}

/**
 * 번호별 출현 횟수. 45개 항목을 번호 오름차순으로 항상 돌려준다
 * (한 번도 안 나온 번호도 count 0 으로 포함).
 *
 * @param includeBonus 보너스 번호도 셈에 넣을지. 기본값 false — 본번호만 센다.
 */
export function numberFrequency(
  draws: readonly OfficialDraw[],
  includeBonus = false,
): BallFrequency[] {
  const counts = new Map<Ball, number>();
  for (let n = MIN_BALL; n <= MAX_BALL; n += 1) counts.set(n, 0);

  for (const draw of draws) {
    for (const n of draw.numbers) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    if (includeBonus) {
      counts.set(draw.bonus, (counts.get(draw.bonus) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([ball, count]) => ({ ball, count }))
    .sort((a, b) => a.ball - b.ball);
}

/**
 * 출현 횟수 내림차순 정렬. 횟수가 같으면 번호 오름차순으로 안정적으로 정렬한다.
 * (같은 입력에 항상 같은 순서가 나오도록)
 */
export function sortByFrequency(
  frequency: readonly BallFrequency[],
): BallFrequency[] {
  return [...frequency].sort((a, b) =>
    b.count === a.count ? a.ball - b.ball : b.count - a.count,
  );
}

/** 데이터가 비어 있지 않은지. UI 가 기능을 켤지 판단하는 데 쓴다. */
export function hasDrawData(draws: readonly OfficialDraw[]): boolean {
  return draws.length > 0;
}
