import { bodyPartMeta } from "../data/dashboard-meta.js";

function getPostureViewLabel(postureType) {
  if (postureType === "incorrect") {
    return "오답 그래프";
  }

  if (postureType === "correct") {
    return "정답 그래프";
  }

  return "총합 그래프";
}

export function BodyMapPanel({ bodyParts, postureType, onCyclePostureType }) {
  return (
    <section className="bodymap-panel" aria-label="신체 부위 통계 데이터 현황">
      <button
        type="button"
        className="bodymap-stage"
        onClick={onCyclePostureType}
        aria-label="그래프 보기 전환"
        title="클릭해서 총합, 정답, 오답 그래프를 전환합니다."
      >
        <div className="bodymap-content">
          <p className="bodymap-mode-label">{getPostureViewLabel(postureType)}</p>

          <img
            className="body-silhouette-image"
            src="/assets/images/body.png"
            alt="신체 부위별 데이터 시각화 이미지"
          />

          <div className="connector connector--neck" />
          <div className="connector connector--hip" />
          <div className="connector connector--left-shoulder" />
          <div className="connector connector--right-shoulder" />
          <div className="connector connector--left-knee" />
          <div className="connector connector--right-knee" />

          <div className="joint joint--neck" />
          <div className="joint joint--hip" />
          <div className="joint joint--left-shoulder" />
          <div className="joint joint--right-shoulder" />
          <div className="joint joint--left-knee" />
          <div className="joint joint--right-knee" />

          <div className="body-part-grid">
            {bodyPartMeta.map((part) => (
              <article className={part.className} key={part.key}>
                <p className="body-part-card__label">{part.label}</p>
                <strong className="body-part-card__value">{bodyParts[part.key] || 0}건</strong>
              </article>
            ))}
          </div>
        </div>
      </button>
    </section>
  );
}
