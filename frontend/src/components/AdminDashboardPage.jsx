import { BodyMapPanel } from "./BodyMapPanel.jsx";
import { CategoryCard } from "./CategoryCard.jsx";
import { LegacyAdjustmentDrawer } from "./LegacyAdjustmentDrawer.jsx";
import { SummaryPanel } from "./SummaryPanel.jsx";

export function AdminDashboardPage({
  currentPage,
  pageKey,
  postureType,
  displayedSessionCount,
  displayedConsentCount,
  filteredLocations,
  dashboardData,
  displayedBodyParts,
  loading,
  onNavigatePage,
  onChangePostureType,
  onCyclePostureType,
  onGoToCollectorLogin,
  onLogout,
  adjustmentDrawerOpen,
  onOpenAdjustmentDrawer,
  onCloseAdjustmentDrawer,
  onSubmitAdjustment,
  onDeleteAdjustment,
  adjustmentSubmitting,
  deletingAdjustmentId,
}) {
  return (
    <main className="dashboard">
      <section className="command-board">
        <header className="board-header">
          <div className="board-title board-title--compact">
            <p className="hero__description visually-hidden">{currentPage.description}</p>
          </div>
          <div className="board-header__actions">
            <button type="button" className="dashboard-action" onClick={onOpenAdjustmentDrawer}>
              기존 데이터 반영
            </button>
            <button
              type="button"
              className="dashboard-secondary-action"
              onClick={onGoToCollectorLogin}
            >
              수집 페이지 이동
            </button>
            <button type="button" className="dashboard-logout" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </header>

        <div className="board-toolbar">
          <CategoryCard
            pageKey={pageKey}
            postureType={postureType}
            onNavigatePage={onNavigatePage}
            onChangePostureType={onChangePostureType}
          />
        </div>

        <section className="board-layout">
          <aside className="info-panel">
            <SummaryPanel
              pageKey={pageKey}
              postureType={postureType}
              displayedSessionCount={displayedSessionCount}
              displayedConsentCount={displayedConsentCount}
              locations={filteredLocations}
              data={dashboardData}
              onCyclePostureType={onCyclePostureType}
            />
          </aside>

          <BodyMapPanel
            bodyParts={displayedBodyParts}
            postureType={postureType}
            onCyclePostureType={onCyclePostureType}
          />
        </section>

        <LegacyAdjustmentDrawer
          open={adjustmentDrawerOpen}
          onClose={onCloseAdjustmentDrawer}
          onSubmit={onSubmitAdjustment}
          onDelete={onDeleteAdjustment}
          submitting={adjustmentSubmitting}
          deletingAdjustmentId={deletingAdjustmentId}
          recentAdjustments={dashboardData?.recentAdjustments || []}
        />

        {loading ? (
          <div className="visually-hidden" aria-live="polite">
            데이터를 불러오는 중입니다.
          </div>
        ) : null}
      </section>
    </main>
  );
}
