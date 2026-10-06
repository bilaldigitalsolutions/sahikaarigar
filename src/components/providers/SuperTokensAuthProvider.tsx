'use client';

// =============================================================================
// SahiKaarigar — SuperTokens session provider
// =============================================================================
// The SuperTokens twin of AuthProvider (which is Firebase-based). Both export a
// `useAuth()`-shaped context, so pages can switch by changing which provider
// wraps them in src/app/layout.tsx. See SUPERTOKENS_SETUP.md.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchMe, hasSession, logoutSuperTokens } from '@/lib/supertokens';
import { mapUser } from '@/lib/mappers';
import type { User } from '@/types';

interface AuthContextValue {
  /** The app user row from Supabase (null when logged out). */
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SuperTokensAuthContext = createContext<AuthContextValue | null>(null);

export function SuperTokensAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!(await hasSession())) {
      setUser(null);
      return;
    }
    // /me creates the Supabase row on the very first sign-in.
    const data = await fetchMe<{ user: Record<string, unknown> }>();
    setUser(mapUser(data.user));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await refresh();
      } catch (error) {
        console.error('SuperTokens auth sync failed:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutSuperTokens();
    setUser(null);
  }, []);

  return (
    <SuperTokensAuthContext.Provider
      value={{ user, loading, isLoggedIn: Boolean(user), refresh, logout }}
    >
      {children}
    </SuperTokensAuthContext.Provider>
  );
}

export function useSuperTokensAuth(): AuthContextValue {
  const context = useContext(SuperTokensAuthContext);
  if (!context) {
    throw new Error('useSuperTokensAuth must be used inside <SuperTokensAuthProvider>');
  }
  return context;
}
