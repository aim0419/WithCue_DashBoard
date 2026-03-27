import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
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

export async function findUserByUserNumber(userNumber) {
  await waitForFirebaseAuthReady();

  const normalizedUserNumber = Number(userNumber || 0);

  if (!Number.isInteger(normalizedUserNumber) || normalizedUserNumber <= 0) {
    throw new Error("회원번호는 1 이상의 숫자로 입력해 주세요.");
  }

  const db = getFirebaseDb();
  const userQuery = query(
    collection(db, "users"),
    where("UserNumber", "==", normalizedUserNumber),
    limit(1),
  );
  const snapshot = await getDocs(userQuery);

  if (snapshot.empty) {
    return null;
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  return {
    id: userDoc.id,
    name: userData.Name || "",
    userNumber: Number(userData.UserNumber || 0),
    memberCode: userData.MemberCode || "",
    birthDate: Number(userData.BirthDate || 0),
    gender: userData.Gender || "",
  };
}

export async function createLegacyAdjustment({
  adminSession,
  location,
  bodyPartKey,
  sessionDelta,
  consentDelta,
  note,
  targetUser,
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

  if (!targetUser?.id || !targetUser?.name || !targetUser?.userNumber) {
    throw new Error("반영할 회원번호를 먼저 검색해 주세요.");
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
    TargetUserId: targetUser.id,
    TargetUserName: targetUser.name,
    TargetUserNumber: Number(targetUser.userNumber || 0),
    TargetMemberCode: targetUser.memberCode || "",
    CreatedByName: adminSession?.name || "",
    CreatedByUserId: adminSession?.userId || "",
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  });
}
