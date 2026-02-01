import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * PRODUCTION SAFE:
 * - Prefer FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 env vars
 * - Fallback to local file serviceAccountKey.json for local dev only
 */
function readServiceAccountFromEnv() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  }

  return null;
}

function readServiceAccountFromFile() {
  const p = path.join(process.cwd(), "serviceAccountKey.json");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function getServiceAccount() {
  const env = readServiceAccountFromEnv();
  if (env) return env;

  const file = readServiceAccountFromFile();
  if (file) return file;

  throw new Error(
    "Missing Firebase Admin credentials. Provide FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_BASE64) in env, or serviceAccountKey.json locally."
  );
}

export const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(getServiceAccount()),
      });

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);