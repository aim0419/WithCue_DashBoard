import { categoryPages, postureFilterMeta } from "../data/dashboard-meta.js";

export function CategoryCard({ pageKey, postureType, onNavigatePage, onChangePostureType }) {
  return (
    <section className="board-filter-bar" aria-label="대시보드 필터">
      <div className="board-filter-group">
        <p className="board-filter-group__label">카테고리</p>
        <div className="board-filter-group__actions">
          {Object.entries(categoryPages).map(([key, item]) => (
            <button
              type="button"
              className={`category-link category-link--compact${key === pageKey ? " is-active" : ""}`}
              key={key}
              onClick={() => onNavigatePage?.(key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="board-filter-group">
        <p className="board-filter-group__label">데이터 보기</p>
        <div className="board-filter-group__actions">
          {Object.entries(postureFilterMeta).map(([key, item]) => (
            <button
              type="button"
              className={`category-link category-link--compact${key === postureType ? " is-active" : ""}`}
              key={key}
              onClick={() => onChangePostureType?.(key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
