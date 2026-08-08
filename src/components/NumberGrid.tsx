import { MAX_BALL, MIN_BALL } from '../domain/index.ts';
import { ballColor } from '../lib/ballColor.ts';
import { ballStateOf, useLottoStore } from '../store/useLottoStore.ts';

const ALL_BALLS = Array.from(
  { length: MAX_BALL - MIN_BALL + 1 },
  (_, i) => MIN_BALL + i,
);

/** 1~45 그리드. 탭하면 지정 없음 → 고정수 → 제외수 → 지정 없음 순으로 바뀐다. */
export function NumberGrid() {
  const options = useLottoStore((s) => s.options);
  const cycleBall = useLottoStore((s) => s.cycleBall);
  const clearBallSelection = useLottoStore((s) => s.clearBallSelection);

  const hasSelection = options.include.length + options.exclude.length > 0;

  return (
    <div className="card">
      <div className="toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>
          고정수 · 제외수
        </h2>
        <button
          type="button"
          className="history-item__btn"
          onClick={clearBallSelection}
          disabled={!hasSelection}
        >
          모두 해제
        </button>
      </div>

      <div className="grid">
        {ALL_BALLS.map((n) => {
          const state = ballStateOf(options, n);
          const isInclude = state === 'include';
          return (
            <button
              key={n}
              type="button"
              className={`grid__cell${
                state === 'none' ? '' : ` grid__cell--${state}`
              }`}
              style={isInclude ? { background: ballColor(n) } : undefined}
              aria-pressed={state !== 'none'}
              aria-label={`${n}번 ${
                isInclude ? '고정수' : state === 'exclude' ? '제외수' : '미지정'
              }`}
              onClick={() => cycleBall(n)}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span className="legend__item">
          <span className="legend__dot legend__dot--include" />
          고정수 {options.include.length}/5
        </span>
        <span className="legend__item">
          <span className="legend__dot legend__dot--exclude" />
          제외수 {options.exclude.length}개
        </span>
      </div>
      <p className="hint">번호를 누를수록 고정 → 제외 → 해제로 바뀝니다.</p>
    </div>
  );
}
