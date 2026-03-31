import { categoryPages, postureFilterMeta } from "../data/dashboard-meta.js";

export function CategoryCard({ pageKey, postureType, onNavigatePage, onChangePostureType }) {
  return (
    <article className="info-card info-card--secondary">
      <p className="info-card__kicker">CATEGORY</p>
      <h2 className="info-card__title">카테고리</h2>
      <div className="info-card__category-list">
        {Object.entries(categoryPages).map(([key, item]) => (
          <button
            type="button"
            className={`category-link${key === pageKey ? " is-active" : ""}`}
            key={key}
            onClick={() => onNavigatePage?.(key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="info-card__filter-block">
        <p className="info-card__subheading">데이터 보기</p>
        <div className="info-card__category-list info-card__category-list--triple">
          {Object.entries(postureFilterMeta).map(([key, item]) => (
            <button
              type="button"
              className={`category-link${key === postureType ? " is-active" : ""}`}
              key={key}
              onClick={() => onChangePostureType?.(key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
