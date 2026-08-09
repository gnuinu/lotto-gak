# 당첨각 (lotto-gak)

로또 6/45 번호 생성기. 조건을 걸어 번호를 뽑고, 시드로 언제든 같은 번호를 다시 만들 수 있습니다.
백엔드 없이 브라우저에서만 돌아가고, 한 번 열어두면 오프라인에서도 동작합니다.

**배포 URL: https://gnuinu.github.io/lotto-gak/**

## 기능

- **게임 수 선택** — 1~5게임(A~E)을 한 번에 뽑습니다.
- **조건 지정**
  - 고정수(최대 5개) / 제외수 — 1~45 그리드에서 번호를 누르면
    `고정 → 제외 → 해제` 순으로 바뀝니다.
  - 홀짝 균형 — 홀수·짝수를 각각 2개 이상 포함
  - 합계 범위 — 6개 번호 합의 하한·상한 (기본 제안 100~175)
  - 연속수 허용 — 이어지는 번호(예: 12·13·14)를 몇 개까지 허용할지
- **조건이 서로 모순이면** 번호를 억지로 만들지 않고 "조건이 너무 빡빡해요"라고
  알려줍니다. 앱이 멈추거나 조건을 몰래 무시하는 일은 없습니다.
- **시드 재현** — 결과마다 시드가 표시됩니다. 같은 시드 + 같은 조건을 넣으면
  항상 같은 번호가 나옵니다.
- **이력** — 이 기기에 최근 100건까지 저장됩니다. 개별/전체 삭제 가능.
- **복사·공유** — Web Share API 를 지원하면 공유 시트, 없으면 클립보드로 복사합니다.
- **당첨 번호 대조** — 회차별 당첨 번호를 보고 등수를 확인합니다. 저장된 이력을 한꺼번에
  대조하거나, 판매점에서 산 용지처럼 앱 밖의 번호를 **직접 입력해서** 대조할 수 있습니다.
  번호별 출현 횟수(최근 50회 / 100회 / 전체)도 함께 제공합니다.
- **PWA** — 홈 화면에 추가할 수 있고, 비행기 모드에서도 완전히 동작합니다.

번호는 실제 로또 공 규격 색상을 그대로 씁니다.
(1–10 노랑 · 11–20 파랑 · 21–30 빨강 · 31–40 회색 · 41–45 초록)

## 로컬 실행

Node 22 이상이 필요합니다.

```bash
npm ci          # 또는 npm install
npm run dev     # http://localhost:5173/lotto-gak/
```

`base` 가 `/lotto-gak/` 이므로 개발 서버 주소에도 경로가 붙습니다.

### 그 밖의 명령

```bash
npm test        # 도메인 단위 테스트 (vitest)
npm run build   # 타입 검사 + 프로덕션 빌드 -> dist/
npm run preview # 빌드 결과를 로컬에서 확인 (서비스 워커 포함)
```

도메인 로직은 UI 의존성이 전혀 없어서 node 로 바로 실행할 수도 있습니다.

```bash
node --experimental-strip-types \
  -e "import('./src/domain/index.ts').then(m => console.log(m.drawGames(1, m.defaultOptions())))"
```

## 구조

```
src/
  domain/          순수 TypeScript. 난수·추첨·필터·검증·통계. React 의존성 0
  store/           Zustand 상태
  components/      화면 (라우터 없이 탭 전환)
  lib/             공 색상표, 문구 변환, localStorage, 공유, 데이터 로딩
  styles/          global.css
public/data/
  draws.json       1~1234회차 당첨 번호 (CI 가 자동 갱신)
scripts/
  gen-icons.mjs    PWA 아이콘(PNG) 생성기
  update-draws.mjs 동행복권 당첨 번호 수집기 (GitHub Actions 에서 실행)
```

자세한 규칙(도메인/UI 분리, 결정성 계약, 색상표, 실패 처리, 배포 체크리스트)은
[CLAUDE.md](./CLAUDE.md) 에 있습니다.

## 배포

`main` 에 push 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 →
빌드 → GitHub Pages 배포를 수행합니다. 저장소 Settings → Pages 의 **Source** 를
**GitHub Actions** 로 설정해 두어야 합니다.

## 당첨 번호 데이터

앱은 **런타임에 외부 API를 호출하지 않습니다.** 당첨 번호는 저장소에 커밋된 정적
파일(`public/data/draws.json`)에서 읽습니다. 현재 파일에는 1회차부터 1234회차까지의
당첨 번호가 포함되어 있습니다.

수집기는 동행복권 홈페이지에서 사용하는
`/lt645/selectPstLt645InfoNew.do` 조회 API를 이용합니다. API는 지정 회차 주변의
최대 10개 회차를 반환하며, 수집기는 응답의 회차·당첨 번호·보너스 번호·추첨일을
검증한 뒤 정적 파일 형식으로 저장합니다.

`.github/workflows/update-draws.yml`은 매주 토요일 22:00 KST에 새 회차를 수집하고,
일요일 10:00 KST에 한 번 더 재시도합니다. 데이터에 변경이 있을 때만 커밋하고
재배포합니다.

필요한 경우 저장소의 **Actions → Update draw data → Run workflow**에서 수동으로
실행할 수 있습니다. 데이터 파일이 비어 있더라도 번호 추첨·조건·이력 기능은
정상 동작하며, 당첨 번호 탭에는 안내 문구가 표시됩니다.

```bash
npm run update-draws                              # 새 회차를 수집하고 파일을 갱신합니다.
npm run probe-draws -- --from=562                 # 562회차 주변의 API 응답을 확인합니다.
node scripts/update-draws.mjs --dry-run           # 파일을 저장하지 않고 결과를 확인합니다.
node scripts/update-draws.mjs --from=1200 --max=5 # 지정 범위의 최대 5회차를 수집합니다.
```

### 조회가 막힐 때

동행복권 조회 API는 접속 환경에 따라 요청을 제한할 수 있습니다. 수집이 실패하더라도
기존 `public/data/draws.json` 파일은 변경되지 않습니다.

먼저 **Actions → Update draw data → Run workflow**에서 `probe` 옵션을 켜고 실행해
조회 결과를 확인합니다. `probe`는 데이터를 저장하지 않으며, 요청 URL과 수신한
회차 목록만 출력합니다.

조회가 제한되면 다음 방법을 사용할 수 있습니다.

1. **로컬 환경에서 수집 후 커밋합니다.**
   ```bash
   npm run update-draws
   git add public/data/draws.json
   git commit -m "chore(data): 당첨 번호 갱신"
   git push
   ```
   `main` 브랜치에 푸시하면 배포 워크플로가 자동으로 다시 배포합니다.
2. **저장소 시크릿 `LOTTO_API_URL`을 설정합니다.** 한국 IP를 경유하는 현재 조회 API
   주소를 설정하면 워크플로가 해당 주소를 사용합니다. 수집기가 `srchDir`,
   `srchLtEpsd`, `_` 쿼리 매개변수를 자동으로 추가하므로 기본 엔드포인트 주소만
   설정하면 됩니다.
3. **self-hosted 러너를 사용합니다.** 한국에서 실행되는 러너를 연결한 뒤 워크플로의
   `runs-on` 값을 변경합니다.

## 고지

만 19세 이상 구매 가능 · 이 앱은 당첨을 보장하지 않으며 재미를 위한 번호 생성 도구입니다.

이 앱은 번호를 무작위로 만들어 줄 뿐이고, 어떤 조건도 당첨 확률을 높이지 않습니다.
