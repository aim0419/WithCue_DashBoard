import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig, hasFirebaseConfig } from "../../config/firebase-config.js";

let authReadyPromise = null;

export function getFirebaseApp() {
  // 배포 환경 변수가 비어 있으면 초기화 단계에서 바로 실패시키는 처리임.
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

export async function waitForFirebaseAuthReady() {
  // 무료 운영 구조에서는 Firebase 익명 인증을 기본 세션으로 사용함.
  // 이 세션이 있어야 Firestore 규칙에서 request.auth 기반 최소 보호 적용이 가능함.
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      const auth = getFirebaseAuth();

      if (auth.currentUser) {
        return auth.currentUser;
      }

      const credential = await signInAnonymously(auth);
      return credential.user;
    })().catch((error) => {
      authReadyPromise = null;
      throw error;
    });
  }

  return authReadyPromise;
}
