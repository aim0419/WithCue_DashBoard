import { useMemo, useState } from "react";
import { BODY_PART_OPTIONS, LOCATION_META } from "../lib/collection-service.js";

const locationOptions = [
  { value: "aim", label: LOCATION_META.aim.displayName },
  { value: "jangdeok", label: LOCATION_META.jangdeok.displayName },
  { value: "hyocheon", label: LOCATION_META.hyocheon.displayName },
];

function formatAdjustmentItem(item) {
  const sessionText = item.SessionDelta ? `건수 +${item.SessionDelta}` : null;
  const consentText = item.ConsentDelta ? `인원 +${item.ConsentDelta}` : null;
  return [sessionText, consentText].filter(Boolean).join(" / ");
}

export function LegacyAdjustmentDrawer({
  open,
  onClose,
  onSubmit,
  submitting,
  recentAdjustments,
}) {
  const [form, setForm] = useState({
    location: "aim",
    bodyPartKey: "Neck",
    sessionDelta: "30",
    consentDelta: "1",
    note: "대시보드 도입 전 수집분",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const locationLabelMap = useMemo(
    () => Object.fromEntries(locationOptions.map((option) => [option.value, option.label])),
    [],
  );

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setError("");
      setMessage("");
      await onSubmit?.({
        ...form,
        sessionDelta: Number(form.sessionDelta || 0),
        consentDelta: Number(form.consentDelta || 0),
      });
      setMessage("기존 데이터 반영이 완료되었습니다.");
    } catch (submitError) {
      setError(submitError?.message || "기존 데이터 반영 중 오류가 발생했습니다.");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <aside className="legacy-drawer" aria-label="기존 데이터 반영 패널">
      <div className="legacy-drawer__header">
        <div>
          <p className="info-card__kicker">LEGACY INPUT</p>
          <h2 className="legacy-drawer__title">기존 데이터 반영</h2>
          <p className="legacy-drawer__description">
            대시보드 집계에만 합산되는 보정 데이터를 입력합니다.
          </p>
        </div>
        <button type="button" className="legacy-drawer__close" onClick={onClose}>
          닫기
        </button>
      </div>

      <form className="legacy-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field__label">지점 선택</span>
          <select
            className="auth-input"
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
          >
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="auth-field">
          <span className="auth-field__label">부위 선택</span>
          <select
            className="auth-input"
            value={form.bodyPartKey}
            onChange={(event) => updateField("bodyPartKey", event.target.value)}
          >
            {BODY_PART_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="legacy-form__grid">
          <label className="auth-field">
            <span className="auth-field__label">추가 건수</span>
            <input
              className="auth-input"
              type="number"
              min="0"
              value={form.sessionDelta}
              onChange={(event) => updateField("sessionDelta", event.target.value)}
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label">추가 인원</span>
            <input
              className="auth-input"
              type="number"
              min="0"
              value={form.consentDelta}
              onChange={(event) => updateField("consentDelta", event.target.value)}
            />
          </label>
        </div>

        <label className="auth-field">
          <span className="auth-field__label">메모</span>
          <input
            className="auth-input"
            type="text"
            value={form.note}
            onChange={(event) => updateField("note", event.target.value)}
          />
        </label>

        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        {message ? <p className="auth-message auth-message--notice">{message}</p> : null}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "반영 중.." : "기존 데이터 반영"}
        </button>
      </form>

      <div className="legacy-history">
        <h3 className="legacy-history__title">최근 반영 내역</h3>
        {recentAdjustments?.length ? (
          <div className="legacy-history__list">
            {recentAdjustments.map((item) => (
              <article className="legacy-history__item" key={item.id}>
                <strong className="legacy-history__label">
                  {locationLabelMap[item.Location] || item.Location} / {item.BodyPartLabel}
                </strong>
                <span className="legacy-history__meta">{formatAdjustmentItem(item)}</span>
                {item.Note ? <span className="legacy-history__note">{item.Note}</span> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="legacy-history__empty">아직 반영된 기존 데이터가 없습니다.</p>
        )}
      </div>
    </aside>
  );
}
