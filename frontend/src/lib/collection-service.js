import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb, waitForFirebaseAuthReady } from "./firebase-client.js";

// 지점 코드와 표시명을 한 곳에서 관리함.
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
    name: "필라테스 이끌림 효천점",
    displayName: "이끌림(효천점)",
    siteCode: "H",
    chipLabel: "효천점",
  },
  jangdeok: {
    docId: "Jangdeok",
    name: "필라테스 이끌림 장덕점",
    displayName: "이끌림(장덕점)",
    siteCode: "J",
    chipLabel: "장덕점",
  },
};

// 촬영 부위 메타와 파일명 코드를 함께 관리함.
export const BODY_PART_OPTIONS = [
  { key: "Neck", label: "목", fileSegment: "neck" },
  { key: "Hip", label: "허리", fileSegment: "hip" },
  { key: "LeftShoulder", label: "왼쪽 어깨", fileSegment: "left-shoulder" },
  { key: "RightShoulder", label: "오른쪽 어깨", fileSegment: "right-shoulder" },
  { key: "LeftKnee", label: "왼쪽 무릎", fileSegment: "left-knee" },
  { key: "RightKnee", label: "오른쪽 무릎", fileSegment: "right-knee" },
];

const BODY_PART_CODE_MAP = {
  Neck: "01",
  Hip: "02",
  LeftShoulder: "03",
  RightShoulder: "04",
  LeftKnee: "05",
  RightKnee: "06",
};

const EMPTY_BODY_PARTS = {
  Hip: 0,
  LeftKnee: 0,
  LeftShoulder: 0,
  Neck: 0,
  RightKnee: 0,
  RightShoulder: 0,
};

function getLocationMeta(locationKey) {
  return LOCATION_META[locationKey] || LOCATION_META.aim;
}

function createLocationSummary(meta) {
  return {
    Name: meta.name,
    DisplayName: meta.displayName,
    SiteCode: meta.siteCode,
    BodyParts: { ...EMPTY_BODY_PARTS },
    ConsentCount: 0,
    SessionCount: 0,
    UpdatedAt: serverTimestamp(),
  };
}

function normalizeBodyParts(value) {
  return {
    ...EMPTY_BODY_PARTS,
    ...(value && typeof value === "object" ? value : {}),
  };
}

async function syncLocationConsentSummary(locationMeta) {
  const db = getFirebaseDb();
  const locationRef = doc(db, "locations", locationMeta.docId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(locationRef);
    const currentData = snapshot.exists()
      ? snapshot.data()
      : createLocationSummary(locationMeta);

    transaction.set(
      locationRef,
      {
        ...createLocationSummary(locationMeta),
        ...currentData,
        Name: locationMeta.name,
        DisplayName: locationMeta.displayName,
        SiteCode: locationMeta.siteCode,
        BodyParts: normalizeBodyParts(currentData?.BodyParts),
        ConsentCount: Number(currentData?.ConsentCount || 0) + 1,
        SessionCount: Number(currentData?.SessionCount || 0),
        UpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function syncLocationSessionSummary(locationMeta, bodyPartKey) {
  const db = getFirebaseDb();
  const locationRef = doc(db, "locations", locationMeta.docId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(locationRef);
    const currentData = snapshot.exists()
      ? snapshot.data()
      : createLocationSummary(locationMeta);
    const nextBodyParts = normalizeBodyParts(currentData?.BodyParts);

    nextBodyParts[bodyPartKey] = Number(nextBodyParts[bodyPartKey] || 0) + 1;

    transaction.set(
      locationRef,
      {
        ...createLocationSummary(locationMeta),
        ...currentData,
        Name: locationMeta.name,
        DisplayName: locationMeta.displayName,
        SiteCode: locationMeta.siteCode,
        BodyParts: nextBodyParts,
        ConsentCount: Number(currentData?.ConsentCount || 0),
        SessionCount: Number(currentData?.SessionCount || 0) + 1,
        UpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

function syncLocationSummarySafely(task, fallbackMessage) {
  return task.catch((error) => {
    console.warn(fallbackMessage, error);
  });
}

function formatMemberCode(value) {
  const parsedValue = Number(value || 0);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return "00";
  }

  return String(parsedValue).padStart(2, "0");
}

function toFriendlyCollectionError(error, fallbackMessage) {
  const code = error?.code || "";

  if (code.includes("unauthenticated")) {
    return "인증 상태를 확인할 수 없습니다. 다시 로그인해 주세요.";
  }

  if (code.includes("permission-denied")) {
    return "수집 처리 권한이 없습니다. Firestore 규칙을 확인해 주세요.";
  }

  if (code.includes("deadline-exceeded") || code.includes("timeout")) {
    return "수집 요청 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
  }

  return error?.message || fallbackMessage;
}

export async function ensureCollectorConsentAtLocation(session) {
  try {
    await waitForFirebaseAuthReady();

    const db = getFirebaseDb();
    const locationMeta = getLocationMeta(session?.location);
    const participantRef = doc(
      db,
      "locationParticipants",
      `${session?.userId || "unknown"}_${locationMeta.docId}`,
    );

    const result = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(participantRef);

      if (snapshot.exists()) {
        return {
          created: false,
          id: participantRef.id,
        };
      }

      transaction.set(participantRef, {
        UserId: session?.userId || "",
        UserNumber: Number(session?.userNumber || 0),
        MemberCode: session?.memberCode || formatMemberCode(session?.userNumber),
        Name: session?.name || "",
        BirthDate: Number(session?.birthDate || 0),
        Gender: session?.gender || "",
        Location: session?.location || "aim",
        LocationDocId: locationMeta.docId,
        SiteCode: locationMeta.siteCode,
        CreatedAt: serverTimestamp(),
        UpdatedAt: serverTimestamp(),
      });

      return {
        created: true,
        id: participantRef.id,
      };
    });

    if (result.created) {
      await syncLocationSummarySafely(
        syncLocationConsentSummary(locationMeta),
        "Failed to sync location consent summary.",
      );
    }

    return result;
  } catch (error) {
    throw new Error(
      toFriendlyCollectionError(error, "지점 동의 처리 중 오류가 발생했습니다."),
    );
  }
}

export async function saveCollectionRecording({
  session,
  bodyPartKey,
  fileName,
  mimeType,
  size,
  durationMs,
}) {
  try {
    await waitForFirebaseAuthReady();

    const db = getFirebaseDb();
    const locationMeta = getLocationMeta(session?.location);
    const bodyPartOption =
      BODY_PART_OPTIONS.find((option) => option.key === bodyPartKey) || BODY_PART_OPTIONS[0];
    const bodyPartCode = BODY_PART_CODE_MAP[bodyPartKey] || "00";

    const sessionDoc = await addDoc(collection(db, "collectionSessions"), {
      UserId: session?.userId || "",
      UserNumber: Number(session?.userNumber || 0),
      MemberCode: session?.memberCode || formatMemberCode(session?.userNumber),
      Name: session?.name || "",
      BirthDate: Number(session?.birthDate || 0),
      Gender: session?.gender || "",
      Location: session?.location || "aim",
      LocationDocId: locationMeta.docId,
      SiteCode: locationMeta.siteCode,
      BodyPart: bodyPartKey,
      BodyPartCode: bodyPartCode,
      BodyPartLabel: bodyPartOption.label,
      FileName: fileName,
      MimeType: mimeType,
      FileSize: Number(size || 0),
      DurationMs: Number(durationMs || 0),
      CreatedAt: serverTimestamp(),
    });

    await syncLocationSummarySafely(
      syncLocationSessionSummary(locationMeta, bodyPartKey),
      "Failed to sync location session summary.",
    );

    return {
      ok: true,
      sessionId: sessionDoc.id,
    };
  } catch (error) {
    throw new Error(
      toFriendlyCollectionError(error, "녹화 기록 저장 중 오류가 발생했습니다."),
    );
  }
}

export function buildRecordingFileName(session, bodyPartKey) {
  const locationMeta = getLocationMeta(session?.location);
  const bodyPartCode = BODY_PART_CODE_MAP[bodyPartKey] || "00";
  const memberCode = session?.memberCode || formatMemberCode(session?.userNumber);

  return `${locationMeta.siteCode}-${bodyPartCode}-${memberCode}.webm`;
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
