import { useState } from 'react';

import { useLottoStore } from '../store/useLottoStore.ts';

/**
 * 시드를 직접 넣어 같은 번호를 다시 만든다.
 * 같은 시드 + 같은 조건이면 결과는 항상 같다.
 */
export function SeedBar() {
  const drawWithSeed = useLottoStore((s) => s.drawWithSeed);
  const currentSeed = useLottoStore((s) => s.result?.seed ?? null);
  const [value, setValue] = useState('');

  const parsed = Number.parseInt(value.trim(), 10);
  const canReproduce = !Number.isNaN(parsed) && parsed >= 0;

  return (
    <div className="card">
      <h2 className="section-title">시드로 재현하기</h2>
      <div className="seed-row">
        <input
          className="num-input"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={
            currentSeed === null ? '시드 숫자 입력' : String(currentSeed)
          }
          value={value}
          aria-label="시드"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canReproduce) drawWithSeed(parsed);
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={!canReproduce}
          onClick={() => drawWithSeed(parsed)}
        >
          재현
        </button>
      </div>
      <p className="hint">
        같은 시드와 같은 조건이면 언제든 같은 번호가 나옵니다. 조건을 바꾸면
        결과도 달라집니다.
      </p>
    </div>
  );
}
