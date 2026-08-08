import { useLottoStore } from '../store/useLottoStore.ts';

/**
 * 주요 동작은 한 손으로 닿는 화면 하단에 고정한다.
 * 법적 고지도 항상 보이도록 여기에 함께 둔다.
 */
export function BottomBar() {
  const draw = useLottoStore((s) => s.draw);
  const gameCount = useLottoStore((s) => s.options.gameCount);

  return (
    <div className="bottom-bar">
      <div className="bottom-bar__inner">
        <button type="button" className="btn btn--primary" onClick={draw}>
          {gameCount}게임 추첨하기
        </button>
        <p className="disclaimer">
          만 19세 이상 구매 가능 · 이 앱은 당첨을 보장하지 않으며 재미를 위한 번호
          생성 도구입니다
        </p>
      </div>
    </div>
  );
}
