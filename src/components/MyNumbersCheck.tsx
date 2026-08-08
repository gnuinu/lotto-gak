import {
  matchDraw,
  type MatchOutcome,
  type OfficialDraw,
  type Rank,
} from '../domain/index.ts';
import { formatDateTime } from '../lib/format.ts';
import { useLottoStore } from '../store/useLottoStore.ts';
import { BallView } from './BallView.tsx';

/** 화면에 나열할 최대 건수. 이력 100건 × 5게임까지 가능하므로 상한을 둔다. */
const MAX_ROWS = 50;

interface CheckedGame {
  entryId: string;
  createdAt: number;
  label: string;
  numbers: number[];
  outcome: MatchOutcome;
}

/**
 * 저장된 이력을 선택한 회차의 당첨 번호와 대조한다.
 *
 * 실제 구매 여부와는 무관하다 — "이 번호가 이 회차였다면 몇 등인지" 보여주는 것뿐이다.
 * 문구도 그 이상을 암시하지 않게 유지할 것.
 */
export function MyNumbersCheck({ draw }: { draw: OfficialDraw }) {
  const history = useLottoStore((s) => s.history);

  const checked: CheckedGame[] = [];
  let totalGames = 0;

  for (const entry of history) {
    for (const game of entry.result.games) {
      totalGames += 1;
      const outcome = matchDraw(game.numbers, draw);
      if (outcome.rank !== null) {
        checked.push({
          entryId: entry.id,
          createdAt: entry.result.createdAt,
          label: game.label,
          numbers: game.numbers,
          outcome,
        });
      }
    }
  }

  checked.sort(
    (a, b) =>
      (a.outcome.rank ?? 9) - (b.outcome.rank ?? 9) || b.createdAt - a.createdAt,
  );

  const tally = new Map<Rank, number>();
  for (const item of checked) {
    if (item.outcome.rank !== null) {
      tally.set(item.outcome.rank, (tally.get(item.outcome.rank) ?? 0) + 1);
    }
  }

  if (history.length === 0) {
    return (
      <div className="card">
        <h2 className="section-title">내 번호 대조</h2>
        <p className="hint">
          저장된 이력이 없습니다. 번호를 뽑으면 이 회차 당첨 번호와 자동으로
          대조해 드립니다.
        </p>
      </div>
    );
  }

  const shown = checked.slice(0, MAX_ROWS);
  const hidden = checked.length - shown.length;

  return (
    <div className="card">
      <h2 className="section-title">내 번호 대조</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        저장된 이력 {history.length}건 · 게임 {totalGames}개를 {draw.round}회차와
        대조했습니다.
      </p>

      {checked.length === 0 ? (
        <p className="hint">
          이 회차 당첨 번호와 3개 이상 겹친 게임이 없습니다.
        </p>
      ) : (
        <>
          <div className="rank-tally">
            {([1, 2, 3, 4, 5] as Rank[]).map((rank) =>
              tally.has(rank) ? (
                <span key={rank} className={`rank-badge rank-badge--${rank}`}>
                  {rank}등 {tally.get(rank)}
                </span>
              ) : null,
            )}
          </div>

          <div className="check-list">
            {shown.map((item) => (
              <div
                className="check-row"
                key={`${item.entryId}-${item.label}`}
              >
                <div className="check-row__head">
                  <span
                    className={`rank-badge rank-badge--${item.outcome.rank}`}
                  >
                    {item.outcome.rank}등
                  </span>
                  <span className="check-row__count">
                    {item.outcome.matchCount}개 일치
                    {item.outcome.bonusMatched && ' + 보너스'}
                  </span>
                  <span className="check-row__date">
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>
                <div className="check-row__balls">
                  {item.numbers.map((n) => {
                    const isMatch = item.outcome.matched.includes(n);
                    const isBonus = n === draw.bonus;
                    return (
                      <span
                        key={n}
                        className={
                          isMatch || isBonus
                            ? 'ball-wrap'
                            : 'ball-wrap ball-wrap--miss'
                        }
                      >
                        <BallView n={n} size="fluid" />
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hidden > 0 && (
            <p className="hint">… 외 {hidden}개는 표시하지 않았습니다.</p>
          )}
          <p className="hint">
            흐리게 표시된 번호는 당첨 번호와 겹치지 않은 번호입니다. 실제 구매
            여부와 무관하게, 저장된 번호를 그 회차 결과와 견주어 본 것입니다.
          </p>
        </>
      )}
    </div>
  );
}
