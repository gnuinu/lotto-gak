import { useEffect, useState } from 'react';

import { MAX_POSSIBLE_SUM, MIN_POSSIBLE_SUM } from '../domain/index.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { NumberGrid } from './NumberGrid.tsx';
import { Switch } from './Switch.tsx';

/** 합계 범위 기본 제안값. 실제 당첨 조합이 자주 걸리는 구간. */
const DEFAULT_SUM_RANGE: [number, number] = [100, 175];

const CONSECUTIVE_CHOICES: { value: number; label: string }[] = [
  { value: 1, label: '없음' },
  { value: 2, label: '2개' },
  { value: 3, label: '3개' },
  { value: 6, label: '제한 없음' },
];

export function FilterPanel() {
  const options = useLottoStore((s) => s.options);
  const setOddEvenBalance = useLottoStore((s) => s.setOddEvenBalance);
  const setSumRange = useLottoStore((s) => s.setSumRange);
  const setMaxConsecutive = useLottoStore((s) => s.setMaxConsecutive);
  const resetFilters = useLottoStore((s) => s.resetFilters);

  return (
    <>
      <NumberGrid />

      <div className="card">
        <div className="field">
          <div>
            <div className="field__label">홀짝 균형</div>
            <p className="field__desc">홀수와 짝수를 각각 2개 이상 포함</p>
          </div>
          <Switch
            checked={options.oddEvenBalance}
            onChange={setOddEvenBalance}
            label="홀짝 균형"
          />
        </div>
      </div>

      <SumRangeCard
        range={options.sumRange}
        onChange={setSumRange}
      />

      <div className="card">
        <h2 className="section-title">연속수 허용</h2>
        <div className="chip-row">
          {CONSECUTIVE_CHOICES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={options.maxConsecutive === value}
              onClick={() => setMaxConsecutive(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">
          이어지는 번호(예: 12·13·14)를 몇 개까지 허용할지 정합니다.
        </p>
      </div>

      <button type="button" className="btn btn--block btn--ghost" onClick={resetFilters}>
        조건 초기화
      </button>
    </>
  );
}

interface SumRangeProps {
  range: [number, number] | null;
  onChange: (range: [number, number] | null) => void;
}

function SumRangeCard({ range, onChange }: SumRangeProps) {
  const enabled = range !== null;
  // 입력 중간 상태("1", "" 등)를 그대로 두려면 문자열을 따로 들고 있어야 한다.
  const [lo, setLo] = useState(String((range ?? DEFAULT_SUM_RANGE)[0]));
  const [hi, setHi] = useState(String((range ?? DEFAULT_SUM_RANGE)[1]));

  useEffect(() => {
    if (range) {
      setLo(String(range[0]));
      setHi(String(range[1]));
    }
  }, [range]);

  const commit = (nextLo: string, nextHi: string) => {
    const parsedLo = Number.parseInt(nextLo, 10);
    const parsedHi = Number.parseInt(nextHi, 10);
    if (Number.isNaN(parsedLo) || Number.isNaN(parsedHi)) return;
    const clampedLo = clamp(parsedLo);
    const clampedHi = clamp(parsedHi);
    onChange(
      clampedLo <= clampedHi ? [clampedLo, clampedHi] : [clampedHi, clampedLo],
    );
  };

  return (
    <div className="card">
      <div className="field">
        <div>
          <div className="field__label">합계 범위</div>
          <p className="field__desc">
            6개 번호의 합 ({MIN_POSSIBLE_SUM}~{MAX_POSSIBLE_SUM})
          </p>
        </div>
        <Switch
          checked={enabled}
          onChange={(value) => onChange(value ? DEFAULT_SUM_RANGE : null)}
          label="합계 범위 사용"
        />
      </div>

      {enabled && (
        <div className="range-row">
          <input
            className="num-input"
            type="number"
            inputMode="numeric"
            min={MIN_POSSIBLE_SUM}
            max={MAX_POSSIBLE_SUM}
            value={lo}
            aria-label="합계 최소"
            onChange={(e) => setLo(e.target.value)}
            onBlur={() => commit(lo, hi)}
          />
          <span className="range-row__tilde">~</span>
          <input
            className="num-input"
            type="number"
            inputMode="numeric"
            min={MIN_POSSIBLE_SUM}
            max={MAX_POSSIBLE_SUM}
            value={hi}
            aria-label="합계 최대"
            onChange={(e) => setHi(e.target.value)}
            onBlur={() => commit(lo, hi)}
          />
        </div>
      )}
    </div>
  );
}

function clamp(n: number): number {
  return Math.min(MAX_POSSIBLE_SUM, Math.max(MIN_POSSIBLE_SUM, n));
}
