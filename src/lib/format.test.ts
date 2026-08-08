import { describe, expect, it } from 'vitest';

import type { DrawFailureReason, DrawResult } from '../domain/index.ts';
import { defaultOptions } from '../domain/index.ts';
import { failureMessage, formatDateTime, formatResultText } from './format.ts';

/**
 * 모든 실패 사유를 여기 적어 둔다.
 *
 * `Record<DrawFailureReason, true>` 라서 도메인에 새 사유를 추가하면 **타입 검사가
 * 깨진다.** failureMessage 에는 default 절이 있어서 문구를 빠뜨려도 런타임에는
 * 조용히 넘어가는데, 그 구멍을 여기서 막는다.
 */
const ALL_REASONS = {
  INVALID_GAME_COUNT: true,
  INVALID_BALL: true,
  TOO_MANY_INCLUDE: true,
  INCLUDE_EXCLUDE_OVERLAP: true,
  NOT_ENOUGH_CANDIDATES: true,
  INVALID_SUM_RANGE: true,
  INVALID_MAX_CONSECUTIVE: true,
  FILTER_TOO_STRICT: true,
} satisfies Record<DrawFailureReason, true>;

const FALLBACK = '번호를 만들지 못했어요. 조건을 조금 풀어주세요.';

describe('failureMessage', () => {
  const reasons = Object.keys(ALL_REASONS) as DrawFailureReason[];

  it('모든 사유에 전용 문구가 있다 (default 로 새지 않는다)', () => {
    for (const reason of reasons) {
      expect(failureMessage(reason), reason).not.toBe(FALLBACK);
    }
  });

  it('문구가 서로 겹치지 않는다', () => {
    const messages = reasons.map(failureMessage);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('알 수 없는 사유는 안내 문구로 떨어진다', () => {
    expect(failureMessage('WAT' as DrawFailureReason)).toBe(FALLBACK);
  });
});

describe('formatDateTime', () => {
  it('두 자리로 채워 표시한다', () => {
    // 로컬 시간 기준이므로 Date 로 만들어 기대값도 같은 기준으로 맞춘다.
    const d = new Date(2026, 7, 9, 4, 5);
    expect(formatDateTime(d.getTime())).toBe('2026. 08. 09. 04:05');
  });
});

describe('formatResultText', () => {
  const result: DrawResult = {
    games: [
      { label: 'A', numbers: [1, 2, 3, 4, 5, 6] },
      { label: 'B', numbers: [7, 8, 9, 40, 44, 45] },
    ],
    seed: 12345,
    createdAt: new Date(2026, 7, 9, 4, 5).getTime(),
    options: defaultOptions(),
  };

  it('게임마다 한 줄씩, 번호는 두 자리로 넣는다', () => {
    const lines = formatResultText(result).split('\n');
    expect(lines[1]).toBe('A  01  02  03  04  05  06');
    expect(lines[2]).toBe('B  07  08  09  40  44  45');
  });

  it('시드를 담아 상대도 재현할 수 있게 한다', () => {
    expect(formatResultText(result)).toContain('시드 12345');
  });

  it('당첨을 보장하지 않는다는 고지를 항상 붙인다', () => {
    expect(formatResultText(result)).toContain('당첨을 보장하지 않습니다');
  });
});
