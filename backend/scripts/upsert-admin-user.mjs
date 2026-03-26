import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function printUsage() {
  console.log(`Usage:
  node ./backend/scripts/upsert-admin-user.mjs "<이름>" <생년월일8자리> <male|female> <회원번호>

Examples:
  node ./backend/scripts/upsert-admin-user.mjs "조현석" 19980108 male 1
  node ./backend/scripts/upsert-admin-user.mjs "홍길동" 19900101 female 2
`);
}

function normalizeName(value) {
  return String(value || "").trim().normalize("NFC");
}

function formatMemberCode(value) {
  const parsedValue = Number(value || 0);
  return String(parsedValue).padStart(2, "0");
}

function buildDocumentId(name, birthDate, gender) {
  return `${encodeURIComponent(name)}__${birthDate}__${gender}`;
}

function validateArgs(name, birthDate, gender, userNumber) {
  const normalizedName = normalizeName(name);
  const parsedBirthDate = Number(birthDate);
  const parsedUserNumber = Number(userNumber);

  if (!normalizedName) {
    throw new Error("이름이 비어 있음.");
  }

  if (!Number.isInteger(parsedBirthDate) || String(parsedBirthDate).length !== 8) {
    throw new Error("생년월일은 YYYYMMDD 형식의 8자리 숫자여야 함.");
  }

  if (!["male", "female"].includes(String(gender))) {
    throw new Error("성별은 male 또는 female 이어야 함.");
  }

  if (!Number.isInteger(parsedUserNumber) || parsedUserNumber < 1) {
    throw new Error("회원번호는 1 이상의 정수여야 함.");
  }

  return {
    normalizedName,
    parsedBirthDate,
    normalizedGender: String(gender),
    parsedUserNumber,
    memberCode: formatMemberCode(parsedUserNumber),
  };
}

async function warnIfDuplicateIdentity(name, birthDate, gender, documentId) {
  // 같은 식별값을 가진 기존 문서가 다른 ID로 남아 있으면 운영 중 혼선을 줄 수 있어 경고만 남기는 처리임.
  const usersRef = collection(db, "users");
  const identityQuery = query(
    usersRef,
    where("BirthDate", "==", birthDate),
    where("Gender", "==", gender),
    limit(20),
  );
  const snapshot = await getDocs(identityQuery);

  const duplicates = snapshot.docs.filter((item) => {
    const data = item.data();
    return normalizeName(data.Name) === name && item.id !== documentId;
  });

  if (duplicates.length > 0) {
    console.warn("같은 이름/생년월일/성별 조합의 다른 문서가 이미 존재함:");
    duplicates.forEach((item) => console.warn(`- users/${item.id}`));
  }
}

async function upsertAdminUser(name, birthDate, gender, userNumber) {
  const { normalizedName, parsedBirthDate, normalizedGender, parsedUserNumber, memberCode } =
    validateArgs(name, birthDate, gender, userNumber);

  const documentId = buildDocumentId(normalizedName, parsedBirthDate, normalizedGender);
  await warnIfDuplicateIdentity(normalizedName, parsedBirthDate, normalizedGender, documentId);

  await setDoc(
    doc(db, "users", documentId),
    {
      Name: normalizedName,
      NameNormalized: normalizedName,
      BirthDate: parsedBirthDate,
      Gender: normalizedGender,
      ConsentAgreed: true,
      ConsentAt: serverTimestamp(),
      Role: "admin",
      Roles: ["admin", "collector"],
      UserNumber: parsedUserNumber,
      MemberCode: memberCode,
      AuthUid: "",
      CreatedAt: serverTimestamp(),
      UpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`관리자 계정 저장 완료: users/${documentId}`);
  console.log(
    JSON.stringify(
      {
        Name: normalizedName,
        BirthDate: parsedBirthDate,
        Gender: normalizedGender,
        Role: "admin",
        Roles: ["admin", "collector"],
        UserNumber: parsedUserNumber,
        MemberCode: memberCode,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const [name, birthDate, gender, userNumber] = process.argv.slice(2);

  if (!name || !birthDate || !gender || !userNumber) {
    printUsage();
    process.exit(1);
  }

  await upsertAdminUser(name, birthDate, gender, userNumber);
}

main().catch((error) => {
  console.error("관리자 계정 저장 실패:");
  console.error(error.code || error.message || error);
  process.exit(1);
});
