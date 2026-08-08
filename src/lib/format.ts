import type { DrawFailureReason, DrawResult } from '../domain/index.ts';

/** 도메인 실패 사유를 한국어 안내 문구로 바꾼다. */
export function failureMessage(reason: DrawFailureReason): string {
  switch (reason) {
    case 'FILTER_TOO_STRICT':
      return '조건이 너무 빡빡해요. 합계 범위를 넓히거나 제외수를 줄여보세요.';
    case 'INVALID_GAME_COUNT':
      return '게임 수는 1개에서 5개 사이로 골라주세요.';
    case 'INVALID_BALL':
      return '번호는 1부터 45까지만 쓸 수 있어요.';
    case 'TOO_MANY_INCLUDE':
      return '고정수는 5개까지만 지정할 수 있어요.';
    case 'INCLUDE_EXCLUDE_OVERLAP':
      return '같은 번호를 고정수와 제외수에 함께 넣을 수 없어요.';
    case 'NOT_ENOUGH_CANDIDATES':
      return '제외수가 너무 많아요. 남은 번호가 6개보다 적습니다.';
    case 'INVALID_SUM_RANGE':
      return '합계 범위를 확인해주세요. 6개 번호의 합은 21부터 255까지 가능합니다.';
    case 'INVALID_MAX_CONSECUTIVE':
      return '연속수 제한은 1 이상이어야 해요.';
    default:
      return '번호를 만들지 못했어요. 조건을 조금 풀어주세요.';
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 2026. 08. 08. 21:04 */
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** 공유/복사용 텍스트. 시드를 함께 담아 상대도 같은 번호를 재현할 수 있게 한다. */
export function formatResultText(result: DrawResult): string {
  const lines = result.games.map(
    (game) =>
      `${game.label}  ${game.numbers.map((n) => pad(n)).join('  ')}`,
  );
  return [
    '당첨각 — 로또 6/45 번호',
    ...lines,
    '',
    `시드 ${result.seed}`,
    formatDateTime(result.createdAt),
    '이 번호는 당첨을 보장하지 않습니다.',
  ].join('\n');
}
