import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID = { round: 1, date: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 };

/**
 * draws.ts 는 모듈 수준에 캐시를 들고 있다.
 * 테스트마다 모듈을 새로 읽어 캐시를 초기화한다.
 */
async function freshLoader() {
  vi.resetModules();
  const mod = await import('./draws.ts');
  return mod.loadOfficialDraws;
}

function respondWith(payload: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      json: async () => payload,
    })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadOfficialDraws', () => {
  it('{ draws: [...] } 형태를 읽는다', async () => {
    respondWith({ version: 1, draws: [VALID] });
    const load = await freshLoader();
    const result = await load();
    expect(result).toEqual({ ok: true, draws: [VALID] });
  });

  it('[...] 형태도 읽는다', async () => {
    respondWith([VALID]);
    const load = await freshLoader();
    const result = await load();
    expect(result.ok && result.draws).toEqual([VALID]);
  });

  it('알 수 없는 형태는 EMPTY', async () => {
    respondWith({ nope: true });
    const load = await freshLoader();
    expect(await load()).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('항목이 전부 깨져 있으면 EMPTY', async () => {
    respondWith({ draws: [{ round: 'x' }, null, { numbers: [1] }] });
    const load = await freshLoader();
    expect(await load()).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('HTTP 오류는 FETCH_FAILED', async () => {
    respondWith({}, false);
    const load = await freshLoader();
    expect(await load()).toEqual({ ok: false, reason: 'FETCH_FAILED' });
  });

  it('네트워크가 끊겨도 예외를 던지지 않는다 (오프라인 첫 방문)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const load = await freshLoader();
    expect(await load()).toEqual({ ok: false, reason: 'FETCH_FAILED' });
  });

  it('성공하면 두 번째 호출은 네트워크를 다시 타지 않는다', async () => {
    respondWith({ draws: [VALID] });
    const load = await freshLoader();
    await load();
    await load();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('BASE_URL 아래 상대 경로 하나만 읽는다 (외부 도메인 금지)', async () => {
    respondWith({ draws: [VALID] });
    const load = await freshLoader();
    await load();
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain('data/draws.json');
    expect(url).not.toMatch(/^https?:\/\//);
  });
});
