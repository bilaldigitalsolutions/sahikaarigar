import { useRouter } from 'expo-router';
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

import { fetchMe, updateProfile } from '@/lib/api';
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
  signIn: (phone: string, name?: string) => Promise<void>;
  /** Verifies the OTP and resolves the fresh backend user (for smart routing). */
  confirmOtp: (code: string) => Promise<User>;
  resend: () => Promise<void>;
  /**
   * Clear the stored session and reset navigation. Defaults to the public
   * welcome screen; account deletion lands directly on the login screen.
   */
  signOut: (redirectTo?: '/welcome' | '/(auth)/login') => Promise<void>;
  refreshUser: () => Promise<void>;
  resetOtpFlow: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const challengeRef = useRef<OtpChallenge | null>(null);
  /** The name typed on the login screen — saved right after the OTP is
   *  verified, because the backend creates a nameless ("User") row on the
   *  first sign-in and the app never asked for a name before. */
  const nameRef = useRef<string | null>(null);

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

  const signIn = useCallback(async (phone: string, name?: string) => {
    setBusy(true);
    try {
      const challenge = await requestOtp(phone);
      challengeRef.current = challenge;
      // Remember the name so confirmOtp() can save it once the session exists.
      nameRef.current = name?.trim() || null;
      setPendingPhone(phone);
      setDevOtp(challenge.userInputCode ?? null);
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmOtp = useCallback(async (code: string): Promise<User> => {
    const challenge = challengeRef.current;
    if (!challenge) throw new Error('Enter your phone number and request an OTP first.');
    setBusy(true);
    try {
      await verifyOtp({
        preAuthSessionId: challenge.preAuthSessionId,
        deviceId: challenge.deviceId,
        code,
      });
      let me = await fetchMe();
      // First-time users are created server-side with the placeholder name
      // "User" — the app never asked for a name before, so the profile showed
      // "User" everywhere. Save the name captured on the login screen (only
      // when the account still has no real one).
      const capturedName = nameRef.current;
      if (capturedName && (!me.name || me.name === 'User')) {
        try {
          me = await updateProfile({ name: capturedName });
        } catch {
          // Non-fatal — the Profile screen prompts for the name as well.
        }
      }
      setUser(me);
      setPendingPhone(null);
      setDevOtp(null);
      challengeRef.current = null;
      nameRef.current = null;
      // The caller (verify.tsx) routes on `me.role`: 'worker' means the
      // backend promoted the account — i.e. the worker_profiles row exists.
      return me;
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

  const signOut = useCallback(
    async (redirectTo: '/welcome' | '/(auth)/login' = '/welcome') => {
      try {
        await logoutSession();
      } finally {
        setDemoMode(false);
        setIsDemo(false);
        setUser(null);
        setPendingPhone(null);
        setDevOtp(null);
        nameRef.current = null;
        challengeRef.current = null;

        // Hard reset the navigation stack: pop every screen the signed-in
        // session pushed (modals, hire flow, nested tabs), then replace the
        // root route with the public landing screen. Otherwise Android's
        // hardware Back reopens the signed-in screens underneath.
        if (router.canDismiss()) router.dismissAll();
        router.replace(redirectTo);
      }
    },
    [router],
  );

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
