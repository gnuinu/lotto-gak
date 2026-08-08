import { normalizeDraws, type OfficialDraw } from '../domain/index.ts';

/**
 * 당첨 번호 데이터 로더.
 *
 * 데이터는 **같은 오리진의 정적 파일 하나**에서만 온다. 외부 API 를 직접 부르지
 * 않는다(브라우저에서는 CORS 로 막히고, 앱이 남의 서버 사정에 묶이면 안 된다).
 * 파일은 .github/workflows/update-draws.yml 이 주기적으로 갱신한다.
 *
 * 실패하면 예외를 던지지 않고 빈 목록을 돌려준다 — 데이터가 없어도 추첨 기능은
 * 그대로 동작해야 한다.
 */

/** base 를 붙여 상대 경로로 만든다. Pages 서브경로(/lotto-gak/)에서도 맞게 동작한다. */
export const DRAWS_URL = `${import.meta.env.BASE_URL}data/draws.json`;

export type DrawsLoadResult =
  | { ok: true; draws: OfficialDraw[] }
  | { ok: false; reason: 'FETCH_FAILED' | 'EMPTY' };

let cached: OfficialDraw[] | null = null;

export async function loadOfficialDraws(): Promise<DrawsLoadResult> {
  if (cached) return { ok: true, draws: cached };

  let payload: unknown;
  try {
    const response = await fetch(DRAWS_URL);
    if (!response.ok) return { ok: false, reason: 'FETCH_FAILED' };
    payload = await response.json();
  } catch {
    // 오프라인 첫 방문이거나 파일이 아직 배포되지 않은 경우.
    return { ok: false, reason: 'FETCH_FAILED' };
  }

  const list = extractDrawList(payload);
  const draws = normalizeDraws(list);
  if (draws.length === 0) return { ok: false, reason: 'EMPTY' };

  cached = draws;
  return { ok: true, draws };
}

/** { version, draws: [...] } 와 [...] 두 형태를 모두 받아준다. */
function extractDrawList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null) {
    const draws = (payload as { draws?: unknown }).draws;
    if (Array.isArray(draws)) return draws;
  }
  return [];
}
