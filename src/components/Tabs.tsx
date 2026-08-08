import { useLottoStore, type TabId } from '../store/useLottoStore.ts';

const TABS: { id: TabId; label: string }[] = [
  { id: 'draw', label: '추첨' },
  { id: 'filter', label: '조건' },
  { id: 'history', label: '이력' },
  { id: 'win', label: '당첨' },
];

/**
 * 라우터를 쓰지 않는다. GitHub Pages 의 SPA fallback 문제를 피하려고
 * 단일 페이지 + 탭 전환으로만 화면을 나눈다.
 */
export function Tabs() {
  const tab = useLottoStore((s) => s.tab);
  const setTab = useLottoStore((s) => s.setTab);
  const historyCount = useLottoStore((s) => s.history.length);

  return (
    <div className="tabs" role="tablist" aria-label="화면 전환">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className="tabs__item"
          onClick={() => setTab(id)}
        >
          {label}
          {id === 'history' && historyCount > 0 && (
            <span className="tabs__badge">{historyCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
