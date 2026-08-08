import { useState } from 'react';

import {
  MAX_GAME_COUNT,
  PICK_COUNT,
  type DrawOptions,
} from '../domain/index.ts';
import { failureMessage, formatResultText } from '../lib/format.ts';
import { shareOrCopy } from '../lib/share.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { ResultCard } from './ResultCard.tsx';
import { SeedBar } from './SeedBar.tsx';

const GAME_COUNTS = Array.from({ length: MAX_GAME_COUNT }, (_, i) => i + 1);

export function DrawPanel() {
  const options = useLottoStore((s) => s.options);
  const setGameCount = useLottoStore((s) => s.setGameCount);
  const result = useLottoStore((s) => s.result);
  const failure = useLottoStore((s) => s.failure);
  const setTab = useLottoStore((s) => s.setTab);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const handleShare = async () => {
    if (!result) return;
    const outcome = await shareOrCopy(formatResultText(result));
    setShareStatus(
      outcome === 'shared'
        ? '공유했어요'
        : outcome === 'copied'
          ? '복사했어요'
          : '복사에 실패했어요',
    );
    window.setTimeout(() => setShareStatus(null), 2000);
  };

  const activeFilterCount = countActiveFilters(options);

  return (
    <>
      <div className="card">
        <h2 className="section-title">게임 수</h2>
        <div className="count-row">
          {GAME_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className="count-row__item"
              aria-pressed={options.gameCount === count}
              onClick={() => setGameCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="hint">
          {activeFilterCount === 0
            ? '적용된 조건이 없습니다. 조건 탭에서 고정수·제외수 등을 정할 수 있어요.'
            : `조건 ${activeFilterCount}개 적용 중`}
        </p>
      </div>

      {failure && (
        <div className="card failure" role="alert">
          {failureMessage(failure)}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTab('filter')}
            >
              조건 고치기
            </button>
          </div>
        </div>
      )}

      {result ? (
        <>
          <ResultCard result={result} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={handleShare}>
              {shareStatus ?? '결과 복사 · 공유'}
            </button>
          </div>
        </>
      ) : (
        !failure && (
          <p className="empty">
            아직 뽑은 번호가 없습니다.
            <br />
            아래 추첨 버튼을 눌러보세요.
          </p>
        )
      )}

      <div style={{ height: 12 }} />
      <SeedBar />
    </>
  );
}

function countActiveFilters(options: DrawOptions): number {
  let count = 0;
  if (options.include.length > 0) count += 1;
  if (options.exclude.length > 0) count += 1;
  if (options.oddEvenBalance) count += 1;
  if (options.sumRange) count += 1;
  // maxConsecutive 가 PICK_COUNT 이상이면 사실상 제한이 없다.
  if (options.maxConsecutive < PICK_COUNT) count += 1;
  return count;
}
