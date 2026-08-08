import { useState } from 'react';

import {
  numberFrequency,
  recentDraws,
  sortByFrequency,
  type OfficialDraw,
} from '../domain/index.ts';
import { BallView } from './BallView.tsx';

const RANGES: { label: string; count: number | null }[] = [
  { label: '최근 50회', count: 50 },
  { label: '최근 100회', count: 100 },
  { label: '전체', count: null },
];

/**
 * 번호별 출현 횟수.
 *
 * 이건 예측이 아니다. 매 회차는 서로 독립이므로 과거에 많이 나온 번호가
 * 다음에 더 나올 이유는 없다. 안내 문구를 지울 것 — 그리고 "이 번호를 고르면
 * 유리하다"는 식의 기능(빈도 상위 자동 적용 등)을 붙이지 말 것.
 */
export function FrequencyCard({ draws }: { draws: OfficialDraw[] }) {
  const [rangeIndex, setRangeIndex] = useState(1);

  const range = RANGES[rangeIndex];
  const target =
    range.count === null ? draws : recentDraws(draws, range.count);
  const sorted = sortByFrequency(numberFrequency(target));

  const rounds = target.map((d) => d.round);
  const from = Math.min(...rounds);
  const to = Math.max(...rounds);

  return (
    <div className="card">
      <h2 className="section-title">번호별 출현 횟수</h2>

      <div className="chip-row">
        {RANGES.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className="chip"
            aria-pressed={rangeIndex === index}
            onClick={() => setRangeIndex(index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="hint">
        {target.length}회차 기준 ({from}~{to}회차) · 많이 나온 순
      </p>

      <div className="freq-grid">
        {sorted.map(({ ball, count }) => (
          <div className="freq-cell" key={ball}>
            <BallView n={ball} size="sm" />
            <span className="freq-cell__count">{count}</span>
          </div>
        ))}
      </div>

      <p className="hint">
        지난 회차의 기록일 뿐입니다. 로또는 매 회차가 서로 독립이라, 과거에 많이
        나온 번호가 다음 회차에 더 나올 이유는 없습니다.
      </p>
    </div>
  );
}
