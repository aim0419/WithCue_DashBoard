import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";
import { firebaseConfig, hasFirebaseConfig } from "../../config/firebase-config.js";

export function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    // 배포 환경 변수가 비어 있으면 초기화 단계에서 즉시 실패시켜 설정 누락을 빠르게 드러내는 처리임.
    throw new Error("Firebase environment variables are missing.");
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}
