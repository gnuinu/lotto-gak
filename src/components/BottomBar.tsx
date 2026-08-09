import { useEffect, useRef } from 'react';

import { useLottoStore } from '../store/useLottoStore.ts';

/**
 * 주요 동작은 한 손으로 닿는 화면 하단에 고정한다.
 * 법적 고지도 항상 보이도록 여기에 함께 둔다.
 */
export function BottomBar() {
  const draw = useLottoStore((s) => s.draw);
  const gameCount = useLottoStore((s) => s.options.gameCount);
  const barRef = useRef<HTMLDivElement>(null);

  /*
   * 실제 바 높이를 CSS 변수로 알려준다.
   * 고지 문구는 글자 크기·화면 폭에 따라 줄 수가 달라지므로, 높이를 상수로 박아두면
   * 본문 맨 아래가 바에 가려진다(실제로 가려졌다). 재서 넘기면 그럴 일이 없다.
   */
  useEffect(() => {
    const element = barRef.current;
    if (!element) return;

    const apply = () => {
      document.documentElement.style.setProperty(
        '--bottom-bar-h',
        `${element.offsetHeight}px`,
      );
    };

    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bottom-bar" ref={barRef}>
      <div className="bottom-bar__inner">
        <button type="button" className="btn--primary" onClick={draw}>
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
