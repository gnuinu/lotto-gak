import { BottomBar } from './components/BottomBar.tsx';
import { DrawPanel } from './components/DrawPanel.tsx';
import { FilterPanel } from './components/FilterPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { Tabs } from './components/Tabs.tsx';
import { useLottoStore } from './store/useLottoStore.ts';

export function App() {
  const tab = useLottoStore((s) => s.tab);
  const notice = useLottoStore((s) => s.notice);
  const dismissNotice = useLottoStore((s) => s.dismissNotice);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">당첨각</h1>
        <p className="app__subtitle">로또 6/45 번호 생성기 · 오프라인 동작</p>
      </header>

      <Tabs />

      <main className="app__main">
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="notice__close"
              aria-label="안내 닫기"
              onClick={dismissNotice}
            >
              ×
            </button>
          </div>
        )}

        {tab === 'draw' && <DrawPanel />}
        {tab === 'filter' && <FilterPanel />}
        {tab === 'history' && <HistoryPanel />}
      </main>

      <BottomBar />
    </div>
  );
}
