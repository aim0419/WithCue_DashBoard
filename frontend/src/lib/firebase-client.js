import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";
import { firebaseConfig, hasFirebaseConfig } from "../../config/firebase-config.js";

export function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    // env 누락 시 초기화 단계에서 바로 원인을 드러내도록 명시적으로 실패시킨다.
    throw new Error("Firebase environment variables are missing.");
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}
