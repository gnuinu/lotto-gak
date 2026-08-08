import {
  MAX_BALL,
  MIN_BALL,
  PICK_COUNT,
  matchDraw,
  type OfficialDraw,
} from '../domain/index.ts';
import { ballColor } from '../lib/ballColor.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { BallView } from './BallView.tsx';

const ALL_BALLS = Array.from(
  { length: MAX_BALL - MIN_BALL + 1 },
  (_, i) => MIN_BALL + i,
);

/**
 * 번호를 직접 입력해 한 회차와 대조한다.
 *
 * 이력 대조(MyNumbersCheck)는 이 앱에서 뽑은 번호만 볼 수 있다. 판매점에서 산
 * 용지의 번호는 여기에 넣는다.
 *
 * 실제 구매 여부와는 무관하다 — "이 번호가 이 회차였다면 몇 등인지" 보여줄 뿐이고,
 * 문구도 그 이상을 암시하지 않게 유지할 것.
 */
export function ManualCheck({ draw }: { draw: OfficialDraw }) {
  const numbers = useLottoStore((s) => s.manualNumbers);
  const toggle = useLottoStore((s) => s.toggleManualNumber);
  const clear = useLottoStore((s) => s.clearManualNumbers);

  const complete = numbers.length === PICK_COUNT;
  const outcome = complete ? matchDraw(numbers, draw) : null;

  return (
    <div className="card">
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>
          번호 직접 대조
        </h2>
        <button
          type="button"
          className="history-item__btn"
          onClick={clear}
          disabled={numbers.length === 0}
        >
          지우기
        </button>
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        가지고 있는 번호 {PICK_COUNT}개를 눌러 {draw.round}회차 결과와 견주어
        봅니다.
      </p>

      <div className="grid">
        {ALL_BALLS.map((n) => {
          const picked = numbers.includes(n);
          const full = !picked && complete;
          return (
            <button
              key={n}
              type="button"
              className={`grid__cell${picked ? ' grid__cell--include' : ''}`}
              style={picked ? { background: ballColor(n) } : undefined}
              aria-pressed={picked}
              aria-label={`${n}번 ${picked ? '선택됨' : '선택 안 됨'}`}
              disabled={full}
              onClick={() => toggle(n)}
            >
              {n}
            </button>
          );
        })}
      </div>

      {!complete ? (
        <p className="hint">
          {numbers.length}/{PICK_COUNT}개 선택 —{' '}
          {PICK_COUNT - numbers.length}개 더 고르면 결과가 나옵니다.
        </p>
      ) : (
        outcome && (
          <div className="check-row" role="status" aria-live="polite">
            <div className="check-row__head">
              {outcome.rank !== null ? (
                <span className={`rank-badge rank-badge--${outcome.rank}`}>
                  {outcome.rank}등
                </span>
              ) : (
                <span className="check-row__count">해당 없음</span>
              )}
              <span className="check-row__count">
                {outcome.matchCount}개 일치
                {outcome.bonusMatched && ' + 보너스'}
              </span>
            </div>
            <div className="check-row__balls">
              {numbers.map((n) => {
                const hit = outcome.matched.includes(n) || n === draw.bonus;
                return (
                  <span
                    key={n}
                    className={hit ? 'ball-wrap' : 'ball-wrap ball-wrap--miss'}
                  >
                    <BallView n={n} size="fluid" />
                  </span>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
