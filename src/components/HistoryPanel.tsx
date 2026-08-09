import { useState } from 'react';

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
  const [confirming, setConfirming] = useState(false);

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
        {/* 되돌릴 수 없는 동작이므로 한 번 더 묻는다. */}
        {confirming ? (
          <span className="confirm-row">
            <span className="confirm-row__text">모두 지울까요?</span>
            <button
              type="button"
              className="btn-mini btn-mini--danger"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
            >
              삭제
            </button>
            <button
              type="button"
              className="btn-mini"
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn-mini"
            onClick={() => setConfirming(true)}
          >
            전체 삭제
          </button>
        )}
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
                  className="btn-mini"
                  onClick={() => restore(entry)}
                >
                  불러오기
                </button>
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() => {
                    void shareOrCopy(formatResultText(entry.result));
                  }}
                >
                  복사
                </button>
                <button
                  type="button"
                  className="btn-mini btn-mini--danger"
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
