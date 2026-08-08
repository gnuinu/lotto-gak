/**
 * 조합 필터와 옵션 유효성 검증.
 *
 * 모든 함수는 순수 함수다. 실패는 예외가 아니라 값(사유 코드)으로 표현한다.
 */

import {
  DEFAULT_MAX_CONSECUTIVE,
  MAX_BALL,
  MAX_GAME_COUNT,
  MAX_INCLUDE,
  MIN_BALL,
  PICK_COUNT,
  type Ball,
  type DrawFailureReason,
  type DrawOptions,
} from './types.ts';

/** 6개 번호로 만들 수 있는 최소 합계 (1+2+3+4+5+6). */
export const MIN_POSSIBLE_SUM = 21;
/** 6개 번호로 만들 수 있는 최대 합계 (40+41+42+43+44+45). */
export const MAX_POSSIBLE_SUM = 255;

export function isValidBall(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_BALL && n <= MAX_BALL;
}

/** 중복을 제거하고 오름차순으로 정렬한다. */
function uniqueSorted(numbers: readonly Ball[]): Ball[] {
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/**
 * 옵션을 정규화한다. 같은 뜻의 옵션이 항상 같은 형태가 되도록 만들어
 * "같은 seed + 같은 options → 같은 결과" 보장을 입력 순서와 무관하게 만든다.
 */
export function normalizeOptions(options: DrawOptions): DrawOptions {
  return {
    gameCount: options.gameCount,
    include: uniqueSorted(options.include),
    exclude: uniqueSorted(options.exclude),
    oddEvenBalance: options.oddEvenBalance,
    sumRange: options.sumRange
      ? [options.sumRange[0], options.sumRange[1]]
      : null,
    maxConsecutive: options.maxConsecutive,
  };
}

export function sum(numbers: readonly Ball[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function countOdd(numbers: readonly Ball[]): number {
  return numbers.filter((n) => n % 2 === 1).length;
}

/** 홀수 최소 2개 + 짝수 최소 2개. */
export function hasOddEvenBalance(numbers: readonly Ball[]): boolean {
  const odd = countOdd(numbers);
  return odd >= 2 && numbers.length - odd >= 2;
}

export function isInSumRange(
  numbers: readonly Ball[],
  range: readonly [number, number] | null,
): boolean {
  if (!range) return true;
  const total = sum(numbers);
  return total >= range[0] && total <= range[1];
}

/** 가장 긴 연속 번호 구간의 길이. [3,4,5,10,20,21] -> 3 */
export function longestConsecutiveRun(numbers: readonly Ball[]): number {
  if (numbers.length === 0) return 0;
  const sorted = uniqueSorted(numbers);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

/**
 * 제외수를 걷어낸 뒤 남는 후보 풀. 고정수는 이미 확정된 번호이므로 제외한다.
 * (고정수 + 이 풀) 이 실제 추첨 대상 전체다.
 */
export function candidatePool(options: DrawOptions): Ball[] {
  const excluded = new Set(options.exclude);
  const included = new Set(options.include);
  const pool: Ball[] = [];
  for (let n = MIN_BALL; n <= MAX_BALL; n += 1) {
    if (!excluded.has(n) && !included.has(n)) pool.push(n);
  }
  return pool;
}

/**
 * 6개 조합이 필터를 통과하는지 검사한다.
 * 고정수/제외수는 추첨 단계에서 구조적으로 보장되지만, 여기서도 함께 확인한다.
 */
export function passesFilters(
  numbers: readonly Ball[],
  options: DrawOptions,
): boolean {
  if (numbers.length !== PICK_COUNT) return false;
  if (new Set(numbers).size !== PICK_COUNT) return false;

  const picked = new Set(numbers);
  for (const n of options.include) {
    if (!picked.has(n)) return false;
  }
  for (const n of options.exclude) {
    if (picked.has(n)) return false;
  }

  if (options.oddEvenBalance && !hasOddEvenBalance(numbers)) return false;
  if (!isInSumRange(numbers, options.sumRange)) return false;
  if (longestConsecutiveRun(numbers) > options.maxConsecutive) return false;

  return true;
}

/**
 * 구조적으로 잘못된 옵션을 찾는다. (사용자가 고쳐야 하는 입력 오류)
 * @returns 사유 코드, 문제가 없으면 null
 */
export function validateOptions(options: DrawOptions): DrawFailureReason | null {
  const { gameCount, include, exclude, sumRange, maxConsecutive } = options;

  if (
    !Number.isInteger(gameCount) ||
    gameCount < 1 ||
    gameCount > MAX_GAME_COUNT
  ) {
    return 'INVALID_GAME_COUNT';
  }

  if (!Number.isInteger(maxConsecutive) || maxConsecutive < 1) {
    return 'INVALID_MAX_CONSECUTIVE';
  }

  for (const n of [...include, ...exclude]) {
    if (!isValidBall(n)) return 'INVALID_BALL';
  }

  if (include.length > MAX_INCLUDE) return 'TOO_MANY_INCLUDE';

  const excluded = new Set(exclude);
  for (const n of include) {
    if (excluded.has(n)) return 'INCLUDE_EXCLUDE_OVERLAP';
  }

  if (include.length + candidatePool(options).length < PICK_COUNT) {
    return 'NOT_ENOUGH_CANDIDATES';
  }

  if (sumRange) {
    const [lo, hi] = sumRange;
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
      return 'INVALID_SUM_RANGE';
    }
    if (lo > hi) return 'INVALID_SUM_RANGE';
    if (hi < MIN_POSSIBLE_SUM || lo > MAX_POSSIBLE_SUM) {
      return 'INVALID_SUM_RANGE';
    }
  }

  return null;
}

/**
 * 입력 자체는 올바르지만 조건이 서로 모순인 경우를 미리 잡아낸다.
 * 여기서 걸리면 5000번 헛돌리지 않고 즉시 FILTER_TOO_STRICT 를 돌려줄 수 있다.
 *
 * 연속수 제한처럼 조합 구조에 얽힌 조건은 여기서 판정하지 않고 표본 추출에 맡긴다.
 * 즉 이 함수는 "확실히 불가능한 경우"만 잡는다(false negative 는 허용).
 */
/**
 * nCk. 게임 수 비교에만 쓰므로 cap 을 넘으면 계산을 멈추고 cap 을 돌려준다
 * (C(45,6)=8145060 처럼 큰 값을 끝까지 구할 이유가 없다).
 */
function combinations(n: number, k: number, cap: number): number {
  if (k < 0 || k > n) return 0;
  let total = 1;
  for (let i = 1; i <= k; i += 1) {
    total = (total * (n - k + i)) / i;
    if (total >= cap) return cap;
  }
  return Math.round(total);
}

export function findInfeasibility(
  options: DrawOptions,
): DrawFailureReason | null {
  const pool = candidatePool(options);
  const needed = PICK_COUNT - options.include.length;

  // 게임끼리는 서로 달라야 한다. 만들 수 있는 조합 자체가 게임 수보다 적으면
  // 필터를 보기 전에 이미 불가능하다. (고정수 5개 + 제외수를 많이 건 경우)
  if (combinations(pool.length, needed, options.gameCount) < options.gameCount) {
    return 'FILTER_TOO_STRICT';
  }

  if (options.sumRange) {
    const ascending = pool.slice().sort((a, b) => a - b);
    const base = sum(options.include);
    const minSum = base + sum(ascending.slice(0, needed));
    const maxSum = base + sum(ascending.slice(ascending.length - needed));
    const [lo, hi] = options.sumRange;
    if (maxSum < lo || minSum > hi) return 'FILTER_TOO_STRICT';
  }

  if (options.oddEvenBalance) {
    const oddInPool = countOdd(pool);
    const evenInPool = pool.length - oddInPool;
    const oddFixed = countOdd(options.include);
    const evenFixed = options.include.length - oddFixed;

    // 홀수를 최대한 채워도 2개에 못 미치면(또는 짝수 쪽이 그렇다면) 불가능하다.
    const maxOdd = oddFixed + Math.min(needed, oddInPool);
    const maxEven = evenFixed + Math.min(needed, evenInPool);
    if (maxOdd < 2 || maxEven < 2) return 'FILTER_TOO_STRICT';

    // 고정수만으로 이미 한쪽이 5개면 남은 자리로 반대쪽 2개를 채울 수 없다.
    if (oddFixed > PICK_COUNT - 2 || evenFixed > PICK_COUNT - 2) {
      return 'FILTER_TOO_STRICT';
    }
  }

  if (longestConsecutiveRun(options.include) > options.maxConsecutive) {
    return 'FILTER_TOO_STRICT';
  }

  return null;
}

/** 기본 옵션. UI 초기 상태로 쓴다. */
export function defaultOptions(): DrawOptions {
  return {
    gameCount: 5,
    include: [],
    exclude: [],
    oddEvenBalance: false,
    sumRange: null,
    maxConsecutive: DEFAULT_MAX_CONSECUTIVE,
  };
}
