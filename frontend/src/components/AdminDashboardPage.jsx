import { BodyMapPanel } from "./BodyMapPanel.jsx";
import { CategoryCard } from "./CategoryCard.jsx";
import { SummaryPanel } from "./SummaryPanel.jsx";

export function AdminDashboardPage({
  currentPage,
  pageKey,
  displayedSessionCount,
  displayedConsentCount,
  filteredLocations,
  dashboardData,
  displayedBodyParts,
  loading,
  onNavigatePage,
  onLogout,
}) {
  return (
    <main className="dashboard">
      <section className="command-board">
        <header className="board-header">
          <div className="board-title board-title--compact">
            <p className="hero__description visually-hidden">{currentPage.description}</p>
          </div>
          <button type="button" className="dashboard-logout" onClick={onLogout}>
            로그아웃
          </button>
        </header>

        <section className="board-layout">
          <aside className="info-panel">
            <SummaryPanel
              pageKey={pageKey}
              displayedSessionCount={displayedSessionCount}
              displayedConsentCount={displayedConsentCount}
              locations={filteredLocations}
              data={dashboardData}
            />
            <CategoryCard pageKey={pageKey} onNavigatePage={onNavigatePage} />
          </aside>

          <BodyMapPanel bodyParts={displayedBodyParts} />
        </section>

        {loading ? (
          <div className="visually-hidden" aria-live="polite">
            데이터를 불러오는 중입니다.
          </div>
        ) : null}
      </section>
    </main>
  );
}
