# CLAUDE.md — 당첨각 (lotto-gak)

로또 6/45 번호 생성기. 백엔드 없는 100% 정적 웹앱. GitHub Pages 배포.
이 문서는 이 저장소에서 작업할 때 지켜야 하는 규칙을 담는다.

## 기술 스택 (고정)

React 18 + TypeScript + Vite / Zustand(상태) / Framer Motion(연출) /
vite-plugin-pwa(오프라인). 서버 없음, 외부 API 호출 없음.

## 아키텍처 규칙: 도메인 / UI 분리

```
src/
  domain/      순수 TypeScript. React 의존성 0.
    types.ts   타입, 상수(1..45, 6개, 최대 5게임, 시도 상한 5000)
    rng.ts     mulberry32 — 상태를 명시적으로 주고받는다
    draw.ts    drawGames(seed, options) — rejection sampling
    filter.ts  필터 술어 + 옵션 검증 + 불가능 조건 사전 판정
    stats.ts   실제 회차 데이터 대조·통계 (Phase 2). 데이터를 인자로만 받는다
    index.ts   공개 API 배럴
  store/       Zustand. 도메인 호출과 화면 상태만 담당
  components/  화면. 도메인 규칙을 다시 구현하지 않는다
  lib/         UI 쪽 헬퍼(색상표, 문구 변환, localStorage, 공유, 데이터 로딩)
  styles/      global.css
scripts/
  gen-icons.mjs    PWA 아이콘 생성
  update-draws.mjs 당첨 번호 수집 (CI 전용. 앱은 이 코드를 쓰지 않는다)
```

**하드 규칙**

1. `src/domain/**` 에서 `react`, `zustand`, `framer-motion` 등 어떤 UI
   라이브러리도 import 하지 않는다. `window`, `document`, `localStorage` 같은
   브라우저 API도 쓰지 않는다.
2. 도메인은 node 에서 단독 실행/테스트가 가능해야 한다. 확인:
   ```bash
   node --experimental-strip-types -e "import('./src/domain/index.ts').then(m => console.log(m.drawGames(1, m.defaultOptions())))"
   npm test          # vitest — 도메인 단위 테스트
   ```
   도메인 import 는 확장자(`.ts`)를 붙인다. node 가 로더 없이 그대로 읽을 수 있게 하려는 것.
3. 검증·필터·난수는 전부 도메인 책임이다. 컴포넌트에서 `Math.random()` 을 쓰거나
   합계·홀짝 규칙을 다시 계산하지 않는다.
4. UI 문구는 전부 한국어. 도메인은 문구를 모른다 — 사유 코드만 돌려주고,
   한국어 변환은 `src/lib/format.ts` 의 `failureMessage()` 한 곳에서만 한다.

### 라우터 금지

GitHub Pages 는 SPA fallback 이 없어 딥링크가 404 가 된다. 그래서 라우터를 쓰지
않고 **단일 페이지 + 탭 전환**(`store.tab`: `draw` | `filter` | `history` | `win`)으로
화면을 나눈다. 새 화면이 필요하면 탭이나 섹션을 추가하고, 절대 URL 경로를 만들지 않는다.

### 결정성 (determinism)

같은 `seed` + 같은 `options` → 항상 같은 `games`. 이게 "시드로 재현하기" 기능의
근거다. 이 계약을 깨는 변경은 금지다:

- 난수는 `rng.ts` 의 `next(state) => [value, nextState]` 만 쓴다. 전역 상태나
  숨겨진 클로저 상태를 만들지 않는다.
- `drawGames` 는 옵션을 먼저 `normalizeOptions()` 로 정규화한다(중복 제거·정렬).
  덕분에 `include: [7, 3]` 과 `[3, 7]` 이 같은 결과를 낸다.
- `createdAt` 만 호출 시각에 따라 달라진다. 테스트에서는 세 번째 인자
  `now` 를 넘겨 고정한다: `drawGames(seed, options, 0)`.
- 추첨 순서(게임 A→E, 시도 순서)를 바꾸면 기존 시드의 결과가 전부 달라진다.
  즉 이건 **호환성을 깨는 변경**이다. 꼭 필요하면 저장 스키마 버전을 올린다.

## 로또 공 색상표 (실제 규격 — 임의 변경 금지)

| 번호 구간 | 색상 코드 |
| --------- | --------- |
| 1–10      | `#FBC400` |
| 11–20     | `#69C8F2` |
| 21–30     | `#FF7272` |
| 31–40     | `#AAAAAA` |
| 41–45     | `#B0D840` |

단일 진실 공급원은 `src/lib/ballColor.ts` 의 `ballColor(n)` 이다. 색상 값을 CSS 나
컴포넌트에 다시 적어 넣지 말고 이 함수를 쓴다.

공은 원형, 숫자는 **흰색 볼드**. 어두운 배경(`#0E1420`) 위에서 대비를 잃지 않도록
`.ball` 클래스가 안쪽 그림자와 텍스트 그림자로 테두리를 만들어 준다. 특히
`#AAAAAA`(31–40) 위의 흰 숫자는 대비가 빠듯하므로 `text-shadow` 를 지우지 말 것.

## 필터 조합 실패 처리 방식

**도메인은 예외를 던지지 않는다.** `drawGames` 는 항상 판별 가능한 결과를 돌려준다.

```ts
type DrawOutcome =
  | { ok: true; result: DrawResult }
  | { ok: false; reason: DrawFailureReason };
```

처리 순서는 3단이다:

1. **입력 검증** — `validateOptions()`. 사용자가 고쳐야 하는 잘못된 입력.
   `INVALID_GAME_COUNT`, `INVALID_BALL`, `TOO_MANY_INCLUDE`(고정수 6개 이상),
   `INCLUDE_EXCLUDE_OVERLAP`(고정수∩제외수), `NOT_ENOUGH_CANDIDATES`(남은 후보 6개 미만),
   `INVALID_SUM_RANGE`, `INVALID_MAX_CONSECUTIVE`.
2. **불가능 조건 사전 판정** — `findInfeasibility()`. 입력 자체는 옳지만 조건들이
   서로 모순인 경우(예: 합계 상한이 도달 가능한 최소 합보다 작음, 고정수가 홀수
   5개인데 홀짝 균형 요구, 고정수가 이미 연속수 제한 위반). 5000번 헛돌리지 않고
   즉시 `FILTER_TOO_STRICT` 를 돌려준다. 여기서는 **확실히 불가능한 경우만** 잡는다
   (놓치는 건 괜찮고, 가능한 조합을 불가능하다고 판정하면 버그다).
3. **rejection sampling** — 게임 하나당 최대 `MAX_ATTEMPTS`(5000)회 시도.
   예산을 넘기면 `FILTER_TOO_STRICT`.

UI 는 `failure` 사유를 `failureMessage()` 로 바꿔 "조건이 너무 빡빡해요…" 를 띄우고
"조건 고치기" 버튼으로 조건 탭으로 보낸다. 도메인 실패(`failure`)와 단순 안내
(`notice`, 예: 고정수 5개 초과 탭)는 상태를 분리해 둔다.

## localStorage

**키는 `lottogak:v1:history` 하나만 쓴다.** 다른 키를 새로 만들지 않는다.
읽기/쓰기는 `src/lib/storage.ts` 를 통해서만 한다.

- 최근 **100건**(`HISTORY_LIMIT`)까지 보관, 최신순. 개별 삭제 / 전체 삭제 지원.
- 같은 시드 + 같은 조건으로 다시 뽑으면 이력에 중복 저장하지 않는다.
- 깨진 데이터는 조용히 버린다(`isHistoryEntry` 검증). 저장소 문제로 앱이 죽지 않게 한다.
- 스키마가 바뀌면 키를 `v2` 로 올리고 마이그레이션을 `storage.ts` 에 둔다.

## Pages 배포 체크리스트

- [ ] `vite.config.ts` 의 `base: '/lotto-gak/'` 가 저장소 이름과 일치한다.
      저장소 이름을 바꾸면 `base`, manifest 의 `start_url`/`scope`,
      workbox `navigateFallback` 을 함께 고친다.
- [ ] `package-lock.json` 이 커밋되어 있다 (워크플로가 `npm ci` 를 쓴다).
- [ ] 로컬에서 `npm run build` 통과. `npm test` 통과.
- [ ] `import` 경로의 **대소문자가 파일명과 정확히 일치**한다. macOS 는 통과하고
      리눅스 빌드 서버에서만 깨진다. 컴포넌트 파일은 `PascalCase.tsx`,
      도메인/헬퍼는 `camelCase.ts`.
- [ ] 절대 경로 URL 을 코드에 직접 쓰지 않는다. 정적 자원은 `public/` 에 두고
      `./` 상대 경로나 Vite import 로 참조한다(`base` 가 자동으로 붙는다).
- [ ] 저장소 Settings → Pages → **Source: GitHub Actions** 로 설정한다.
      (브랜치 배포가 아니다.)
- [ ] `main` 에 push 하면 `.github/workflows/deploy.yml` 이 build → 테스트 →
      `actions/deploy-pages` 를 돌린다. Node 22, `npm ci`.
- [ ] 배포 후 `https://<user>.github.io/lotto-gak/` 에서 확인:
      새로고침 정상, 아이콘·manifest 로드, 비행기 모드에서 재방문 시 오프라인 동작.
- [ ] PWA 아이콘을 바꿨다면 `node scripts/gen-icons.mjs` 를 다시 돌리고
      `public/icon-*.png` 를 커밋한다(빌드 단계에서 생성하지 않는다).
- [ ] workbox `globPatterns` 에 `json` 이 들어 있어야 당첨 데이터가 오프라인에서도
      열린다. 데이터 갱신은 곧 새 배포이므로 프리캐시로 충분하다.
- [ ] 데이터 갱신 워크플로가 `main` 에 push 해야 한다. 브랜치 보호 규칙을 걸 때는
      `github-actions[bot]` 의 push 를 허용할 것.

## 당첨 번호 데이터 (Phase 2)

실제 회차 데이터를 다루지만 **앱은 런타임에 외부 API 를 호출하지 않는다.**
네트워크 접근은 CI 안에서만 일어난다.

```
동행복권 조회 API
   │  scripts/update-draws.mjs  (GitHub Actions 안에서만 실행)
   ▼
public/data/draws.json          저장소에 커밋되는 정적 파일
   │  배포
   ▼
src/lib/draws.ts                같은 오리진 파일 1개만 fetch
   │
   ▼
src/domain/stats.ts             순수 함수. 데이터를 인자로 받는다
```

**규칙**

1. 브라우저에서 외부 도메인으로 요청을 보내지 않는다. `src/lib/draws.ts` 는
   `import.meta.env.BASE_URL` 기준 상대 경로 하나만 읽는다.
2. `domain/stats.ts` 는 fetch 하지 않는다. 데이터를 **인자로 받는** 순수 함수만 둔다.
3. **추첨 로직은 이 데이터에 절대 의존하지 않는다.** 의존하면 "같은 seed + 같은
   options → 같은 결과" 계약이 깨진다. `draw.ts` 가 `stats.ts` 를 import 하는 일은 없어야 한다.
4. 데이터가 없어도 앱은 정상 동작해야 한다. 로딩 실패는 예외가 아니라
   `{ ok: false, reason }` 이고, 당첨 탭만 안내 문구로 바뀐다.
5. 데이터 파일을 믿지 않는다. `normalizeDraws()` 가 항목을 검증하고, 회차 중복을
   제거하고, 번호를 오름차순으로 맞춘다.
6. `scripts/update-draws.mjs` 는 도메인 코드를 import 하지 않고 검증을 자체적으로
   한다. 다루는 대상이 다르다 — 스크립트는 "믿을 수 없는 외부 응답",
   도메인은 "이미 파일에 저장된 데이터"를 검증한다.

### 데이터 갱신 워크플로

`.github/workflows/update-draws.yml` 이 토요일 22:00 KST(추첨 이후)와 일요일
10:00 KST(재시도)에 돌면서 새 회차만 이어 받아 커밋한다.

- 새 회차가 없으면 **파일을 건드리지 않는다.** 그래서 `git diff --quiet` 이
  "변경 없음"의 신뢰할 수 있는 신호가 된다(`updatedAt` 도 이때는 갱신하지 않는다).
- 수집 실패(HTTP 오류, 응답 형식 이상)는 조용히 넘기지 않고 워크플로를 실패시킨다.
  기존 파일은 그대로 남는다.
- 커밋 후 배포는 `deploy.yml` 을 `workflow_call` 로 **직접 호출**한다.
  `GITHUB_TOKEN` 으로 만든 push 는 다른 워크플로를 깨우지 않기 때문이다.
  그래서 `deploy.yml` 의 트리거에 `workflow_call` 이 들어 있다 — 지우지 말 것.
- 로컬에서 손으로 받아볼 때:
  ```bash
  npm run update-draws                        # 새 회차만 이어 받기
  npm run probe-draws                         # 수집하지 않고 응답만 진단
  node scripts/update-draws.mjs --dry-run     # 파일을 쓰지 않고 확인
  node scripts/update-draws.mjs --max=5       # 이번 실행에서 5회차만
  LOTTO_API_URL=http://127.0.0.1:8899/x node scripts/update-draws.mjs  # 모의 서버로 테스트
  ```

### 조회가 막히는 문제 (실제로 겪은 것)

동행복권 조회 주소는 **IP 에 따라 HTTP 200 으로 JSON 대신 HTML 페이지를 돌려준다.**
GitHub Actions 런너에서 이 일이 실제로 발생했다(2026-08-08). 상태 코드가 200 이라
`response.ok` 검사로는 걸리지 않는다 — 그래서 본문을 직접 파싱하고 실패를 진단한다.

- 이 상황에 대응하는 장치: 브라우저에 가까운 헤더, 조회 화면 사전 요청으로 세션 쿠키
  확보, `--probe` 진단 모드, 시크릿 `LOTTO_API_URL` 로 조회 주소 교체.
- **어떤 헤더 조합이 통하는지는 IP 에 따라 달라 보장할 수 없다.** 막혀 있으면
  한국 IP 에서 `npm run update-draws` 로 받아 커밋하는 게 가장 확실하다.
  데이터 파일만 커밋되면 나머지 파이프라인(배포·오프라인 캐시)은 그대로 동작한다.
- 진단 로그를 만들 때 HTML 본문은 앞부분이 개행뿐일 수 있다. 반드시 공백을 줄인 뒤
  잘라서 출력한다(`snippet()`). 그러지 않으면 로그에 빈 줄만 남아 원인을 못 찾는다.

### 통계 문구 원칙

번호별 출현 횟수는 **예측이 아니다.** 매 회차는 서로 독립이므로 과거에 많이 나온
번호가 다음에 더 나올 이유가 없다. 그래서:

- "많이 나온 번호" 는 기록으로만 보여주고, 반드시 독립성 안내를 함께 둔다.
- 빈도 상위 번호를 고정수로 자동 적용하는 식의 기능은 넣지 않는다.
  "이 번호가 유리하다" 는 암시가 되기 때문이다.
- 내 번호 대조는 "저장된 번호를 그 회차 결과와 견주어 본 것" 이다.
  실제 구매를 뜻하지 않으므로 문구도 그렇게 유지한다.

## 문구 원칙

- 모든 UI 문구는 한국어.
- 하단 고지는 항상 화면에 보이게 유지한다(`BottomBar`):
  "만 19세 이상 구매 가능 · 이 앱은 당첨을 보장하지 않으며 재미를 위한 번호 생성 도구입니다"
- 과도한 구매를 부추기는 문구는 넣지 않는다. "이번엔 됩니다", "당첨 확률 상승",
  "행운의 번호" 같은 표현 금지. 이 앱은 번호 생성 도구지 예측 도구가 아니다.

## 모바일 우선

세로 화면 기준으로 만든다. 주요 버튼(추첨)은 한 손으로 닿도록 하단 고정 바에 둔다.
결과 카드의 공 6개는 항상 한 줄에 들어가야 한다 — 고정 크기 대신 `.ball--fluid`
(그리드 6칸 + `aspect-ratio: 1`)를 쓴다.
