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
 *   node scripts/update-draws.mjs --probe        # 수집하지 않고 응답만 진단
 *
 * 환경 변수 LOTTO_API_URL 로 조회 주소를 바꿀 수 있다(모의 서버, 또는 한국 IP 를
 * 경유하는 프록시). 비어 있으면 기본 주소를 쓴다.
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

// 빈 문자열도 "설정 안 함"으로 취급한다 — 워크플로에서 빈 변수를 넘길 수 있다.
const API_URL =
  process.env.LOTTO_API_URL?.trim() ||
  'https://www.dhlottery.co.kr/common.do?method=getLottoNumber';

/** 한 번 실행에서 받을 최대 회차 수. 첫 수집(1회차부터)도 한 번에 끝나게 넉넉히 둔다. */
const DEFAULT_MAX = 1500;
/** 상대 서버를 배려한 요청 간격. */
const DEFAULT_DELAY_MS = 120;
/** 요청 실패 시 재시도 횟수. */
const RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * 브라우저처럼 보이는 헤더.
 *
 * 동행복권은 API 라기보다 사이트 내부에서 쓰는 조회 엔드포인트라서, 봇 같아 보이는
 * 요청에는 JSON 대신 HTML 페이지를 돌려주는 경우가 있다. 실제 조회 화면이 보내는
 * 헤더에 맞춘다.
 */
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
  'X-Requested-With': 'XMLHttpRequest',
};

/**
 * 조회 화면을 먼저 한 번 열어 세션 쿠키를 받아둔다.
 *
 * 이 엔드포인트는 사이트 내부에서 쓰는 것이라 세션 없이 부르면 JSON 대신 페이지를
 * 돌려주는 경우가 있다. 실패해도 그냥 넘어간다 — 쿠키 없이도 되는 환경이 있다.
 */
let cookieHeader = null;

async function warmUp() {
  let origin;
  try {
    origin = new URL(API_URL).origin;
  } catch {
    return;
  }

  try {
    const response = await fetch(`${origin}/gameResult.do?method=byWin`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
      console.log(`세션 쿠키를 받았습니다 (${cookies.length}개).`);
    } else {
      console.log('세션 쿠키가 없습니다. 쿠키 없이 계속합니다.');
    }
  } catch (error) {
    console.log(`사전 요청 실패(무시하고 계속): ${error.message}`);
  }
}

function requestHeaders() {
  return cookieHeader
    ? { ...REQUEST_HEADERS, Cookie: cookieHeader }
    : REQUEST_HEADERS;
}

/** 로그에 넣기 좋게 공백을 줄이고 자른다. HTML 응답은 앞부분이 개행뿐일 수 있다. */
function snippet(text, length = 200) {
  return text.replace(/\s+/g, ' ').trim().slice(0, length);
}

/** JSON 이 아닌 응답을 만났을 때 원인 추측을 덧붙인다. */
function diagnose(text) {
  if (/<!DOCTYPE|<html/i.test(text)) {
    return (
      'JSON 대신 HTML 페이지가 왔습니다. 동행복권이 이 IP(예: GitHub Actions 런너)의 ' +
      '접근을 막고 있을 가능성이 큽니다. `--probe` 로 응답을 확인하고, 막혀 있다면 ' +
      '한국 IP 에서 스크립트를 돌려 결과 파일을 커밋하거나 self-hosted 런너를 쓰세요.'
    );
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const options = {
    max: DEFAULT_MAX,
    from: null,
    delay: DEFAULT_DELAY_MS,
    dryRun: false,
    probe: false,
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
      case '--probe':
        options.probe = true;
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
        headers: requestHeaders(),
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
        const hint = diagnose(text);
        throw new Error(
          `JSON 이 아닌 응답 (content-type: ${
            response.headers.get('content-type') ?? '없음'
          }, 최종 URL: ${response.url})\n  본문: ${snippet(text)}` +
            (hint ? `\n  ${hint}` : ''),
        );
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

/**
 * 수집하지 않고 응답만 들여다본다. "왜 안 되는지"를 판단하는 용도.
 * 조회가 정상이면 0, 차단/오류로 판단되면 1 로 끝나서 워크플로 상태에 그대로 드러난다.
 */
async function probe(round) {
  const url = `${API_URL}&drwNo=${round}`;
  console.log(`진단 모드 — 수집하지 않고 응답만 확인합니다.`);
  console.log(`요청 URL: ${url}`);
  await warmUp();

  let response;
  let text;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: requestHeaders(),
    });
    text = await response.text();
  } catch (error) {
    console.log(`연결 자체가 실패했습니다: ${error.message}`);
    console.log('네트워크가 막혀 있거나 호스트를 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`상태: HTTP ${response.status}`);
  console.log(`최종 URL: ${response.url}`);
  console.log(`content-type: ${response.headers.get('content-type') ?? '없음'}`);
  console.log(`본문 길이: ${text.length}바이트`);
  console.log(`본문 앞부분: ${snippet(text, 500)}`);

  try {
    const payload = JSON.parse(text);
    console.log(`JSON 파싱: 성공 (returnValue: ${payload.returnValue})`);
    if (toDraw(payload, round)) {
      console.log(`판정: 정상입니다. ${round}회차를 읽을 수 있습니다.`);
      return;
    }
    if (payload.returnValue === 'fail') {
      console.log(`판정: 정상입니다. ${round}회차는 아직 추첨 전입니다.`);
      return;
    }
    console.log('판정: JSON 은 왔지만 형식이 예상과 다릅니다.');
    process.exit(1);
  } catch {
    console.log('JSON 파싱: 실패');
    console.log(`판정: ${diagnose(text) ?? 'JSON 이 아닌 응답을 받았습니다.'}`);
    process.exit(1);
  }
}

async function main() {
  if (args.probe) {
    await probe(args.from ?? 1);
    return;
  }

  const existing = readExisting();
  const byRound = new Map(existing.map((d) => [d.round, d]));
  const lastStored = existing.reduce((max, d) => Math.max(max, d.round), 0);
  const start = args.from ?? lastStored + 1;

  console.log(`데이터 파일: ${DATA_FILE}`);
  console.log(`저장된 회차: ${existing.length}건 (최신 ${lastStored || '없음'}회차)`);
  console.log(`${start}회차부터 최대 ${args.max}회차까지 조회합니다.`);

  await warmUp();

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
