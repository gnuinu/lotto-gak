/**
 * 로또 공 색상. 실제 규격을 따른다 — 임의로 바꾸지 말 것.
 *
 *   1–10  #FBC400 (노랑)
 *   11–20 #69C8F2 (파랑)
 *   21–30 #FF7272 (빨강)
 *   31–40 #AAAAAA (회색)
 *   41–45 #B0D840 (초록)
 */
export function ballColor(n: number): string {
  if (n <= 10) return '#FBC400';
  if (n <= 20) return '#69C8F2';
  if (n <= 30) return '#FF7272';
  if (n <= 40) return '#AAAAAA';
  return '#B0D840';
}
