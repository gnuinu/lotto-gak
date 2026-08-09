import { BottomBar } from './components/BottomBar.tsx';
import { DrawPanel } from './components/DrawPanel.tsx';
import { FilterPanel } from './components/FilterPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { Tabs, tabButtonId, tabPanelId } from './components/Tabs.tsx';
import { WinPanel } from './components/WinPanel.tsx';
import { useLottoStore, type TabId } from './store/useLottoStore.ts';

export function App() {
  const tab = useLottoStore((s) => s.tab);
  const notice = useLottoStore((s) => s.notice);
  const dismissNotice = useLottoStore((s) => s.dismissNotice);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">당첨각</h1>
        <span className="app__dot" aria-hidden="true" />
        <p className="app__subtitle">로또 6/45 번호 생성기</p>
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

        <Panel id="draw" active={tab}>
          <DrawPanel />
        </Panel>
        <Panel id="filter" active={tab}>
          <FilterPanel />
        </Panel>
        <Panel id="history" active={tab}>
          <HistoryPanel />
        </Panel>
        <Panel id="win" active={tab}>
          <WinPanel />
        </Panel>
      </main>

      <BottomBar />
    </div>
  );
}

/**
 * 탭 하나에 대응하는 패널. 선택되지 않은 패널은 렌더하지 않는다
 * (당첨 탭의 데이터 로딩을 필요할 때만 시작하려는 것 — 기존 동작 그대로다).
 */
function Panel({
  id,
  active,
  children,
}: {
  id: TabId;
  active: TabId;
  children: React.ReactNode;
}) {
  if (active !== id) return null;
  return (
    <div
      id={tabPanelId(id)}
      role="tabpanel"
      aria-labelledby={tabButtonId(id)}
    >
      {children}
    </div>
  );
}
