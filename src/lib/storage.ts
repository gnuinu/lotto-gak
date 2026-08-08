import type { HistoryEntry } from '../domain/index.ts';

/**
 * localStorage 키는 이 하나만 쓴다. 다른 키를 새로 만들지 말 것 —
 * 스키마가 바뀌면 v2 로 올리고 마이그레이션을 여기에 둔다.
 */
export const HISTORY_KEY = 'lottogak:v1:history';

/** 이력 보관 개수 상한. */
export const HISTORY_LIMIT = 100;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** 저장된 이력을 읽는다. 깨진 데이터는 조용히 버린다(앱이 죽는 쪽이 더 나쁘다). */
export function loadHistory(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(entries.slice(0, HISTORY_LIMIT)),
    );
  } catch {
    // 용량 초과 등은 무시한다. 이력은 있으면 좋은 정보일 뿐이다.
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<HistoryEntry>;
  if (typeof entry.id !== 'string') return false;
  const result = entry.result;
  if (typeof result !== 'object' || result === null) return false;
  if (!Array.isArray(result.games)) return false;
  if (typeof result.seed !== 'number') return false;
  if (typeof result.createdAt !== 'number') return false;
  if (typeof result.options !== 'object' || result.options === null) {
    return false;
  }
  return result.games.every(
    (game) =>
      typeof game === 'object' &&
      game !== null &&
      typeof game.label === 'string' &&
      Array.isArray(game.numbers) &&
      game.numbers.every((n) => typeof n === 'number'),
  );
}

/** 이력 항목 id. crypto.randomUUID 가 없는 환경(구형 사파리)도 커버한다. */
export function makeEntryId(seed: number, createdAt: number): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${createdAt.toString(36)}-${seed.toString(36)}`;
}
