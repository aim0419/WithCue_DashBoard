import { signInWithCustomToken, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseAuth, getFirebaseFunctions, waitForFirebaseAuthReady } from "./firebase-client.js";

const FIRESTORE_REQUEST_TIMEOUT_MS = 12000;

function toFriendlyFirebaseError(error, fallbackMessage) {
  const code = error?.code || "";

  if (code.includes("deadline-exceeded") || code.includes("timeout")) {
    return "Firebase 응답이 지연되고 있음. 잠시 후 다시 시도해야 함.";
  }

  if (code.includes("permission-denied")) {
    return "Firebase 접근 권한이 없음. 관리자 설정 확인이 필요함.";
  }

  if (code.includes("unauthenticated")) {
    return "인증 상태가 만료되었음. 다시 로그인해야 함.";
  }

  if (code.includes("unavailable") || code.includes("failed-precondition")) {
    return "Firebase 연결 상태가 불안정함. 잠시 후 다시 시도해야 함.";
  }

  if (code.includes("network-request-failed")) {
    return "네트워크 연결 상태 확인이 필요함.";
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

function getCallable(name) {
  return httpsCallable(getFirebaseFunctions(), name);
}

async function signInFromCallableResult(result) {
  if (!result?.customToken) {
    throw new Error("인증 토큰 발급에 실패했음.");
  }

  await signInWithCustomToken(getFirebaseAuth(), result.customToken);
  await waitForFirebaseAuthReady();
}

export async function clearFirebaseSession() {
  await signOut(getFirebaseAuth());
}

export async function signUpUser({ name, birthDate, gender, consentAgreed }) {
  // 회원가입은 브라우저가 직접 users 문서를 쓰지 않고 서버 함수가 검증 후 사용자와 인증 계정을 함께 준비하는 구조임.
  try {
    const signUpCollector = getCallable("signUpCollector");
    const { data } = await withTimeout(
      signUpCollector({
        name,
        birthDate,
        gender,
        consentAgreed,
      }),
      "회원가입 요청 응답이 지연되고 있음.",
    );

    return data;
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "회원가입 처리 중 오류가 발생했음."),
    };
  }
}

export async function loginUser({ name, birthDate, gender, location }) {
  // 로그인은 서버 함수가 사용자 검증과 커스텀 토큰 발급을 맡고 브라우저는 토큰 로그인만 수행하는 구조임.
  try {
    const loginCollector = getCallable("loginCollector");
    const { data } = await withTimeout(
      loginCollector({
        name,
        birthDate,
        gender,
        location,
      }),
      "로그인 응답이 지연되고 있음.",
    );

    if (!data?.ok) {
      return data;
    }

    await signInFromCallableResult(data);

    return {
      ok: true,
      session: data.session,
    };
  } catch (error) {
    return {
      ok: false,
      message: toFriendlyFirebaseError(error, "로그인 처리 중 오류가 발생했음."),
    };
  }
}
