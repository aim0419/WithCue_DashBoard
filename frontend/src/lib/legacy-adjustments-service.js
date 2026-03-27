import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { BODY_PART_OPTIONS, LOCATION_META } from "./collection-service.js";
import { getFirebaseDb, waitForFirebaseAuthReady } from "./firebase-client.js";

const BODY_PART_CODE_MAP = {
  Neck: "01",
  Hip: "02",
  LeftShoulder: "03",
  RightShoulder: "04",
  LeftKnee: "05",
  RightKnee: "06",
};

function getLocationMeta(locationKey) {
  return LOCATION_META[locationKey] || LOCATION_META.aim;
}

function getBodyPartOption(bodyPartKey) {
  return BODY_PART_OPTIONS.find((option) => option.key === bodyPartKey) || BODY_PART_OPTIONS[0];
}

export async function createLegacyAdjustment({
  adminSession,
  location,
  bodyPartKey,
  sessionDelta,
  consentDelta,
  note,
}) {
  await waitForFirebaseAuthReady();

  const db = getFirebaseDb();
  const locationMeta = getLocationMeta(location);
  const bodyPartOption = getBodyPartOption(bodyPartKey);
  const normalizedSessionDelta = Number(sessionDelta || 0);
  const normalizedConsentDelta = Number(consentDelta || 0);

  if (normalizedSessionDelta <= 0 && normalizedConsentDelta <= 0) {
    throw new Error("추가 건수 또는 인원 수를 1 이상 입력해 주세요.");
  }

  await addDoc(collection(db, "legacyAdjustments"), {
    Location: location,
    LocationDocId: locationMeta.docId,
    SiteCode: locationMeta.siteCode,
    BodyPart: bodyPartKey,
    BodyPartCode: BODY_PART_CODE_MAP[bodyPartKey] || "00",
    BodyPartLabel: bodyPartOption.label,
    SessionDelta: normalizedSessionDelta,
    ConsentDelta: normalizedConsentDelta,
    Note: String(note || "").trim(),
    CreatedByName: adminSession?.name || "",
    CreatedByUserId: adminSession?.userId || "",
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  });
}
