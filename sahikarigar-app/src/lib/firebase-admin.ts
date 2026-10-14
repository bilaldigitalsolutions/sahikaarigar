import * as admin from 'firebase-admin';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Resolve the Firebase Admin credential. Two ways, in priority order:
 *
 *  1. A service-account JSON file (EASIEST)
 *     - the path in `FIREBASE_SERVICE_ACCOUNT_PATH`, or
 *     - `firebase-service-account.json` in the project root
 *       (just download it from Firebase and drop the file in!)
 *  2. Individual environment variables
 *     - FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *
 * Nothing runs at import time, so `next build` works even before the
 * credentials are configured.
 */
function resolveCredential(): admin.credential.Credential {
  const jsonPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), 'firebase-service-account.json');

  if (existsSync(jsonPath)) {
    // Pass the path itself: the SDK reads + parses the JSON for us.
    return admin.credential.cert(jsonPath);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials are not configured. Either save the service-account ' +
        'JSON as `firebase-service-account.json` in the project root, or set ' +
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local'
    );
  }

  return admin.credential.cert({ projectId, clientEmail, privateKey });
}

/**
 * Lazily initialise the Firebase Admin app on first use.
 */
function getAdminApp(): admin.app.App {
  const existing = admin.apps.find((app) => app !== null);
  if (existing) return existing;

  // Running on Firebase Hosting / Cloud Functions / App Hosting: the runtime
  // already provides credentials through its default service account, so no
  // explicit key is needed (and none must be deployed).
  const onGoogleCloud = Boolean(
    process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG
  );

  if (onGoogleCloud) {
    return admin.initializeApp();
  }

  return admin.initializeApp({ credential: resolveCredential() });
}

/**
 * Firebase Admin Auth instance, used to verify the ID tokens issued by the
 * client-side Phone Auth flow.
 */
export function getAdminAuth(): admin.auth.Auth {
  return admin.auth(getAdminApp());
}

export default admin;

