import { formatDateTime, formatResultText } from '../lib/format.ts';
import { shareOrCopy } from '../lib/share.ts';
import { HISTORY_LIMIT } from '../lib/storage.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { BallView } from './BallView.tsx';

export function HistoryPanel() {
  const history = useLottoStore((s) => s.history);
  const restore = useLottoStore((s) => s.restore);
  const removeHistoryEntry = useLottoStore((s) => s.removeHistoryEntry);
  const clearHistory = useLottoStore((s) => s.clearHistory);

  if (history.length === 0) {
    return (
      <p className="empty">
        저장된 이력이 없습니다.
        <br />
        추첨하면 이 기기에 최근 {HISTORY_LIMIT}건까지 남습니다.
      </p>
    );
  }

  return (
    <>
      <div className="toolbar">
        <span className="toolbar__count">
          최근 {history.length}건 · 최대 {HISTORY_LIMIT}건
        </span>
        <button
          type="button"
          className="history-item__btn history-item__btn--danger"
          onClick={clearHistory}
        >
          전체 삭제
        </button>
      </div>

      <div className="card">
        {history.map((entry) => (
          <div className="history-item" key={entry.id}>
            <div className="history-item__head">
              <span>{formatDateTime(entry.result.createdAt)}</span>
              <span className="history-item__seed">
                시드 {entry.result.seed}
              </span>
              <span className="history-item__actions">
                <button
                  type="button"
                  className="history-item__btn"
                  onClick={() => restore(entry)}
                >
                  불러오기
                </button>
                <button
                  type="button"
                  className="history-item__btn"
                  onClick={() => {
                    void shareOrCopy(formatResultText(entry.result));
                  }}
                >
                  복사
                </button>
                <button
                  type="button"
                  className="history-item__btn history-item__btn--danger"
                  aria-label="이 이력 삭제"
                  onClick={() => removeHistoryEntry(entry.id)}
                >
                  삭제
                </button>
              </span>
            </div>

            <div className="history-item__games">
              {entry.result.games.map((game) => (
                <div className="history-item__row" key={game.label}>
                  <span className="history-item__label">{game.label}</span>
                  {game.numbers.map((n) => (
                    <BallView key={n} n={n} size="sm" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
