import { useEffect } from 'react';

import { findDraw, latestDraw } from '../domain/index.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { FrequencyCard } from './FrequencyCard.tsx';
import { MyNumbersCheck } from './MyNumbersCheck.tsx';
import { WinningNumbers } from './WinningNumbers.tsx';

/**
 * 당첨 탭. 실제 회차 데이터를 보여주고 내 이력과 대조한다.
 *
 * 데이터는 정적 파일에서 오고, 없을 수도 있다(첫 배포 직후, 오프라인 첫 방문).
 * 그럴 때도 앱의 다른 기능은 그대로 동작해야 한다.
 */
export function WinPanel() {
  const draws = useLottoStore((s) => s.draws);
  const status = useLottoStore((s) => s.drawsStatus);
  const selectedRound = useLottoStore((s) => s.selectedRound);
  const setSelectedRound = useLottoStore((s) => s.setSelectedRound);
  const loadDrawData = useLottoStore((s) => s.loadDrawData);

  // 탭을 처음 열 때만 읽는다. 추첨 기능을 쓰는 사용자에게 부담을 주지 않으려는 것.
  useEffect(() => {
    void loadDrawData();
  }, [loadDrawData]);

  if (status === 'idle' || status === 'loading') {
    return <p className="empty">당첨 번호를 불러오는 중…</p>;
  }

  if (status === 'unavailable') {
    return (
      <div className="card">
        <h2 className="section-title">당첨 번호</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          당첨 번호 데이터를 아직 받지 못했습니다. 데이터는 매주 자동으로 갱신되며,
          갱신된 뒤 앱을 다시 열면 표시됩니다.
        </p>
        <p className="hint">
          번호 추첨과 이력 기능은 데이터 없이도 그대로 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  const latest = latestDraw(draws);
  const current =
    (selectedRound !== null ? findDraw(draws, selectedRound) : null) ?? latest;

  if (!current || !latest) {
    return <p className="empty">표시할 회차가 없습니다.</p>;
  }

  const first = draws[0].round;
  const canGoPrev = current.round > first;
  const canGoNext = current.round < latest.round;

  return (
    <>
      <div className="card">
        <div className="round-nav">
          <button
            type="button"
            className="round-nav__btn"
            disabled={!canGoPrev}
            aria-label="이전 회차"
            onClick={() => setSelectedRound(current.round - 1)}
          >
            ◀
          </button>
          <div className="round-nav__center">
            <div className="round-nav__round">{current.round}회</div>
            <div className="round-nav__date">{current.date}</div>
          </div>
          <button
            type="button"
            className="round-nav__btn"
            disabled={!canGoNext}
            aria-label="다음 회차"
            onClick={() => setSelectedRound(current.round + 1)}
          >
            ▶
          </button>
        </div>

        <WinningNumbers draw={current} />

        <div className="round-nav__foot">
          <span className="hint" style={{ margin: 0 }}>
            {draws.length}회차 보유 ({first}~{latest.round}회)
          </span>
          {current.round !== latest.round && (
            <button
              type="button"
              className="history-item__btn"
              onClick={() => setSelectedRound(latest.round)}
            >
              최신 회차로
            </button>
          )}
        </div>
      </div>

      <MyNumbersCheck draw={current} />
      <FrequencyCard draws={draws} />
    </>
  );
}
