import { describe, expect, it } from 'vitest';

/**
 * CLAUDE.md 의 하드 규칙을 CI 가 강제하게 만든다.
 *
 * 지금까지는 사람이 기억해서 지켜야 했다. 규칙을 어겨도 빌드는 통과하고,
 * 깨진 건 나중에 "node 로 도메인을 돌려보려는데 안 돌아간다" 로 드러난다.
 *
 * 파일은 node:fs 가 아니라 import.meta.glob 으로 읽는다 — @types/node 를 들이지
 * 않으려는 것(이 저장소의 타입 설정은 vite/client 만 본다).
 */

// import.meta.glob 의 옵션은 Vite 가 정적으로 읽는다 — 반드시 인라인 리터럴이어야 한다.
const domainFiles = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const allSources = import.meta.glob('../**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const domain = Object.entries(domainFiles).filter(
  ([path]) => !path.endsWith('.test.ts'),
);

/** 주석과 문자열 리터럴을 지운다 — 설명문에 적힌 단어까지 잡으면 안 된다. */
function stripCommentsAndStrings(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

describe('src/domain 은 순수하다', () => {
  it('읽을 파일이 있다 (테스트가 헛돌지 않는지 확인)', () => {
    expect(domain.length).toBeGreaterThan(4);
  });

  it.each(['react', 'react-dom', 'zustand', 'framer-motion'])(
    '%s 를 import 하지 않는다',
    (pkg) => {
      for (const [path, code] of domain) {
        expect(
          new RegExp(`from\\s+['"]${pkg}['"]`).test(code),
          `${path} 이 ${pkg} 를 import 합니다`,
        ).toBe(false);
      }
    },
  );

  it('도메인 밖(../lib, ../store, ../components)을 import 하지 않는다', () => {
    for (const [path, code] of domain) {
      expect(
        /from\s+['"]\.\.\//.test(code),
        `${path} 이 도메인 밖을 import 합니다`,
      ).toBe(false);
    }
  });

  it.each([
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'fetch',
    'navigator',
  ])('브라우저 API(%s)를 쓰지 않는다', (api) => {
    for (const [path, code] of domain) {
      expect(
        new RegExp(`\\b${api}\\b`).test(stripCommentsAndStrings(code)),
        `${path} 이 ${api} 를 씁니다`,
      ).toBe(false);
    }
  });

  it('Math.random 을 쓰지 않는다 (난수는 rng.ts 의 시드 기반만)', () => {
    for (const [path, code] of domain) {
      expect(
        /Math\.random/.test(stripCommentsAndStrings(code)),
        `${path} 이 Math.random 을 씁니다`,
      ).toBe(false);
    }
  });

  it('Date.now 는 기본 인자 자리에서만 쓴다 (결정성)', () => {
    for (const [path, code] of domain) {
      const hits = stripCommentsAndStrings(code).match(/Date\.now\(\)/g) ?? [];
      // draw.ts 의 `now: number = Date.now()` 한 곳만 허용한다.
      const allowed = path.endsWith('draw.ts') ? 1 : 0;
      expect(hits.length, `${path} 의 Date.now 사용`).toBeLessThanOrEqual(allowed);
    }
  });

  it('도메인 안의 import 는 확장자를 붙인다 (node 가 로더 없이 읽게)', () => {
    for (const [path, code] of domain) {
      for (const line of code.match(/from\s+['"](\.[^'"]*)['"]/g) ?? []) {
        expect(line, `${path}: ${line}`).toMatch(/\.ts['"]$/);
      }
    }
  });
});

describe('추첨 로직은 회차 데이터에 기대지 않는다', () => {
  // 의존하면 "같은 seed + 같은 options -> 같은 결과" 계약이 깨진다.
  it.each(['./draw.ts', './filter.ts', './rng.ts'])(
    '%s 가 stats.ts 를 import 하지 않는다',
    (name) => {
      expect(domainFiles[name]).not.toMatch(/from\s+['"]\.\/stats\.ts['"]/);
    },
  );
});

describe('공 색상은 ballColor.ts 한 곳에서만 정한다', () => {
  const COLORS = ['#FBC400', '#69C8F2', '#FF7272', '#AAAAAA', '#B0D840'];

  it('다른 파일에 색상 값을 다시 적지 않는다', () => {
    for (const [path, code] of Object.entries(allSources)) {
      if (path.endsWith('ballColor.ts') || path.endsWith('.test.ts')) continue;

      const lines = code
        .toUpperCase()
        .split('\n')
        // --gold 는 1–10 구간과 우연히 같은 값을 쓰는 테마 토큰이다.
        // 공 색상을 참조하는 게 아니므로 예외로 둔다.
        .filter((line) => !line.includes('--GOLD:'));

      for (const color of COLORS) {
        const hit = lines.find((line) => line.includes(color));
        expect(hit, `${path} 에 ${color} 이 하드코딩되어 있습니다`).toBeUndefined();
      }
    }
  });
});
