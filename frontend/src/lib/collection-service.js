import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore/lite";
import { getFirebaseDb } from "./firebase-client.js";

export const LOCATION_META = {
  aim: {
    docId: "Company",
    name: "회사",
    displayName: "AIM",
    siteCode: "A",
    chipLabel: "AIM",
  },
  hyocheon: {
    docId: "HyoCheon",
    name: "효천점",
    displayName: "이끌림(효천점)",
    siteCode: "H",
    chipLabel: "효천점",
  },
  jangdeok: {
    docId: "Jangdeok",
    name: "장덕점",
    displayName: "이끌림(장덕점)",
    siteCode: "J",
    chipLabel: "장덕점",
  },
};

export const BODY_PART_OPTIONS = [
  { key: "Neck", label: "목", fileSegment: "neck" },
  { key: "Hip", label: "허리", fileSegment: "hip" },
  { key: "LeftShoulder", label: "왼쪽 어깨", fileSegment: "left-shoulder" },
  { key: "RightShoulder", label: "오른쪽 어깨", fileSegment: "right-shoulder" },
  { key: "LeftKnee", label: "왼쪽 무릎", fileSegment: "left-knee" },
  { key: "RightKnee", label: "오른쪽 무릎", fileSegment: "right-knee" },
];

function getLocationMeta(locationKey) {
  return LOCATION_META[locationKey] || LOCATION_META.aim;
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .trim()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildParticipantLocationId(session) {
  const locationMeta = getLocationMeta(session?.location);
  return `${session?.id || "unknown"}_${locationMeta.docId}`;
}

async function ensureLocationDocument(locationMeta) {
  const db = getFirebaseDb();
  const locationRef = doc(db, "locations", locationMeta.docId);

  await setDoc(
    locationRef,
    {
      Name: locationMeta.name,
      DisplayName: locationMeta.displayName,
      SiteCode: locationMeta.siteCode,
      UpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return locationRef;
}

export async function ensureCollectorConsentAtLocation(session) {
  // 같은 사용자가 같은 지점에 다시 들어와도 동의 건수는 한 번만 증가시키는 보정 로직임.
  const db = getFirebaseDb();
  const locationMeta = getLocationMeta(session?.location);
  const participantRef = doc(db, "locationParticipants", buildParticipantLocationId(session));
  const existingParticipant = await getDoc(participantRef);

  if (existingParticipant.exists()) {
    return { ok: true, alreadyCounted: true, locationMeta };
  }

  const locationRef = await ensureLocationDocument(locationMeta);

  await setDoc(participantRef, {
    UserId: session?.id || "",
    Name: session?.name || "",
    BirthDate: Number(session?.birthDate || 0),
    Gender: session?.gender || "",
    Location: locationMeta.docId,
    SiteCode: locationMeta.siteCode,
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  });

  await updateDoc(locationRef, {
    ConsentCount: increment(1),
    UpdatedAt: serverTimestamp(),
  });

  return { ok: true, alreadyCounted: false, locationMeta };
}

export async function saveCollectionRecording({
  session,
  bodyPartKey,
  fileName,
  mimeType,
  size,
  durationMs,
}) {
  // 녹화 완료 시 세션 로그와 대시보드용 집계를 함께 기록하는 프론트 단독 수집 저장 로직임.
  const db = getFirebaseDb();
  const locationMeta = getLocationMeta(session?.location);
  const bodyPart = BODY_PART_OPTIONS.find((option) => option.key === bodyPartKey);

  if (!bodyPart) {
    throw new Error("지원하지 않는 촬영 부위임.");
  }

  await ensureCollectorConsentAtLocation(session);

  await addDoc(collection(db, "collectionSessions"), {
    UserId: session?.id || "",
    Name: session?.name || "",
    BirthDate: Number(session?.birthDate || 0),
    Gender: session?.gender || "",
    Location: locationMeta.docId,
    SiteCode: locationMeta.siteCode,
    BodyPart: bodyPart.key,
    BodyPartLabel: bodyPart.label,
    FileName: fileName,
    MimeType: mimeType,
    FileSize: Number(size || 0),
    DurationMs: Number(durationMs || 0),
    CreatedAt: serverTimestamp(),
  });

  const locationRef = await ensureLocationDocument(locationMeta);

  await updateDoc(locationRef, {
    SessionCount: increment(1),
    [`BodyParts.${bodyPart.key}`]: increment(1),
    UpdatedAt: serverTimestamp(),
  });

  return {
    ok: true,
    bodyPart,
    locationMeta,
  };
}

export function buildRecordingFileName(session, bodyPartKey) {
  const locationMeta = getLocationMeta(session?.location);
  const bodyPart = BODY_PART_OPTIONS.find((option) => option.key === bodyPartKey);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const safeName = sanitizeFileSegment(session?.name || "collector");
  const birthDate = String(session?.birthDate || "");
  const bodyPartSegment = bodyPart?.fileSegment || "capture";

  return `${locationMeta.siteCode}_${safeName}_${birthDate}_${bodyPartSegment}_${timestamp}.webm`;
}

export function formatGenderLabel(gender) {
  return gender === "female" ? "여" : "남";
}

export function formatBirthDateChip(birthDate) {
  const digits = String(birthDate || "").replace(/\D/g, "");

  if (digits.length !== 8) {
    return birthDate || "-";
  }

  return `${digits.slice(2, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function getLocationChipLabel(location) {
  return getLocationMeta(location).chipLabel;
}
