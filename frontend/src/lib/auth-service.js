import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase-client.js";

function normalizeName(name) {
  // 브라우저와 운영체제가 달라도 같은 이름으로 비교되도록 공백과 유니코드를 정규화한다.
  return name.trim().normalize("NFC");
}

function normalizeGender(gender) {
  return String(gender || "").trim().toLowerCase();
}

function normalizeBirthDate(birthDate) {
  return Number(birthDate);
}

function isSameUserIdentity(userData, { name, birthDate, gender }) {
  return (
    normalizeName(userData?.Name || "") === name &&
    Number(userData?.BirthDate || 0) === birthDate &&
    normalizeGender(userData?.Gender || "") === gender
  );
}

async function findUserByIdentity(db, identity) {
  // 이름까지 바로 where로 묶지 않고 1차 후보를 넓게 가져와 클라이언트에서 다시 한 번 정확히 비교한다.
  const usersRef = collection(db, "users");
  const usersQuery = query(
    usersRef,
    where("BirthDate", "==", identity.birthDate),
    where("Gender", "==", identity.gender),
  );
  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.find((doc) => isSameUserIdentity(doc.data(), identity)) || null;
}

export async function signUpUser({ name, birthDate, gender, consentAgreed }) {
  // 이름, 생년월일, 성별 조합으로 같은 사용자의 중복 가입을 막는다.
  const db = getFirebaseDb();
  const identity = {
    name: normalizeName(name),
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

  const createdUser = await addDoc(collection(db, "users"), {
    // 관리자 승격은 콘솔에서 Role 값을 바꾸는 방식으로 운영한다.
    Name: identity.name,
    BirthDate: identity.birthDate,
    Gender: identity.gender,
    ConsentAgreed: Boolean(consentAgreed),
    ConsentAt: serverTimestamp(),
    Role: "collector",
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  });

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
}

export async function loginUser({ name, birthDate, gender, location }) {
  // 로그인 시에도 같은 사용자 식별 조합으로 Firestore 문서를 찾아 권한을 확인한다.
  const db = getFirebaseDb();
  const identity = {
    name: normalizeName(name),
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
}
