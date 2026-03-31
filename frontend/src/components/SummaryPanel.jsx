import { donutColors } from "../data/dashboard-meta.js";

function formatNumber(value, suffix) {
  return `${value}${suffix}`;
}

function createDonutBackground(metricKey, locations) {
  const total = locations.reduce((sum, location) => sum + Number(location[metricKey] || 0), 0);

  if (!total) {
    return "conic-gradient(rgba(255,255,255,0.08) 0 100%)";
  }

  let currentAngle = 0;
  const segments = locations.map((location, index) => {
    const ratio = (Number(location[metricKey] || 0) / total) * 360;
    const start = currentAngle;
    const end = currentAngle + ratio;
    currentAngle = end;
    return `${donutColors[index % donutColors.length]} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function getSyncMessage(data) {
  if (!data) {
    return "데이터 확인 중";
  }

  if (data.source === "firebase") {
    return "Firebase 실시간 운영 데이터";
  }

  if (data.source === "firebase-empty") {
    return "Firebase 연결됨 · 초기 데이터 필요";
  }

  return "샘플 데이터 표시 중";
}

function getPostureViewMeta(postureType) {
  if (postureType === "incorrect") {
    return {
      title: "오답 데이터",
      description: "오답 자세 데이터 기준",
    };
  }

  if (postureType === "correct") {
    return {
      title: "정답 데이터",
      description: "정답 자세 데이터 기준",
    };
  }

  return {
    title: "총합 데이터",
    description: "정답 + 오답 전체 기준",
  };
}

export function SummaryPanel({
  pageKey,
  postureType,
  displayedSessionCount,
  displayedConsentCount,
  locations,
  data,
  onCyclePostureType,
}) {
  const showDonut = pageKey === "main";
  const postureViewMeta = getPostureViewMeta(postureType);

  return (
    <article className="info-card info-card--primary">
      <p className="info-card__kicker">COLLECTION STATUS</p>
      <h2 className="info-card__title">{postureViewMeta.title}</h2>
      <p className="info-card__subheading">{postureViewMeta.description}</p>

      {showDonut ? (
        <button
          type="button"
          className="dashboard-graph-switch"
          onClick={onCyclePostureType}
          aria-label="그래프 보기 전환"
          title="클릭해서 총합, 정답, 오답 그래프를 전환합니다."
        >
          <div className="donut-panel">
            <div className="donut-block">
              <p className="donut-block__label">총 세션 데이터</p>
              <div
                className="donut-chart"
                style={{ background: createDonutBackground("SessionCount", locations) }}
              />
              <strong className="donut-total">{formatNumber(displayedSessionCount, "건")}</strong>
            </div>

            <div className="donut-block">
              <p className="donut-block__label">개인정보 동의</p>
              <div
                className="donut-chart"
                style={{ background: createDonutBackground("ConsentCount", locations) }}
              />
              <strong className="donut-total">{formatNumber(displayedConsentCount, "명")}</strong>
            </div>

            <div className="donut-legend">
              {locations.map((location, index) => {
                const ratio = displayedSessionCount
                  ? Math.round((Number(location.SessionCount || 0) / displayedSessionCount) * 100)
                  : 0;

                return (
                  <div className="donut-legend__item" key={location.id || location.Name}>
                    <span
                      className="donut-legend__dot"
                      style={{ background: donutColors[index % donutColors.length] }}
                    />
                    <span className="donut-legend__name">
                      {location.DisplayName || location.Name}
                    </span>
                    <span className="donut-legend__ratio">{ratio}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </button>
      ) : (
        <div className="metric-stack">
          <div className="metric-box">
            <p className="metric-box__label">총 세션 데이터</p>
            <strong className="metric-box__value">{formatNumber(displayedSessionCount, "건")}</strong>
          </div>
          <div className="metric-box">
            <p className="metric-box__label">개인정보 동의</p>
            <strong className="metric-box__value">{formatNumber(displayedConsentCount, "명")}</strong>
          </div>
        </div>
      )}

      {!showDonut && (
        <div className="status-box">
          <span className="status-dot" />
          <span>{getSyncMessage(data)}</span>
        </div>
      )}
    </article>
  );
}
