'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, signOutUser } from '@/lib/firebase';
import { loginWithToken } from '@/lib/auth-api';
import type { User } from '@/types';

interface AuthContextValue {
  /** The app user row from Supabase (null when logged out). */
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  /** Re-reads the current Firebase session and refreshes the app user. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAppUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null);
      return;
    }

    const token = await fbUser.getIdToken();
    const { user: appUser } = await loginWithToken(token);
    setUser(appUser);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      if (cancelled) return;
      setFirebaseUser(fbUser);

      try {
        await syncAppUser(fbUser);
      } catch (error) {
        console.error('Auth sync failed:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [syncAppUser]);

  const refresh = useCallback(async () => {
    await syncAppUser(getFirebaseAuth().currentUser);
  }, [syncAppUser]);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isLoggedIn: Boolean(user),
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
