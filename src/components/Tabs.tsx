import { useRef } from 'react';

import { useLottoStore, type TabId } from '../store/useLottoStore.ts';

const TABS: { id: TabId; label: string }[] = [
  { id: 'draw', label: '추첨' },
  { id: 'filter', label: '조건' },
  { id: 'history', label: '이력' },
  { id: 'win', label: '당첨' },
];

/** 탭 버튼과 패널을 잇는 id. App.tsx 의 패널이 같은 규칙으로 참조한다. */
export function tabButtonId(id: TabId): string {
  return `tab-${id}`;
}

export function tabPanelId(id: TabId): string {
  return `panel-${id}`;
}

/**
 * 라우터를 쓰지 않는다. GitHub Pages 의 SPA fallback 문제를 피하려고
 * 단일 페이지 + 탭 전환으로만 화면을 나눈다.
 *
 * role="tablist" 를 선언한 이상 그 동작도 함께 지켜야 한다 — 좌우 화살표로 이동하고,
 * 선택되지 않은 탭은 탭키 순회에서 빠진다(roving tabindex).
 */
export function Tabs() {
  const tab = useLottoStore((s) => s.tab);
  const setTab = useLottoStore((s) => s.setTab);
  const historyCount = useLottoStore((s) => s.history.length);
  const listRef = useRef<HTMLDivElement>(null);

  const moveFocus = (index: number) => {
    const next = TABS[(index + TABS.length) % TABS.length];
    setTab(next.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${tabButtonId(next.id)}`)
      ?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight') moveFocus(index + 1);
    else if (event.key === 'ArrowLeft') moveFocus(index - 1);
    else if (event.key === 'Home') moveFocus(0);
    else if (event.key === 'End') moveFocus(TABS.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="tabs" role="tablist" aria-label="화면 전환" ref={listRef}>
      {TABS.map(({ id, label }, index) => {
        const selected = tab === id;
        return (
          <button
            key={id}
            id={tabButtonId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(id)}
            tabIndex={selected ? 0 : -1}
            className="tabs__item"
            onClick={() => setTab(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {label}
            {id === 'history' && historyCount > 0 && (
              <span className="tabs__badge">{historyCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
