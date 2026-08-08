/**
 * 도메인 타입 정의.
 *
 * 이 파일(및 src/domain 전체)은 React / Zustand 등 UI 라이브러리를 import 하지 않는다.
 * node 에서 단독 실행 및 테스트가 가능해야 한다.
 */

/** 로또 공 번호. 1..45 범위의 정수. */
export type Ball = number;

export const MIN_BALL = 1;
export const MAX_BALL = 45;
/** 한 게임의 번호 개수. */
export const PICK_COUNT = 6;
/** 게임(A~E) 최대 개수. */
export const MAX_GAME_COUNT = 5;
/** 고정수 최대 개수. */
export const MAX_INCLUDE = 5;
/** rejection sampling 시도 횟수 상한. */
export const MAX_ATTEMPTS = 5000;
/** 연속수 제한 기본값. */
export const DEFAULT_MAX_CONSECUTIVE = 2;

/** 게임 라벨 A~E. */
export const GAME_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

export interface DrawOptions {
  /** 뽑을 게임 수. 1..5 (A~E) */
  gameCount: number;
  /** 고정수. 모든 게임에 반드시 포함된다. 최대 5개. */
  include: Ball[];
  /** 제외수. 어떤 게임에도 등장하지 않는다. */
  exclude: Ball[];
  /** true 면 홀/짝 각각 최소 2개. */
  oddEvenBalance: boolean;
  /** 6개 번호 합계의 허용 범위 [최소, 최대]. null 이면 제한 없음. */
  sumRange: [number, number] | null;
  /** 허용하는 최대 연속 번호 길이. 기본 2. */
  maxConsecutive: number;
}

export interface Game {
  /** 'A' ~ 'E' */
  label: string;
  /** 오름차순 정렬된 6개 번호. */
  numbers: Ball[];
}

export interface DrawResult {
  games: Game[];
  seed: number;
  createdAt: number;
  options: DrawOptions;
}

/**
 * 추첨 실패 사유.
 *
 * 도메인은 예외를 던지지 않고 항상 이 사유 중 하나를 담은 실패 결과를 반환한다.
 * UI 는 reason 을 사람이 읽을 수 있는 안내 문구로 변환한다(src/domain/messages 아님 —
 * 문구는 UI 레이어 책임이다).
 */
export type DrawFailureReason =
  /** 게임 수가 1..5 범위를 벗어남 */
  | 'INVALID_GAME_COUNT'
  /** 1..45 정수가 아닌 번호가 들어옴 */
  | 'INVALID_BALL'
  /** 고정수가 6개 이상 */
  | 'TOO_MANY_INCLUDE'
  /** 고정수와 제외수가 겹침 */
  | 'INCLUDE_EXCLUDE_OVERLAP'
  /** 제외수를 걷어낸 뒤 남은 후보가 6개 미만 */
  | 'NOT_ENOUGH_CANDIDATES'
  /** 합계 범위가 뒤집혔거나 6개 번호로 도달 불가능한 구간 */
  | 'INVALID_SUM_RANGE'
  /** maxConsecutive 값이 1 미만 */
  | 'INVALID_MAX_CONSECUTIVE'
  /** 조건을 모두 만족하는 조합을 MAX_ATTEMPTS 안에 찾지 못함 */
  | 'FILTER_TOO_STRICT';

export type DrawFailure = {
  ok: false;
  reason: DrawFailureReason;
};

export type DrawSuccess = {
  ok: true;
  result: DrawResult;
};

/** drawGames 의 반환 타입. 실패해도 예외를 던지지 않는다. */
export type DrawOutcome = DrawSuccess | DrawFailure;

/** localStorage 에 저장되는 이력 한 건. */
export interface HistoryEntry {
  id: string;
  result: DrawResult;
}
