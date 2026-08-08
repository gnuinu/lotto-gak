import { ballColor } from '../lib/ballColor.ts';
import type { Ball } from '../domain/index.ts';

interface Props {
  n: Ball;
  /** md: 고정 크기, sm: 이력용 작은 공, fluid: 칸을 채우는 결과 표시용 */
  size?: 'md' | 'sm' | 'fluid';
}

/** 실제 규격 색상을 따르는 원형 공. 숫자는 흰색 볼드. */
export function BallView({ n, size = 'md' }: Props) {
  return (
    <span
      className={`ball ball--${size}`}
      style={{ background: ballColor(n) }}
      aria-label={`${n}번`}
    >
      {n}
    </span>
  );
}
