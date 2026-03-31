import { formatPostureLabel } from "../lib/collection-service.js";

export function PostureSelectPage({ session, onLogout, onSelect }) {
  return (
    <main className="dashboard dashboard--auth">
      <section className="command-board command-board--auth">
        <div className="auth-shell">
          <section className="auth-card posture-select-card">
            <div className="auth-card__inner">
              <p className="info-card__kicker">SELECT MODE</p>
              <h1 className="auth-form-title">수집 유형 선택</h1>
              <p className="auth-form-description">
                {session?.name || "참여자"}님의 측정 유형을 먼저 선택한 뒤 촬영을 진행합니다.
              </p>

              <div className="posture-select__chips">
                <span className="collection-chip">지점: {session?.location || "-"}</span>
                <span className="collection-chip">회원번호: {session?.memberCode || "-"}</span>
              </div>

              <div className="posture-select__grid">
                <button
                  type="button"
                  className="posture-select__button posture-select__button--correct"
                  onClick={() => onSelect?.("correct")}
                >
                  <strong>{formatPostureLabel("correct")}</strong>
                  <span>기존 촬영 흐름으로 진행</span>
                </button>

                <button
                  type="button"
                  className="posture-select__button posture-select__button--incorrect"
                  onClick={() => onSelect?.("incorrect")}
                >
                  <strong>{formatPostureLabel("incorrect")}</strong>
                  <span>오답 자세 데이터로 저장</span>
                </button>
              </div>

              <div className="posture-select__actions">
                <button type="button" className="dashboard-logout" onClick={onLogout}>
                  로그아웃
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
