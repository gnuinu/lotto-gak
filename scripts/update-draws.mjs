/**
 * 당첨 번호 데이터 수집기 (Phase 2).
 *
 * 동행복권의 회차 조회 응답을 읽어 public/data/draws.json 을 갱신한다.
 * GitHub Actions(.github/workflows/update-draws.yml)에서 주기적으로 돌리고,
 * 결과 파일을 저장소에 커밋한다. 앱은 런타임에 외부 API 를 부르지 않는다.
 *
 *   node scripts/update-draws.mjs                 # 새 회차만 이어서 받기
 *   node scripts/update-draws.mjs --max=5         # 이번 실행에서 최대 5회차만
 *   node scripts/update-draws.mjs --from=1100     # 1100회차부터 다시 받기
 *   node scripts/update-draws.mjs --dry-run       # 파일을 쓰지 않고 결과만 출력
 *
 * 환경 변수 LOTTO_API_URL 로 조회 주소를 바꿀 수 있다(테스트용 모의 서버).
 *
 * 주의: 이 스크립트는 도메인 코드를 import 하지 않고 검증을 자체적으로 한다.
 * 여기서 다루는 것은 "믿을 수 없는 외부 응답"이고, 도메인이 다루는 것은
 * "이미 파일에 저장된 데이터"라서 검증의 목적이 다르다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'public', 'data', 'draws.json');

const API_URL =
  process.env.LOTTO_API_URL ??
  'https://www.dhlottery.co.kr/common.do?method=getLottoNumber';

/** 한 번 실행에서 받을 최대 회차 수. 첫 수집(1회차부터)도 한 번에 끝나게 넉넉히 둔다. */
const DEFAULT_MAX = 1500;
/** 상대 서버를 배려한 요청 간격. */
const DEFAULT_DELAY_MS = 120;
/** 요청 실패 시 재시도 횟수. */
const RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15000;

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const options = {
    max: DEFAULT_MAX,
    from: null,
    delay: DEFAULT_DELAY_MS,
    dryRun: false,
  };
  for (const arg of argv) {
    const [key, value] = arg.split('=');
    switch (key) {
      case '--max':
        options.max = Number.parseInt(value, 10);
        break;
      case '--from':
        options.from = Number.parseInt(value, 10);
        break;
      case '--delay':
        options.delay = Number.parseInt(value, 10);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`알 수 없는 옵션: ${arg}`);
    }
  }
  if (!Number.isInteger(options.max) || options.max < 1) {
    throw new Error('--max 는 1 이상의 정수여야 합니다');
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isValidBall(n) {
  return Number.isInteger(n) && n >= 1 && n <= 45;
}

/** 외부 응답 한 건을 우리 스키마로 바꾼다. 조금이라도 이상하면 null. */
function toDraw(payload, expectedRound) {
  if (typeof payload !== 'object' || payload === null) return null;
  if (payload.returnValue !== 'success') return null;
  if (payload.drwNo !== expectedRound) return null;

  const numbers = [
    payload.drwtNo1,
    payload.drwtNo2,
    payload.drwtNo3,
    payload.drwtNo4,
    payload.drwtNo5,
    payload.drwtNo6,
  ];
  if (!numbers.every(isValidBall)) return null;
  if (new Set(numbers).size !== 6) return null;
  if (!isValidBall(payload.bnusNo)) return null;
  if (numbers.includes(payload.bnusNo)) return null;
  if (typeof payload.drwNoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.drwNoDate)) {
    return null;
  }

  return {
    round: expectedRound,
    date: payload.drwNoDate,
    numbers: numbers.slice().sort((a, b) => a - b),
    bonus: payload.bnusNo,
  };
}

/**
 * 한 회차를 조회한다.
 * @returns 회차 데이터, 아직 추첨되지 않았으면 null
 * @throws 네트워크/서버 문제로 판단이 불가능한 경우
 */
async function fetchRound(round) {
  const url = `${API_URL}&drwNo=${round}`;
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'User-Agent': 'lotto-gak-updater' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 응답이 text/html 로 오는 경우가 있어 직접 파싱한다.
      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`JSON 이 아닌 응답: ${text.slice(0, 80)}`);
      }

      if (payload.returnValue === 'fail') return null; // 아직 추첨 전
      const drawData = toDraw(payload, round);
      if (!drawData) {
        throw new Error(
          `${round}회차 응답이 예상과 다릅니다: ${JSON.stringify(payload).slice(0, 200)}`,
        );
      }
      return drawData;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(400 * attempt);
    }
  }

  throw new Error(`${round}회차 조회 실패: ${lastError?.message ?? lastError}`);
}

function readExisting() {
  let raw;
  try {
    raw = readFileSync(DATA_FILE, 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.draws;
    if (!Array.isArray(list)) return [];
    return list.filter((item) => toStoredDraw(item) !== null).map(toStoredDraw);
  } catch {
    return [];
  }
}

/** 이미 저장된 항목도 한 번 더 검증한다. */
function toStoredDraw(item) {
  if (typeof item !== 'object' || item === null) return null;
  if (!Number.isInteger(item.round) || item.round < 1) return null;
  if (typeof item.date !== 'string') return null;
  if (!Array.isArray(item.numbers) || item.numbers.length !== 6) return null;
  if (!item.numbers.every(isValidBall)) return null;
  if (new Set(item.numbers).size !== 6) return null;
  if (!isValidBall(item.bonus)) return null;
  if (item.numbers.includes(item.bonus)) return null;
  return {
    round: item.round,
    date: item.date,
    numbers: item.numbers.slice().sort((a, b) => a - b),
    bonus: item.bonus,
  };
}

function serialize(draws) {
  const lines = draws.map(
    (d) =>
      `    { "round": ${d.round}, "date": "${d.date}", ` +
      `"numbers": [${d.numbers.join(', ')}], "bonus": ${d.bonus} }`,
  );
  return (
    `{\n` +
    `  "version": 1,\n` +
    `  "updatedAt": "${new Date().toISOString()}",\n` +
    `  "draws": [\n${lines.join(',\n')}\n  ]\n` +
    `}\n`
  );
}

async function main() {
  const existing = readExisting();
  const byRound = new Map(existing.map((d) => [d.round, d]));
  const lastStored = existing.reduce((max, d) => Math.max(max, d.round), 0);
  const start = args.from ?? lastStored + 1;

  console.log(`데이터 파일: ${DATA_FILE}`);
  console.log(`저장된 회차: ${existing.length}건 (최신 ${lastStored || '없음'}회차)`);
  console.log(`${start}회차부터 최대 ${args.max}회차까지 조회합니다.`);

  const added = [];
  let round = start;

  for (let i = 0; i < args.max; i += 1, round += 1) {
    const drawData = await fetchRound(round);
    if (!drawData) {
      console.log(`${round}회차는 아직 추첨 전입니다. 여기서 멈춥니다.`);
      break;
    }
    byRound.set(drawData.round, drawData);
    added.push(drawData);
    // 첫 수집처럼 양이 많을 때 진행 상황이 보이게 한다.
    if (added.length % 50 === 0) {
      console.log(`  ... ${added.length}건 수집 (${drawData.round}회차)`);
    }
    if (i + 1 < args.max) await sleep(args.delay);
  }

  const merged = Array.from(byRound.values()).sort((a, b) => a.round - b.round);
  const changed =
    merged.length !== existing.length ||
    JSON.stringify(merged) !== JSON.stringify(existing);

  if (added.length > 0) {
    const rounds = added.map((d) => d.round);
    console.log(
      `새로 받은 회차: ${added.length}건 (${rounds[0]}~${rounds[rounds.length - 1]}회차)`,
    );
  } else {
    console.log('새로 받은 회차가 없습니다.');
  }

  if (!changed) {
    // 파일을 건드리지 않는다. 워크플로가 git diff 로 "변경 없음"을 판단할 수 있어야 한다.
    console.log('변경 사항이 없어 파일을 그대로 둡니다.');
    return;
  }

  if (args.dryRun) {
    console.log(`[dry-run] ${merged.length}건을 쓰지 않고 종료합니다.`);
    return;
  }

  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, serialize(merged));
  console.log(
    `저장 완료: 총 ${merged.length}건 (최신 ${merged[merged.length - 1].round}회차)`,
  );
}

main().catch((error) => {
  console.error(`실패: ${error.message}`);
  process.exit(1);
});
