/**
 * 추첨 로직.
 *
 * 핵심 계약: 같은 seed + 같은 options 는 항상 같은 games 를 만든다.
 * (createdAt 만 호출 시각에 따라 달라진다 — 재현 시에는 now 인자로 고정할 수 있다.)
 */

import {
  findInfeasibility,
  normalizeOptions,
  passesFilters,
  validateOptions,
  candidatePool,
} from './filter.ts';
import { createRng, sampleUnique, type RngState } from './rng.ts';
import {
  GAME_LABELS,
  MAX_ATTEMPTS,
  PICK_COUNT,
  type Ball,
  type DrawOptions,
  type DrawOutcome,
  type Game,
} from './types.ts';

/**
 * 조건을 만족하는 한 게임을 rejection sampling 으로 뽑는다.
 *
 * 게임 하나마다 MAX_ATTEMPTS(5000) 회의 예산을 쓴다. 예산을 넘기면 null 을 돌려주고,
 * 호출자가 FILTER_TOO_STRICT 로 변환한다.
 */
function drawOneGame(
  state: RngState,
  pool: readonly Ball[],
  options: DrawOptions,
): [Ball[] | null, RngState] {
  const needed = PICK_COUNT - options.include.length;
  let s = state;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [picked, nextState] = sampleUnique(s, pool, needed);
    s = nextState;

    const numbers = [...options.include, ...picked].sort((a, b) => a - b);
    if (passesFilters(numbers, options)) {
      return [numbers, s];
    }
  }

  return [null, s];
}

/**
 * gameCount 개의 게임을 뽑는다.
 *
 * 실패 시에도 예외를 던지지 않고 { ok: false, reason } 을 돌려준다.
 * UI 는 reason 을 보고 "조건이 너무 빡빡해요" 같은 안내를 띄운다.
 */
export function drawGames(
  seed: number,
  rawOptions: DrawOptions,
  now: number = Date.now(),
): DrawOutcome {
  const options = normalizeOptions(rawOptions);

  const invalid = validateOptions(options);
  if (invalid) return { ok: false, reason: invalid };

  const infeasible = findInfeasibility(options);
  if (infeasible) return { ok: false, reason: infeasible };

  const pool = candidatePool(options);
  const games: Game[] = [];
  let state = createRng(seed);

  for (let i = 0; i < options.gameCount; i += 1) {
    const [numbers, nextState] = drawOneGame(state, pool, options);
    state = nextState;
    if (!numbers) return { ok: false, reason: 'FILTER_TOO_STRICT' };
    games.push({ label: GAME_LABELS[i], numbers });
  }

  return {
    ok: true,
    result: {
      games,
      seed: seed >>> 0,
      createdAt: now,
      options,
    },
  };
}
