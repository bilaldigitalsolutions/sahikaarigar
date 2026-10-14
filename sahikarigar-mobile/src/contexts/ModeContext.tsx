// =============================================================================
// App role — "Kaarigar (worker)" vs "Employer (customer)"  — set on the new
// Role Selection screen ("Aap kaun hain?") right after login.
// =============================================================================
// The whole UI (tabs, home dashboard) is driven by this locally-chosen role,
// which is remembered across launches in AsyncStorage (`user_role`). The
// backend `users.role` column stays the source of truth for "has a worker
// profile" — it flips to 'worker' automatically when the registration form is
// submitted (see auth-server upsertWorkerProfile). So:
//
//   role (local)        → which screens/tabs the app shows right now
//   hasWorkerProfile    → backend users.role === 'worker' (registration done)
//
// A user who picks "Kaarigar" without a profile is sent to the registration
// form first; anyone with a profile can switch sides freely from Profile.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';

/** The active UI role — drives tabs + home content. */
export type AppRole = 'worker' | 'employer';

/** Legacy names kept so older components (ModeSwitch, Profile) keep working. */
export type AppMode = 'customer' | 'worker';

/** AsyncStorage key for the chosen role (as agreed: `user_role`). */
const ROLE_KEY = 'user_role';
/** Pre-role-selection installs stored the mode under this key — migrate it. */
const LEGACY_MODE_KEY = 'sahikarigar.appMode';

interface ModeContextValue {
  /** The active UI role ('worker' | 'employer'). Defaults to 'employer'. */
  role: AppRole;
  /** True once the stored role has been read (avoids flashing the wrong tabs). */
  ready: boolean;
  /** True when the user has explicitly picked a role at least once. */
  roleChosen: boolean;
  /** True when the backend account has completed worker registration. */
  hasWorkerProfile: boolean;
  /** Persist the active role (AsyncStorage `user_role`). */
  setRole: (role: AppMode | AppRole) => void;

  // ---- Legacy aliases (ModeSwitch / Profile switch still use these) ----
  /** `'worker'` maps to role 'worker', `'customer'` maps to 'employer'. */
  mode: AppMode;
  /** True when the account has a worker profile (worker mode is possible). */
  canSwitch: boolean;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storedRole, setStoredRole] = useState<AppRole | null>(null);
  const [ready, setReady] = useState(false);

  // The backend role tells us whether the worker registration exists. (The
  // server promotes users.role to 'worker' inside upsertWorkerProfile.)
  const hasWorkerProfile = user?.role === 'worker';

  // Restore the role picked in an earlier session (migrating the legacy
  // `sahikarigar.appMode` value if that's all there is).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [role, legacyMode] = await Promise.all([
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(LEGACY_MODE_KEY),
        ]);
        if (!active) return;
        if (role === 'worker' || role === 'employer') {
          setStoredRole(role);
        } else if (legacyMode === 'worker') {
          setStoredRole('worker');
        } else if (legacyMode === 'customer') {
          setStoredRole('employer');
        }
      } catch {
        // Storage unavailable — keep the default (employer) below.
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setRole = useCallback(
    (next: AppMode | AppRole) => {
      // Accept both naming styles: 'customer' is the legacy word for 'employer'.
      const role: AppRole = next === 'worker' ? 'worker' : 'employer';
      setStoredRole(role);
      AsyncStorage.setItem(ROLE_KEY, role).catch(() => {});
      // Best-effort cleanup of the legacy key so the two never disagree.
      AsyncStorage.removeItem(LEGACY_MODE_KEY).catch(() => {});
    },
    [],
  );

  // Until a role is explicitly chosen fall back to the backend role so deep
  // links / restores never crash; the Role Selection screen overrides this.
  const role: AppRole = storedRole ?? (hasWorkerProfile ? 'worker' : 'employer');
  const roleChosen = storedRole !== null;

  // ---- Legacy aliases ----
  const mode: AppMode = role === 'worker' ? 'worker' : 'customer';
  const canSwitch = hasWorkerProfile;
  const setMode = useCallback((next: AppMode) => setRole(next), [setRole]);
  const toggleMode = useCallback(
    () => setRole(role === 'worker' ? 'employer' : 'worker'),
    [role, setRole],
  );

  const value = useMemo<ModeContextValue>(
    () => ({
      role,
      ready,
      roleChosen,
      hasWorkerProfile,
      setRole,
      mode,
      canSwitch,
      setMode,
      toggleMode,
    }),
    [role, ready, roleChosen, hasWorkerProfile, setRole, mode, canSwitch, setMode, toggleMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode() must be used inside <ModeProvider>');
  return ctx;
}

