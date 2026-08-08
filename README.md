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
- **당첨 번호 대조** — 회차별 당첨 번호를 보고, 저장된 이력과 대조해 등수를 보여줍니다.
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
  draws.json       회차별 당첨 번호 (CI 가 자동 갱신)
scripts/
  gen-icons.mjs    PWA 아이콘(PNG) 생성기
  update-draws.mjs 당첨 번호 수집기 (GitHub Actions 에서 실행)
```

자세한 규칙(도메인/UI 분리, 결정성 계약, 색상표, 실패 처리, 배포 체크리스트)은
[CLAUDE.md](./CLAUDE.md) 에 있습니다.

## 배포

`main` 에 push 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 →
빌드 → GitHub Pages 배포를 수행합니다. 저장소 Settings → Pages 의 **Source** 를
**GitHub Actions** 로 설정해 두어야 합니다.

## 당첨 번호 데이터

앱은 **런타임에 외부 API 를 호출하지 않습니다.** 당첨 번호는 저장소에 커밋된 정적
파일(`public/data/draws.json`)에서 읽습니다.

그 파일은 `.github/workflows/update-draws.yml` 이 매주(토 22:00 KST, 일 10:00 KST
재시도) 새 회차만 이어 받아 갱신하고, 변경이 있을 때만 커밋 후 재배포합니다.

처음 설정할 때는 저장소의 **Actions → Update draw data → Run workflow** 를 한 번
눌러 전체 회차를 채워 넣으세요(1회차부터 순차 수집). 데이터가 비어 있는 동안에도
번호 추첨·조건·이력 기능은 정상 동작하며, 당첨 탭만 안내 문구를 보여줍니다.

```bash
npm run update-draws                      # 새 회차만 이어 받기
npm run probe-draws                       # 수집하지 않고 조회 응답만 진단
node scripts/update-draws.mjs --dry-run   # 파일을 쓰지 않고 확인
node scripts/update-draws.mjs --max=5     # 이번 실행에서 5회차만
```

### 조회가 막힐 때

동행복권 조회 주소는 **접속하는 IP 에 따라 JSON 대신 HTML 페이지를 돌려주는 경우가
있습니다**(해외·데이터센터 IP 차단으로 보이는 동작). GitHub Actions 런너에서 이런
일이 생기면 워크플로가 실패하고, 기존 데이터 파일은 그대로 남습니다.

먼저 원인을 확인하세요 — **Actions → Update draw data → Run workflow** 에서
`probe` 를 켜고 실행하면 수집하지 않고 응답만 진단합니다(상태 코드, 최종 URL,
content-type, 본문 앞부분, 판정).

막혀 있다면 세 가지 방법이 있습니다.

1. **로컬(한국 IP)에서 받아 커밋하기** — 가장 확실합니다.
   ```bash
   npm run update-draws
   git add public/data/draws.json
   git commit -m "chore(data): 당첨 번호 갱신"
   git push
   ```
   `main` 에 push 되면 배포 워크플로가 알아서 다시 배포합니다.
2. **저장소 시크릿 `LOTTO_API_URL`** — 한국 IP 를 경유하는 조회 주소를 넣으면
   워크플로가 그 주소를 씁니다(`&drwNo=` 가 뒤에 붙는 형태여야 합니다).
   비어 있으면 기본 주소를 씁니다.
3. **self-hosted 런너** — 한국에서 돌아가는 런너를 붙이고 워크플로의 `runs-on` 을
   바꿉니다.

## 고지

만 19세 이상 구매 가능 · 이 앱은 당첨을 보장하지 않으며 재미를 위한 번호 생성 도구입니다.

이 앱은 번호를 무작위로 만들어 줄 뿐이고, 어떤 조건도 당첨 확률을 높이지 않습니다.
