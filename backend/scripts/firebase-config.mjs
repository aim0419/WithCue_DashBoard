import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath) {
  // dotenv 패키지 없이도 간단한 KEY=VALUE 파일을 읽을 수 있게 직접 파싱한다.
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      accumulator[key] = value;
      return accumulator;
    }, {});
}

function loadLocalEnv() {
  // 루트/프론트 기준 여러 위치를 훑어, 로컬 실행 위치가 달라도 같은 env를 찾도록 한다.
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "frontend", ".env.local"),
    path.resolve(process.cwd(), "frontend", ".env"),
    path.resolve(process.cwd(), "..", "frontend", ".env.local"),
    path.resolve(process.cwd(), "..", "frontend", ".env"),
  ];

  return candidates.reduce((accumulator, candidate) => {
    return { ...accumulator, ...parseEnvFile(candidate) };
  }, {});
}

const localEnv = loadLocalEnv();

function readEnv(name) {
  return process.env[name] || localEnv[name] || "";
}

// 프론트와 로컬 스크립트가 같은 Firebase 프로젝트를 보도록 공용 설정 객체를 만든다.
export const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
};
