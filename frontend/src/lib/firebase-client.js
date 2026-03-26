import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";
import { getFunctions } from "firebase/functions";
import { firebaseConfig, hasFirebaseConfig } from "../../config/firebase-config.js";

const FIREBASE_FUNCTIONS_REGION = "asia-northeast3";

let authReadyPromise = null;

export function getFirebaseApp() {
  // 배포 환경 변수가 비어 있으면 초기화 단계에서 즉시 실패시켜 설정 누락을 빠르게 드러내는 처리임.
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

export function getFirebaseFunctions() {
  return getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);
}

export function waitForFirebaseAuthReady() {
  // 새로고침 직후 복원되는 인증 세션을 기다려 규칙 검증 전에 토큰이 비어 있지 않도록 맞추는 처리임.
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(getFirebaseAuth(), () => {
        unsubscribe();
        resolve();
      });
    });
  }

  return authReadyPromise;
}
