import { categoryPages } from "../data/dashboard-meta.js";

export function CategoryCard({ pageKey }) {
  return (
    <article className="info-card info-card--secondary">
      <p className="info-card__kicker">CATEGORY</p>
      <h2 className="info-card__title">카테고리</h2>
      <div className="info-card__category-list">
        {Object.entries(categoryPages).map(([key, item]) => (
          // 지점이 늘어나도 메타데이터만 바꾸면 같은 카테고리 UI를 유지할 수 있다.
          <a
            className={`category-link${key === pageKey ? " is-active" : ""}`}
            href={item.href}
            key={key}
          >
            {item.label}
          </a>
        ))}
      </div>
    </article>
  );
}
