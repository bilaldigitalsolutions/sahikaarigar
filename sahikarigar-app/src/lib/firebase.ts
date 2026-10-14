'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';
import { normalizeIndianPhone } from '@/utils';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialisation keeps the static pre-render happy (no `window` at build).
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) firebaseAuth = getAuth(getFirebaseApp());
  return firebaseAuth;
}

let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

/** Firebase expects E.164: the app stores 10-digit numbers, so prefix +91. */
export function toE164(phone: string): string {
  return `+91${normalizeIndianPhone(phone)}`;
}

/**
 * Create (or reuse) the invisible reCAPTCHA verifier used by Firebase Phone
 * Auth. `containerId` must exist in the DOM.
 */
export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), containerId, {
    size: 'invisible',
  });

  return recaptchaVerifier;
}

/** Step 1 — send the SMS OTP. */
export async function sendOtp(phone: string, containerId: string): Promise<void> {
  const verifier = getRecaptchaVerifier(containerId);
  confirmationResult = await signInWithPhoneNumber(
    getFirebaseAuth(),
    toE164(phone),
    verifier
  );
}

export interface PhoneSession {
  token: string;
  uid: string;
  phone: string;
}

/** Step 2 — confirm the OTP and return a fresh Firebase ID token. */
export async function confirmOtp(code: string): Promise<PhoneSession> {
  if (!confirmationResult) {
    throw new Error('Pehle OTP bhejo, phir verify karo.');
  }

  const credential = await confirmationResult.confirm(code);
  const token = await credential.user.getIdToken(true);

  return {
    token,
    uid: credential.user.uid,
    phone: normalizeIndianPhone(credential.user.phoneNumber ?? ''),
  };
}

/** Clear the reCAPTCHA + pending confirmation (needed before a retry). */
export function resetPhoneAuth(): void {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // ignore — nothing to clear
  }
  recaptchaVerifier = null;
  confirmationResult = null;
}

export async function signOutUser(): Promise<void> {
  resetPhoneAuth();
  await signOut(getFirebaseAuth());
}
