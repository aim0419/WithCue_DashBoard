import { useEffect, useMemo, useRef, useState } from "react";
import {
  BODY_PART_OPTIONS,
  buildRecordingFileName,
  ensureCollectorConsentAtLocation,
  formatBirthDateChip,
  formatGenderLabel,
  formatPostureLabel,
  getLocationChipLabel,
  saveCollectionRecording,
} from "../lib/collection-service.js";

const RECORDER_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function getSupportedMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }

  return (
    RECORDER_CANDIDATES.find((candidate) => window.MediaRecorder.isTypeSupported(candidate)) || ""
  );
}

function downloadBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CollectionPage({ session, profile, onLogout, logoutCountdownLabel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedBodyPartKey, setSelectedBodyPartKey] = useState("Neck");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("카메라를 준비하고 있습니다.");
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  const displayProfile = profile || session;
  const activeBodyPart = useMemo(
    () => BODY_PART_OPTIONS.find((option) => option.key === selectedBodyPartKey) || BODY_PART_OPTIONS[0],
    [selectedBodyPartKey],
  );
  const postureLabel = formatPostureLabel(session?.postureType);
  const recordingStatusLabel = `${displayProfile?.name || "참여자"}님 ${activeBodyPart.label} ${postureLabel} 녹화중`;

  useEffect(() => {
    ensureCollectorConsentAtLocation(session).catch(() => {
      // 참여 기록 실패가 촬영 화면 자체를 막지 않도록 무시.
    });
  }, [session]);

  useEffect(() => {
    async function prepareCamera() {
      try {
        setErrorMessage("");
        setStatusMessage("카메라 권한을 확인하고 있습니다.");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "user" },
          audio: false,
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === "videoinput");
        setCameraDevices(videoInputs);

        if (!selectedDeviceId) {
          const activeTrack = stream.getVideoTracks()[0];
          const activeSettings = activeTrack?.getSettings?.() || {};
          if (activeSettings.deviceId) {
            setSelectedDeviceId(activeSettings.deviceId);
          }
        }

        setIsCameraReady(true);
        setStatusMessage("카메라 연결이 완료되었습니다.");
      } catch {
        setIsCameraReady(false);
        setErrorMessage(
          "카메라를 사용할 수 없습니다. 브라우저 권한과 장치 연결 상태를 확인해 주세요.",
        );
        setStatusMessage("");
      }
    }

    prepareCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [selectedDeviceId]);

  async function handleStartRecording() {
    if (!streamRef.current) {
      setErrorMessage("카메라 연결이 완료된 뒤에 녹화를 시작할 수 있습니다.");
      return;
    }

    try {
      setErrorMessage("");
      setDownloadMessage("");
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);

      mediaRecorderRef.current = mediaRecorder;
      recordingStartedAtRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsSaving(true);
        setStatusMessage("파일을 저장하고 있습니다.");

        try {
          const actualMimeType = mediaRecorder.mimeType || mimeType || "video/webm";
          const fileName = buildRecordingFileName(session, selectedBodyPartKey);
          const recordedBlob = new Blob(chunksRef.current, { type: actualMimeType });
          const durationMs = Date.now() - recordingStartedAtRef.current;

          downloadBlobFile(recordedBlob, fileName);

          await saveCollectionRecording({
            session,
            bodyPartKey: selectedBodyPartKey,
            fileName,
            mimeType: actualMimeType,
            size: recordedBlob.size,
            durationMs,
          });

          setDownloadMessage("녹화 파일 저장과 집계 반영이 완료되었습니다.");
          setStatusMessage("다음 촬영을 이어서 진행할 수 있습니다.");
        } catch (error) {
          setErrorMessage(error?.message || "녹화 저장 중 오류가 발생했습니다.");
          setStatusMessage("오류 내용을 확인해 주세요.");
        } finally {
          setIsSaving(false);
          chunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage(`${activeBodyPart.label} ${postureLabel} 녹화를 시작했습니다.`);
    } catch {
      setErrorMessage("브라우저에서 녹화를 시작할 수 없습니다.");
    }
  }

  function handleStopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return;
    }

    mediaRecorderRef.current.stop();
  }

  return (
    <main className="dashboard">
      <section className="command-board command-board--collection">
        <header className="collection-header">
          <div className="collection-title">
            <p className="info-card__kicker">COLLECTION</p>
            <h1>데이터 수집</h1>
          </div>

          <span className="session-expiry">{logoutCountdownLabel}</span>
          <button type="button" className="dashboard-logout" onClick={onLogout}>
            로그아웃
          </button>
        </header>

        {isRecording ? (
          <div className="collection-recording-banner">
            <p className="collection-recording-badge">{recordingStatusLabel}</p>
          </div>
        ) : null}

        <section className="collection-chip-row" aria-label="참여자 정보">
          <span className="collection-chip">수집 위치: {getLocationChipLabel(session?.location)}</span>
          <span className="collection-chip">이름: {displayProfile?.name || "-"}</span>
          <span className="collection-chip">성별: {formatGenderLabel(displayProfile?.gender)}</span>
          <span className="collection-chip">생년월일: {formatBirthDateChip(displayProfile?.birthDate)}</span>
          <span className="collection-chip">유형: {postureLabel}</span>
        </section>

        <section className="collection-grid">
          <article className="collection-panel">
            <div className="collection-panel__header">
              <div>
                <h2>카메라 미리보기</h2>
              </div>

              <label className="collection-device-field">
                <span>카메라 선택</span>
                <select
                  className="auth-input"
                  value={selectedDeviceId}
                  onChange={(event) => setSelectedDeviceId(event.target.value)}
                >
                  {cameraDevices.length === 0 ? (
                    <option value="">기본 카메라</option>
                  ) : (
                    cameraDevices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `카메라 ${index + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div className="collection-preview-frame">
              <video ref={videoRef} className="collection-preview" autoPlay muted playsInline />
            </div>

            <div className="collection-status-stack">
              <p className="collection-status">{statusMessage}</p>
              {errorMessage ? <p className="auth-message auth-message--error">{errorMessage}</p> : null}
              {downloadMessage ? (
                <p className="auth-message auth-message--notice">{downloadMessage}</p>
              ) : null}
            </div>
          </article>

          <aside className="collection-panel collection-panel--actions">
            <div>
              <h2>촬영 부위 선택</h2>
            </div>

            <div className="collection-body-grid">
              {BODY_PART_OPTIONS.map((bodyPart) => (
                <button
                  key={bodyPart.key}
                  type="button"
                  className={`collection-body-button${
                    selectedBodyPartKey === bodyPart.key ? " is-active" : ""
                  }`}
                  onClick={() => setSelectedBodyPartKey(bodyPart.key)}
                  disabled={isRecording || isSaving}
                >
                  {bodyPart.label}
                </button>
              ))}
            </div>

            <div className="collection-action-box">
              <p className="collection-action-box__label">현재 선택 부위</p>
              <strong className="collection-action-box__value">{activeBodyPart.label}</strong>
            </div>

            <div className="collection-action-row">
              <button
                type="button"
                className="auth-submit"
                onClick={handleStartRecording}
                disabled={!isCameraReady || isRecording || isSaving}
              >
                {isSaving ? "저장 중..." : isRecording ? "녹화 중" : `${activeBodyPart.label} 녹화 시작`}
              </button>
              <button
                type="button"
                className="collection-stop-button"
                onClick={handleStopRecording}
                disabled={!isRecording || isSaving}
              >
                녹화 종료 및 저장
              </button>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
