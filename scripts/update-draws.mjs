/**
 * 동행복권의 과거 로또 6/45 당첨번호를 public/data/draws.json으로 갱신한다.
 *
 * 현재 홈페이지가 사용하는 /lt645/selectPstLt645InfoNew.do API는 한 요청에
 * 지정 회차 주변의 10개 회차를 반환한다. 예전 common.do API와 응답 구조가 다르므로
 * 이 스크립트는 화면 API의 data.list를 직접 검증해 사용한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'public', 'data', 'draws.json');
const API_URL =
  process.env.LOTTO_API_URL?.trim() ||
  'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';
const DEFAULT_MAX = 1500;
const DEFAULT_DELAY_MS = 120;
const RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.dhlottery.co.kr/lt645/result',
  'X-Requested-With': 'XMLHttpRequest',
};

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const options = { max: DEFAULT_MAX, from: null, delay: DEFAULT_DELAY_MS, dryRun: false, probe: false };
  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (key === '--max') options.max = Number.parseInt(value, 10);
    else if (key === '--from') options.from = Number.parseInt(value, 10);
    else if (key === '--delay') options.delay = Number.parseInt(value, 10);
    else if (key === '--dry-run') options.dryRun = true;
    else if (key === '--probe') options.probe = true;
    else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  if (!Number.isInteger(options.max) || options.max < 1) throw new Error('--max는 1 이상의 정수여야 합니다.');
  if (options.from !== null && (!Number.isInteger(options.from) || options.from < 1)) {
    throw new Error('--from은 1 이상의 정수여야 합니다.');
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isValidBall = (n) => Number.isInteger(n) && n >= 1 && n <= 45;

function buildUrl(round) {
  const url = new URL(API_URL);
  url.searchParams.set('srchDir', 'center');
  url.searchParams.set('srchLtEpsd', String(round));
  // 홈페이지 요청과 같은 캐시 방지 파라미터. API 결과에는 영향을 주지 않는다.
  url.searchParams.set('_', String(Date.now()));
  return url;
}

function formatDate(value) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function toDraw(item) {
  if (typeof item !== 'object' || item === null || !Number.isInteger(item.ltEpsd) || item.ltEpsd < 1) return null;
  const numbers = [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo];
  const date = formatDate(item.ltRflYmd);
  if (!numbers.every(isValidBall) || new Set(numbers).size !== 6 || !isValidBall(item.bnsWnNo) || numbers.includes(item.bnsWnNo) || !date) {
    return null;
  }
  return { round: item.ltEpsd, date, numbers: numbers.slice().sort((a, b) => a - b), bonus: item.bnsWnNo };
}

async function fetchBatch(round) {
  const url = buildUrl(round);
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: REQUEST_HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const list = payload?.data?.list;
      if (!Array.isArray(list)) throw new Error(`예상과 다른 응답: ${JSON.stringify(payload).slice(0, 200)}`);
      const draws = list.map(toDraw);
      if (draws.some((draw) => draw === null)) throw new Error('응답에 유효하지 않은 당첨번호 항목이 있습니다.');
      return draws;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(400 * attempt);
    }
  }
  throw new Error(`${round}회차 조회 실패: ${lastError?.message ?? lastError}`);
}

function toStoredDraw(item) {
  if (typeof item !== 'object' || item === null || !Number.isInteger(item.round) || item.round < 1) return null;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  if (!Array.isArray(item.numbers) || item.numbers.length !== 6 || !item.numbers.every(isValidBall) || new Set(item.numbers).size !== 6) return null;
  if (!isValidBall(item.bonus) || item.numbers.includes(item.bonus)) return null;
  return { round: item.round, date: item.date, numbers: item.numbers.slice().sort((a, b) => a - b), bonus: item.bonus };
}

function readExisting() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : parsed?.draws;
    return Array.isArray(list) ? list.map(toStoredDraw).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function serialize(draws) {
  const lines = draws.map((d) => `    { "round": ${d.round}, "date": "${d.date}", "numbers": [${d.numbers.join(', ')}], "bonus": ${d.bonus} }`);
  return `{\n  "version": 1,\n  "updatedAt": "${new Date().toISOString()}",\n  "draws": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

async function probe(round) {
  const url = buildUrl(round);
  console.log(`요청 URL: ${url}`);
  const draws = await fetchBatch(round);
  console.log(`응답: ${draws.length}건`);
  console.log(draws.map((draw) => `${draw.round}회 (${draw.date})`).join(', ') || '당첨 회차 없음');
}

async function main() {
  if (args.probe) return probe(args.from ?? 1);

  const existing = readExisting();
  const byRound = new Map(existing.map((draw) => [draw.round, draw]));
  const lastStored = existing.reduce((max, draw) => Math.max(max, draw.round), 0);
  const start = args.from ?? lastStored + 1;
  console.log(`데이터 파일: ${DATA_FILE}`);
  console.log(`저장된 회차: ${existing.length}건 (최신 ${lastStored || '없음'}회)`);
  console.log(`${start}회차부터 최대 ${args.max}회차까지 조회합니다.`);

  let nextRound = start;
  let added = 0;
  // 빈 데이터 파일을 처음 채울 때는 요청당 최대 9개 신규 회차를 가져온다.
  // 이미 최신 데이터가 있으면 다음 회차를 정확히 조회해 새 추첨을 놓치지 않는다.
  const initialOffset = existing.length === 0 ? 4 : 0;
  while (nextRound < start + args.max) {
    const draws = await fetchBatch(nextRound + initialOffset);
    const usable = draws.filter((draw) => draw.round >= nextRound && draw.round < start + args.max);
    if (usable.length === 0) break;

    for (const draw of usable) {
      if (!byRound.has(draw.round)) added += 1;
      byRound.set(draw.round, draw);
    }
    const highest = Math.max(...usable.map((draw) => draw.round));
    nextRound = highest + 1;
    if (added > 0 && added % 50 === 0) console.log(`  ... ${added}건 수집 (${highest}회차)`);
    if (nextRound < start + args.max) await sleep(args.delay);
  }

  const merged = Array.from(byRound.values()).sort((a, b) => a.round - b.round);
  const changed = JSON.stringify(merged) !== JSON.stringify(existing);
  console.log(added > 0 ? `새로 받은 회차: ${added}건` : '새로 받은 회차가 없습니다.');
  if (!changed) return console.log('변경 사항이 없어 파일을 그대로 둡니다.');
  if (args.dryRun) return console.log(`[dry-run] 총 ${merged.length}건을 저장하지 않고 종료합니다.`);
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, serialize(merged));
  console.log(`저장 완료: 총 ${merged.length}건 (최신 ${merged.at(-1).round}회차)`);
}

main().catch((error) => {
  console.error(`실패: ${error.message}`);
  process.exit(1);
});
