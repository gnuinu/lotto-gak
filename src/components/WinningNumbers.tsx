import type { Ball, OfficialDraw } from '../domain/index.ts';
import { BallView } from './BallView.tsx';

interface Props {
  draw: OfficialDraw;
  size?: 'md' | 'sm';
}

/** 한 회차의 당첨 번호 6개 + 보너스 번호. */
export function WinningNumbers({ draw, size = 'md' }: Props) {
  return (
    <div className="winning">
      <div className="winning__main">
        {draw.numbers.map((n: Ball) => (
          <BallView key={n} n={n} size={size} />
        ))}
      </div>
      <span className="winning__plus" aria-hidden="true">
        +
      </span>
      <div className="winning__bonus">
        <BallView n={draw.bonus} size={size} />
        <span className="winning__bonus-label">보너스</span>
      </div>
    </div>
  );
}
