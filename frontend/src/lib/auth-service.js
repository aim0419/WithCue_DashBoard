import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, waitForFirebaseAuthReady } from "./firebase-client.js";

const FIRESTORE_REQUEST_TIMEOUT_MS = 12000;
const USER_COUNTER_DOC_PATH = ["systemCounters", "users"];

function normalizeName(value) {
  return String(value || "").trim().normalize("NFC");
}

function formatMemberCode(value) {
  const parsedValue = Number(value || 0);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return "00";
  }

  return String(parsedValue).padStart(2, "0");
}

function buildCollectorSession(user, location) {
  return {
    userId: user.id,
    name: user.Name,
    birthDate: user.BirthDate,
    gender: user.Gender,
    role: user.Role || "collector",
    location,
    userNumber: user.UserNumber || 0,
    memberCode: user.MemberCode || formatMemberCode(user.UserNumber),
  };
}

function toFriendlyFirebaseError(error, fallbackMessage) {
  const code = error?.code || "";

  if (code.includes("deadline-exceeded") || code.includes("timeout")) {
    return "Firebase 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (code.includes("permission-denied")) {
    return "Firebase 접근 권한이 없습니다. Firestore 규칙을 확인해 주세요.";
  }

  if (code.includes("unauthenticated")) {
    return "인증 상태가 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (code.includes("network-request-failed")) {
    return "네트워크 연결 상태를 확인해 주세요.";
  }

  if (code.includes("already-exists")) {
    return "이미 가입된 사용자 정보입니다.";
  }

  return error?.message || fallbackMessage;
}

// Firestore 지연 시 무한 대기를 막기 위한 보호 로직임.
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

async function findUsersByIdentity({ name, birthDate, gender }) {
  const db = getFirebaseDb();
  const normalizedName = normalizeName(name);
  const usersRef = collection(db, "users");
  const identityQuery = query(
    usersRef,
    where("BirthDate", "==", Number(birthDate)),
    limit(30),
  );
  const snapshot = await getDocs(identityQuery);

  return snapshot.docs
    .map((snapshotDoc) => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data(),
    }))
    .filter(
      (user) => normalizeName(user.Name) === normalizedName && String(user.Gender || "") === gender,
    );
}

// 기존 사용자 번호가 없으면 카운터 문서를 이용해 새 번호를 발급함.
async function ensureUserNumber(userId) {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);
  const counterRef = doc(db, USER_COUNTER_DOC_PATH[0], USER_COUNTER_DOC_PATH[1]);

  return runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists()) {
      throw new Error("회원 문서를 찾을 수 없습니다.");
    }

    const user = userSnapshot.data();
    const existingNumber = Number(user.UserNumber || 0);

    if (Number.isInteger(existingNumber) && existingNumber > 0) {
      return {
        userNumber: existingNumber,
        memberCode: user.MemberCode || formatMemberCode(existingNumber),
      };
    }

    const counterSnapshot = await transaction.get(counterRef);
    const nextUserNumber = Number(counterSnapshot.data()?.NextUserNumber || 1);
    const memberCode = formatMemberCode(nextUserNumber);

    transaction.set(
      counterRef,
      {
        NextUserNumber: nextUserNumber + 1,
      },
      { merge: true },
    );

    transaction.update(userRef, {
      UserNumber: nextUserNumber,
      MemberCode: memberCode,
      UpdatedAt: serverTimestamp(),
    });

    return {
      userNumber: nextUserNumber,
      memberCode,
    };
  });
}

// 회원가입 시 최소 필드를 먼저 만들고 번호를 뒤이어 발급함.
async function createCollectorUser({ name, birthDate, gender, consentAgreed }) {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const normalizedName = normalizeName(name);
  const userRef = doc(collection(db, "users"));

  await setDoc(userRef, {
    Name: normalizedName,
    NameNormalized: normalizedName,
    BirthDate: Number(birthDate),
    Gender: gender,
    ConsentAgreed: Boolean(consentAgreed),
    ConsentAt: serverTimestamp(),
    Role: "collector",
    UserNumber: 0,
    MemberCode: "00",
    AuthUid: auth.currentUser?.uid || "",
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  });

  const numberInfo = await ensureUserNumber(userRef.id);

  return {
    id: userRef.id,
    Name: normalizedName,
    BirthDate: Number(birthDate),
    Gender: gender,
    Role: "collector",
    UserNumber: numberInfo.userNumber,
    MemberCode: numberInfo.memberCode,
  };
}

// 익명 인증 UID를 사용자 문서와 연결해 규칙 조건을 맞추는 단계임.
async function updateCollectorAuthUidIfNeeded(user) {
  const auth = getFirebaseAuth();
  const currentUid = auth.currentUser?.uid || "";

  if (!currentUid || user.AuthUid === currentUid) {
    return;
  }

  await updateDoc(doc(getFirebaseDb(), "users", user.id), {
    AuthUid: currentUid,
    UpdatedAt: serverTimestamp(),
  });
}

export async function clearFirebaseSession() {
  await signOut(getFirebaseAuth());
}

export async function signUpUser({ name, birthDate, gender, consentAgreed }) {
  try {
    await waitForFirebaseAuthReady();

    const existingUsers = await withTimeout(
      findUsersByIdentity({ name, birthDate, gender }),
      "회원가입 요청 응답이 지연되고 있습니다.",
    );

    if (existingUsers.length > 0) {
      return {
        ok: false,
        message: "이미 가입된 사용자 정보입니다.",
      };
    }

    const createdUser = await withTimeout(
      createCollectorUser({ name, birthDate, gender, consentAgreed }),
      "회원가입 요청 응답이 지연되고 있습니다.",
    );

    return {
      ok: true,
      profile: {
        userId: createdUser.id,
        name: createdUser.Name,
        birthDate: createdUser.BirthDate,
        gender: createdUser.Gender,
        role: createdUser.Role,
        userNumber: createdUser.UserNumber,
        memberCode: createdUser.MemberCode,
      },
      message: "회원가입이 완료되었습니다. 같은 정보로 로그인해 주세요.",
    };
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "회원가입 처리 중 알 수 없는 오류가 발생했습니다."),
    };
  }
}

export async function loginUser({ name, birthDate, gender, location }) {
  try {
    await waitForFirebaseAuthReady();

    const matchedUsers = await withTimeout(
      findUsersByIdentity({ name, birthDate, gender }),
      "로그인 요청 응답이 지연되고 있습니다.",
    );

    if (matchedUsers.length === 0) {
      return {
        ok: false,
        message: "회원가입한 정보와 일치하는 사용자를 찾을 수 없습니다.",
      };
    }

    const matchedUser = matchedUsers[0];
    const numberInfo = await withTimeout(
      ensureUserNumber(matchedUser.id),
      "회원 번호 확인이 지연되고 있습니다.",
    );

    await updateCollectorAuthUidIfNeeded(matchedUser);

    return {
      ok: true,
      session: buildCollectorSession(
        {
          ...matchedUser,
          UserNumber: numberInfo.userNumber,
          MemberCode: numberInfo.memberCode,
        },
        location,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "로그인 처리 중 알 수 없는 오류가 발생했습니다."),
    };
  }
}
