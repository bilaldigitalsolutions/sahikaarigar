import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { fetchMe } from '@/lib/api';
import {
  hasSession,
  initAuth,
  logout as logoutSession,
  requestOtp,
  resendOtp,
  verifyOtp,
  type OtpChallenge,
} from '@/lib/auth';
import { DEMO_MODE } from '@/lib/config';
import { DEMO_USER, setDemoMode } from '@/lib/demoData';
import { registerForPushNotifications } from '@/lib/notifications';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  /** True while the initial session check is running. */
  initializing: boolean;
  /** True while an OTP is being requested / verified. */
  busy: boolean;
  /** True when running on bundled demo data (backend unreachable). */
  isDemo: boolean;
  /** The phone number a code was just sent to (null when idle). */
  pendingPhone: string | null;
  /** Dev-only: the OTP echoed by the server when SMS_PROVIDER=console. */
  devOtp: string | null;
  signIn: (phone: string) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  resend: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resetOtpFlow: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const challengeRef = useRef<OtpChallenge | null>(null);

  // Restore an existing session on launch.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        initAuth();
        if (await hasSession()) {
          const me = await fetchMe();
          if (active) setUser(me);
          return;
        }
        // Opt-in demo session — only when EXPO_PUBLIC_DEMO_MODE=1. A normal
        // build always goes through the real OTP flow.
        if (DEMO_MODE) {
          if (!active) return;
          setDemoMode(true);
          setIsDemo(true);
          setUser(DEMO_USER);
        }
      } catch {
        // No session / server unreachable — stay signed out.
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Register this device for push notifications once a user is signed in.
  // Best-effort: a denied permission or offline server just means no push.
  useEffect(() => {
    if (!user || isDemo) return;
    void registerForPushNotifications();
  }, [user, isDemo]);

  const signIn = useCallback(async (phone: string) => {
    setBusy(true);
    try {
      const challenge = await requestOtp(phone);
      challengeRef.current = challenge;
      setPendingPhone(phone);
      setDevOtp(challenge.userInputCode ?? null);
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmOtp = useCallback(async (code: string) => {
    const challenge = challengeRef.current;
    if (!challenge) throw new Error('Enter your phone number and request an OTP first.');
    setBusy(true);
    try {
      await verifyOtp({
        preAuthSessionId: challenge.preAuthSessionId,
        deviceId: challenge.deviceId,
        code,
      });
      const me = await fetchMe();
      setUser(me);
      setPendingPhone(null);
      setDevOtp(null);
      challengeRef.current = null;
    } finally {
      setBusy(false);
    }
  }, []);

  const resend = useCallback(async () => {
    const challenge = challengeRef.current;
    if (!challenge) throw new Error('Enter your phone number first.');
    setBusy(true);
    try {
      await resendOtp({
        preAuthSessionId: challenge.preAuthSessionId,
        deviceId: challenge.deviceId,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      setDemoMode(false);
      setIsDemo(false);
      setUser(null);
      setPendingPhone(null);
      setDevOtp(null);
      challengeRef.current = null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      // ignore — caller can decide what to do
    }
  }, []);

  const resetOtpFlow = useCallback(() => {
    setPendingPhone(null);
    setDevOtp(null);
    challengeRef.current = null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      busy,
      isDemo,
      pendingPhone,
      devOtp,
      signIn,
      confirmOtp,
      resend,
      signOut,
      refreshUser,
      resetOtpFlow,
    }),
    [
      user,
      initializing,
      busy,
      isDemo,
      pendingPhone,
      devOtp,
      signIn,
      confirmOtp,
      resend,
      signOut,
      refreshUser,
      resetOtpFlow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
