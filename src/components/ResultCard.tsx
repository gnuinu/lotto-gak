import { motion } from 'framer-motion';

import { sum, type DrawResult } from '../domain/index.ts';
import { formatDateTime } from '../lib/format.ts';
import { BallView } from './BallView.tsx';

interface Props {
  result: DrawResult;
}

export function ResultCard({ result }: Props) {
  return (
    <div className="card">
      <div className="result-meta">
        <span>{formatDateTime(result.createdAt)}</span>
        <span>
          시드 <span className="result-meta__seed">{result.seed}</span>
        </span>
      </div>

      {result.games.map((game, gameIndex) => (
        <div className="game-row" key={game.label}>
          <span className="game-row__label">{game.label}</span>
          <span className="game-row__balls">
            {game.numbers.map((n, ballIndex) => (
              <motion.span
                // seed 가 바뀌면 다시 등장 연출이 돌도록 key 에 seed 를 섞는다.
                key={`${result.seed}-${game.label}-${n}`}
                initial={{ opacity: 0, y: -10, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: gameIndex * 0.12 + ballIndex * 0.05,
                  type: 'spring',
                  stiffness: 420,
                  damping: 26,
                }}
                style={{ display: 'flex', minWidth: 0 }}
              >
                <BallView n={n} size="fluid" />
              </motion.span>
            ))}
          </span>
          <span className="game-row__sum">합 {sum(game.numbers)}</span>
        </div>
      ))}
    </div>
  );
}
