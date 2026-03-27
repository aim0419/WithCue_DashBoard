import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig, hasFirebaseConfig } from "../../config/firebase-config.js";

let authReadyPromise = null;

export function getFirebaseApp() {
  // 배포 환경 변수가 비어 있으면 초기화 단계에서 바로 실패시키는 처리함.
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase environment variables are missing.");
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export function resetFirebaseAuthReady() {
  // 로그아웃 후에는 이전 익명 인증 캐시를 버리도록 초기화함.
  authReadyPromise = null;
}

export async function waitForFirebaseAuthReady() {
  // 무료 운영 구조에서는 Firebase 익명 인증을 기본 인증으로 사용함.
  // 이 인증이 있어야 Firestore 규칙에서 request.auth 기반 최소 보호 적용이 가능함.
  const auth = getFirebaseAuth();

  if (auth.currentUser && authReadyPromise) {
    return authReadyPromise;
  }

  if (auth.currentUser) {
    authReadyPromise = Promise.resolve(auth.currentUser);
    return authReadyPromise;
  }

  authReadyPromise = (async () => {
    const credential = await signInAnonymously(auth);
    return credential.user;
  })().catch((error) => {
    authReadyPromise = null;
    throw error;
  });

  return authReadyPromise;
}
