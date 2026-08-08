/**
 * mulberry32 난수 생성기.
 *
 * 클로저에 상태를 숨기지 않고, 상태를 명시적으로 넘기고 되돌려 받는다.
 *   const s0 = createRng(1234);
 *   const [v, s1] = next(s0);
 * 덕분에 추첨 과정 전체가 순수 함수가 되고, 같은 seed 는 항상 같은 수열을 만든다.
 */

/** 난수기 상태. uint32 한 개. */
export type RngState = number;

/** seed 로부터 초기 상태를 만든다. 어떤 정수를 넣어도 uint32 로 정규화된다. */
export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/**
 * 다음 난수를 뽑는다.
 * @returns [0 이상 1 미만의 값, 다음 상태]
 */
export function next(state: RngState): [number, RngState] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a >>> 0];
}

/**
 * 0 이상 maxExclusive 미만의 정수를 뽑는다.
 * maxExclusive 가 1 이하면 항상 0 을 돌려주고 상태만 전진시킨다.
 */
export function nextInt(
  state: RngState,
  maxExclusive: number,
): [number, RngState] {
  const [value, nextState] = next(state);
  if (maxExclusive <= 1) return [0, nextState];
  return [Math.floor(value * maxExclusive), nextState];
}

/**
 * pool 에서 서로 다른 count 개를 뽑는다(비복원 추출).
 * pool 은 변경하지 않는다. count 가 pool 길이보다 크면 pool 전체를 섞어 돌려준다.
 *
 * 부분 Fisher-Yates 셔플이라 각 조합이 나올 확률이 균등하다.
 */
export function sampleUnique<T>(
  state: RngState,
  pool: readonly T[],
  count: number,
): [T[], RngState] {
  const bag = pool.slice();
  const take = Math.min(count, bag.length);
  let s = state;
  for (let i = 0; i < take; i += 1) {
    const [offset, nextState] = nextInt(s, bag.length - i);
    s = nextState;
    const j = i + offset;
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return [bag.slice(0, take), s];
}

// 새 seed 를 뽑는 일은 순수하지 않으므로 도메인 밖(src/lib/seed.ts)에 둔다.
