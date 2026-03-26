import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";

initializeApp();
setGlobalOptions({
  region: "asia-northeast3",
  maxInstances: 10,
});

const db = getFirestore();
const auth = getAuth();

const LOCATION_META = {
  aim: {
    docId: "Company",
    name: "회사",
    displayName: "AIM",
    siteCode: "A",
  },
  hyocheon: {
    docId: "HyoCheon",
    name: "효천점",
    displayName: "이끌림(효천점)",
    siteCode: "H",
  },
  jangdeok: {
    docId: "Jangdeok",
    name: "장덕점",
    displayName: "이끌림(장덕점)",
    siteCode: "J",
  },
};

const BODY_PART_META = {
  Neck: { key: "Neck", label: "목" },
  Hip: { key: "Hip", label: "허리" },
  LeftShoulder: { key: "LeftShoulder", label: "왼쪽 어깨" },
  RightShoulder: { key: "RightShoulder", label: "오른쪽 어깨" },
  LeftKnee: { key: "LeftKnee", label: "왼쪽 무릎" },
  RightKnee: { key: "RightKnee", label: "오른쪽 무릎" },
};

function normalizeName(value) {
  return String(value || "").trim().normalize("NFC");
}

function parseBirthDate(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length !== 8) {
    throw new HttpsError("invalid-argument", "생년월일 형식이 올바르지 않음.");
  }

  const parsed = Number(digits);

  if (!Number.isInteger(parsed) || parsed < 19000101 || parsed > 20991231) {
    throw new HttpsError("invalid-argument", "생년월일 값이 올바르지 않음.");
  }

  return parsed;
}

function parseGender(value) {
  if (!["male", "female"].includes(value)) {
    throw new HttpsError("invalid-argument", "성별 값이 올바르지 않음.");
  }

  return value;
}

function parseLocation(value) {
  if (!LOCATION_META[value]) {
    throw new HttpsError("invalid-argument", "지점 값이 올바르지 않음.");
  }

  return LOCATION_META[value];
}

function parseBodyPart(value) {
  if (!BODY_PART_META[value]) {
    throw new HttpsError("invalid-argument", "촬영 부위 값이 올바르지 않음.");
  }

  return BODY_PART_META[value];
}

async function findUserByProfile({ name, birthDate, gender }) {
  const normalizedName = normalizeName(name);
  const snapshot = await db
    .collection("users")
    .where("BirthDate", "==", birthDate)
    .where("Gender", "==", gender)
    .get();

  return snapshot.docs.find((documentSnapshot) => {
    const data = documentSnapshot.data();
    return normalizeName(data.Name) === normalizedName;
  }) || null;
}

async function findUserByAuthUid(authUid) {
  const snapshot = await db.collection("users").where("AuthUid", "==", authUid).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function ensureAuthIdentity(userRef, userData) {
  const currentRole = userData.Role === "admin" ? "admin" : "collector";

  if (userData.AuthUid) {
    try {
      await auth.getUser(userData.AuthUid);
      await auth.setCustomUserClaims(userData.AuthUid, {
        role: currentRole,
        userDocId: userRef.id,
      });
      return userData.AuthUid;
    } catch {
      // 기존 Auth 사용자가 사라졌을 때 새 계정을 다시 발급하는 처리임.
    }
  }

  const createdUser = await auth.createUser({
    displayName: userData.Name,
  });

  await auth.setCustomUserClaims(createdUser.uid, {
    role: currentRole,
    userDocId: userRef.id,
  });

  await userRef.set(
    {
      AuthUid: createdUser.uid,
      UpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return createdUser.uid;
}

async function ensureLocationDocument(locationMeta) {
  const locationRef = db.collection("locations").doc(locationMeta.docId);

  await locationRef.set(
    {
      Name: locationMeta.name,
      DisplayName: locationMeta.displayName,
      SiteCode: locationMeta.siteCode,
      ConsentCount: FieldValue.increment(0),
      SessionCount: FieldValue.increment(0),
      BodyParts: {
        Neck: 0,
        Hip: 0,
        LeftShoulder: 0,
        RightShoulder: 0,
        LeftKnee: 0,
        RightKnee: 0,
      },
      UpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return locationRef;
}

async function ensureParticipantDocument({ userRef, userData, authUid, locationMeta }) {
  const participantRef = db
    .collection("locationParticipants")
    .doc(`${authUid}_${locationMeta.docId}`);
  const existingSnapshot = await participantRef.get();

  if (existingSnapshot.exists) {
    return {
      participantRef,
      alreadyCounted: true,
    };
  }

  await participantRef.set({
    UserId: authUid,
    UserDocId: userRef.id,
    Name: userData.Name,
    BirthDate: Number(userData.BirthDate || 0),
    Gender: userData.Gender || "",
    Location: locationMeta.docId,
    SiteCode: locationMeta.siteCode,
    CreatedAt: FieldValue.serverTimestamp(),
    UpdatedAt: FieldValue.serverTimestamp(),
  });

  const locationRef = await ensureLocationDocument(locationMeta);
  await locationRef.set(
    {
      ConsentCount: FieldValue.increment(1),
      UpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    participantRef,
    alreadyCounted: false,
  };
}

function buildSessionPayload({ authUid, userRef, userData, location, role }) {
  return {
    id: authUid,
    userDocId: userRef.id,
    role,
    name: userData.Name,
    birthDate: Number(userData.BirthDate || 0),
    gender: userData.Gender || "",
    location: location || "",
  };
}

export const signUpCollector = onCall(async (request) => {
  const name = normalizeName(request.data?.name);
  const birthDate = parseBirthDate(request.data?.birthDate);
  const gender = parseGender(request.data?.gender);
  const consentAgreed = request.data?.consentAgreed === true;

  if (!name) {
    throw new HttpsError("invalid-argument", "이름이 비어 있음.");
  }

  if (!consentAgreed) {
    throw new HttpsError("failed-precondition", "개인정보 동의가 필요함.");
  }

  const existingUser = await findUserByProfile({ name, birthDate, gender });

  if (existingUser) {
    const existingData = existingUser.data();
    const authUid = await ensureAuthIdentity(existingUser.ref, existingData);

    return {
      ok: true,
      message: "이미 등록된 계정임. 같은 정보로 로그인하면 됨.",
      profile: buildSessionPayload({
        authUid,
        userRef: existingUser.ref,
        userData: existingData,
        location: "",
        role: existingData.Role === "admin" ? "admin" : "collector",
      }),
    };
  }

  const userRef = db.collection("users").doc();
  const userPayload = {
    Name: name,
    BirthDate: birthDate,
    Gender: gender,
    ConsentAgreed: true,
    ConsentAt: FieldValue.serverTimestamp(),
    Role: "collector",
    CreatedAt: FieldValue.serverTimestamp(),
    UpdatedAt: FieldValue.serverTimestamp(),
  };

  await userRef.set(userPayload);

  const createdSnapshot = await userRef.get();
  const createdData = createdSnapshot.data();
  const authUid = await ensureAuthIdentity(userRef, createdData);

  return {
    ok: true,
    message: "회원가입이 완료됐음.",
    profile: buildSessionPayload({
      authUid,
      userRef,
      userData: createdData,
      location: "",
      role: "collector",
    }),
  };
});

export const loginCollector = onCall(async (request) => {
  const name = normalizeName(request.data?.name);
  const birthDate = parseBirthDate(request.data?.birthDate);
  const gender = parseGender(request.data?.gender);
  const location = request.data?.location ? String(request.data.location) : "";

  if (!name) {
    throw new HttpsError("invalid-argument", "이름이 비어 있음.");
  }

  const userSnapshot = await findUserByProfile({ name, birthDate, gender });

  if (!userSnapshot) {
    return {
      ok: false,
      message: "회원가입한 정보와 일치하는 사용자를 찾을 수 없음.",
    };
  }

  const userData = userSnapshot.data();
  const role = userData.Role === "admin" ? "admin" : "collector";

  if (role !== "admin" && !location) {
    throw new HttpsError("invalid-argument", "수집 지점 선택이 필요함.");
  }

  const authUid = await ensureAuthIdentity(userSnapshot.ref, userData);
  const customToken = await auth.createCustomToken(authUid, {
    role,
    userDocId: userSnapshot.id,
  });

  return {
    ok: true,
    customToken,
    session: buildSessionPayload({
      authUid,
      userRef: userSnapshot.ref,
      userData,
      location,
      role,
    }),
  };
});

export const ensureCollectorLocationAccess = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "로그인이 필요함.");
  }

  const locationMeta = parseLocation(request.data?.location);
  const userSnapshot = await findUserByAuthUid(request.auth.uid);

  if (!userSnapshot) {
    throw new HttpsError("permission-denied", "사용자 문서를 찾을 수 없음.");
  }

  const userData = userSnapshot.data();
  const role = userData.Role === "admin" ? "admin" : "collector";

  if (role !== "collector") {
    throw new HttpsError("permission-denied", "수집 사용자만 접근 가능함.");
  }

  const consentResult = await ensureParticipantDocument({
    userRef: userSnapshot.ref,
    userData,
    authUid: request.auth.uid,
    locationMeta,
  });

  return {
    ok: true,
    alreadyCounted: consentResult.alreadyCounted,
    location: locationMeta.docId,
    siteCode: locationMeta.siteCode,
  };
});

export const recordCollectionSession = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "로그인이 필요함.");
  }

  const locationMeta = parseLocation(request.data?.location);
  const bodyPart = parseBodyPart(request.data?.bodyPartKey);
  const fileName = String(request.data?.fileName || "").trim();
  const mimeType = String(request.data?.mimeType || "").trim();
  const fileSize = Number(request.data?.size || 0);
  const durationMs = Number(request.data?.durationMs || 0);

  if (!fileName || !mimeType) {
    throw new HttpsError("invalid-argument", "녹화 파일 메타데이터가 비어 있음.");
  }

  if (!Number.isFinite(fileSize) || fileSize < 0 || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new HttpsError("invalid-argument", "파일 크기 또는 녹화 시간이 올바르지 않음.");
  }

  const userSnapshot = await findUserByAuthUid(request.auth.uid);

  if (!userSnapshot) {
    throw new HttpsError("permission-denied", "사용자 문서를 찾을 수 없음.");
  }

  const userData = userSnapshot.data();
  const role = userData.Role === "admin" ? "admin" : "collector";

  if (role !== "collector") {
    throw new HttpsError("permission-denied", "수집 사용자만 기록 가능함.");
  }

  await ensureParticipantDocument({
    userRef: userSnapshot.ref,
    userData,
    authUid: request.auth.uid,
    locationMeta,
  });

  await db.collection("collectionSessions").add({
    UserId: request.auth.uid,
    UserDocId: userSnapshot.id,
    Name: userData.Name,
    BirthDate: Number(userData.BirthDate || 0),
    Gender: userData.Gender || "",
    Location: locationMeta.docId,
    SiteCode: locationMeta.siteCode,
    BodyPart: bodyPart.key,
    BodyPartLabel: bodyPart.label,
    FileName: fileName,
    MimeType: mimeType,
    FileSize: fileSize,
    DurationMs: durationMs,
    CreatedAt: FieldValue.serverTimestamp(),
    CreatedAtMs: Timestamp.now().toMillis(),
  });

  const locationRef = await ensureLocationDocument(locationMeta);
  await locationRef.set(
    {
      SessionCount: FieldValue.increment(1),
      [`BodyParts.${bodyPart.key}`]: FieldValue.increment(1),
      UpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ok: true,
    bodyPart,
    location: locationMeta.docId,
    siteCode: locationMeta.siteCode,
  };
});
