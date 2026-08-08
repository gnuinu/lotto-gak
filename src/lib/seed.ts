/**
 * 새 추첨을 시작할 때 쓸 seed 를 만든다.
 *
 * 시간과 Math.random 에 의존하므로 순수 함수가 아니다. 그래서 도메인이 아니라
 * 여기(UI 쪽)에 둔다 — src/domain 은 순수 함수만 담는다.
 * 일단 seed 가 정해지면 그 뒤 추첨 전체는 도메인의 순수 계산이다.
 */
export function randomSeed(): number {
  const time = Date.now() >>> 0;
  const jitter = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return (time ^ jitter) >>> 0;
}
