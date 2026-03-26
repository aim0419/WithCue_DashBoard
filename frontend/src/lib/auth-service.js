import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore/lite";
import { getFirebaseDb } from "./firebase-client.js";

const FIRESTORE_REQUEST_TIMEOUT_MS = 12000;

function normalizeName(name) {
  // 브라우저와 운영체제가 달라도 같은 이름으로 비교되도록 공백과 유니코드를 정규화한다.
  return String(name || "").trim().normalize("NFC");
}

function buildNameKey(name) {
  // 눈에 보이지 않는 공백 차이로 로그인 실패가 나지 않도록 비교용 키를 한 번 더 만든다.
  return normalizeName(name).replace(/\s+/g, "").toLowerCase();
}

function normalizeGender(gender) {
  return String(gender || "").trim().toLowerCase();
}

function normalizeBirthDate(birthDate) {
  return Number(birthDate);
}

function isSameUserIdentity(userData, { name, nameKey, birthDate, gender }) {
  return (
    buildNameKey(userData?.Name || "") === nameKey &&
    Number(userData?.BirthDate || 0) === birthDate &&
    normalizeGender(userData?.Gender || "") === gender
  );
}

function toFriendlyFirebaseError(error, fallbackMessage) {
  const code = error?.code || "";

  if (code.includes("deadline-exceeded") || code.includes("timeout")) {
    return "Firebase 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (code.includes("permission-denied")) {
    return "Firebase 접근 권한이 없습니다. Firestore 규칙을 확인해 주세요.";
  }

  if (code.includes("unavailable") || code.includes("failed-precondition")) {
    return "Firebase 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (code.includes("network-request-failed")) {
    return "네트워크 연결 상태를 확인한 뒤 다시 시도해 주세요.";
  }

  return error?.message || fallbackMessage;
}

function withTimeout(promise, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject({
          code: "timeout",
          message: timeoutMessage,
        });
      }, FIRESTORE_REQUEST_TIMEOUT_MS);
    }),
  ]);
}

async function findUsersByName(db, normalizedName) {
  const usersRef = collection(db, "users");
  const usersQuery = query(usersRef, where("Name", "==", normalizedName), limit(10));
  const snapshot = await withTimeout(
    getDocs(usersQuery),
    "이름 기준 사용자 조회가 지연되고 있습니다.",
  );
  return snapshot.docs;
}

async function findUsersByBirthDate(db, birthDate) {
  const usersRef = collection(db, "users");
  const usersQuery = query(usersRef, where("BirthDate", "==", birthDate), limit(20));
  const snapshot = await withTimeout(
    getDocs(usersQuery),
    "생년월일 기준 사용자 조회가 지연되고 있습니다.",
  );
  return snapshot.docs;
}

async function findUserByIdentity(db, identity) {
  // 우선 이름 기준으로 좁게 찾고, 못 찾으면 생년월일 기준으로 한 번 더 후보를 모아 비교한다.
  const nameCandidates = await findUsersByName(db, identity.name);
  const exactNameMatch = nameCandidates.find((doc) => isSameUserIdentity(doc.data(), identity));

  if (exactNameMatch) {
    return exactNameMatch;
  }

  const birthDateCandidates = await findUsersByBirthDate(db, identity.birthDate);
  return birthDateCandidates.find((doc) => isSameUserIdentity(doc.data(), identity)) || null;
}

export async function signUpUser({ name, birthDate, gender, consentAgreed }) {
  // 이름, 생년월일, 성별 조합으로 같은 사용자의 중복 가입을 막는다.
  try {
    const db = getFirebaseDb();
    const identity = {
      name: normalizeName(name),
      nameKey: buildNameKey(name),
      birthDate: normalizeBirthDate(birthDate),
      gender: normalizeGender(gender),
    };

    const existingUser = await findUserByIdentity(db, identity);

    if (existingUser) {
      const existingData = existingUser.data();

      return {
        ok: true,
        profile: {
          id: existingUser.id,
          name: existingData.Name,
          birthDate: existingData.BirthDate,
          gender: existingData.Gender,
          role: existingData.Role || "collector",
        },
        message: "이미 가입한 사용자입니다. 같은 정보로 로그인해 주세요.",
      };
    }

    const createdUser = await withTimeout(
      addDoc(collection(db, "users"), {
        // 관리자 승격은 콘솔에서 Role 값을 바꾸는 방식으로 운영한다.
        Name: identity.name,
        BirthDate: identity.birthDate,
        Gender: identity.gender,
        ConsentAgreed: Boolean(consentAgreed),
        ConsentAt: serverTimestamp(),
        Role: "collector",
        CreatedAt: serverTimestamp(),
        UpdatedAt: serverTimestamp(),
      }),
      "회원가입 저장 요청이 지연되고 있습니다.",
    );

    return {
      ok: true,
      profile: {
        id: createdUser.id,
        name: identity.name,
        birthDate: identity.birthDate,
        gender: identity.gender,
        role: "collector",
      },
      message: "회원가입이 완료되었습니다. 같은 정보로 로그인해 주세요.",
    };
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "회원가입 중 오류가 발생했습니다."),
    };
  }
}

export async function loginUser({ name, birthDate, gender, location }) {
  // 로그인 시에도 같은 사용자 식별 조합으로 Firestore 문서를 찾아 권한을 확인한다.
  try {
    const db = getFirebaseDb();
    const identity = {
      name: normalizeName(name),
      nameKey: buildNameKey(name),
      birthDate: normalizeBirthDate(birthDate),
      gender: normalizeGender(gender),
    };

    const user = await findUserByIdentity(db, identity);

    if (!user) {
      return {
        ok: false,
        message: "회원가입한 정보와 일치하는 사용자를 찾을 수 없습니다.",
      };
    }

    const userData = user.data();

    return {
      ok: true,
      session: {
        id: user.id,
        name: userData.Name,
        birthDate: userData.BirthDate,
        gender: userData.Gender,
        role: userData.Role || "collector",
        location,
        signedInAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "로그인 중 오류가 발생했습니다."),
    };
  }
}
