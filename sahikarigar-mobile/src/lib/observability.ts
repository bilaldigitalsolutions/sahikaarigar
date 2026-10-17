// =============================================================================
// SahiKaarigar — observability (Sentry crash reporting + product analytics)
// =============================================================================
// Both are OPTIONAL and lazy-loaded so the app works with zero new setup:
//
//   Sentry:    EXPO_PUBLIC_SENTRY_DSN set  -> @sentry/react-native is required
//              dynamically; without a DSN (or without the package installed)
//              every call is a silent no-op.
//   Analytics: EXPO_PUBLIC_ANALYTICS_ENDPOINT set -> key lifecycle events are
//              POSTed as JSON {event, properties, ts}. Point it at PostHog's
//              /capture endpoint, a tiny Cloud Function, or your own collector.
//              Without it (or offline) events are dropped, never crash.
//
// This file deliberately avoids top-level `import '@sentry/react-native'` —
// that keeps `expo export` green on machines without the native package and
// keeps the JS bundle size unchanged until a DSN is configured.
// =============================================================================

import { DEMO_MODE } from './config';

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const ANALYTICS_ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT ?? '';

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (message: string, hint?: Record<string, unknown>) => void;
  setUser: (user: Record<string, unknown> | null) => void;
  addBreadcrumb: (crumb: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;
let sentryBooted = false;

function loadSentry(): SentryLike | null {
  if (sentryBooted) return sentry;
  sentryBooted = true;
  if (!SENTRY_DSN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@sentry/react-native') as SentryLike & { default?: SentryLike };
    sentry = mod?.default ?? mod;
    sentry?.init({
      dsn: SENTRY_DSN,
      enableAutoSessionTracking: true,
      // Keep release-startup fast on 512 MB CI runners / low-end phones.
      tracesSampleRate: 0,
    });
  } catch {
    sentry = null;
  }
  return sentry;
}

/** Initialize crash reporting. Safe to call unconditionally at startup. */
export function initObservability(): void {
  try {
    loadSentry();
  } catch {
    // Never let observability break the app boot.
  }
}

/** Attach the signed-in user (id + role only — never phone/name) to crash reports. */
export function setObservabilityUser(user: { id?: string; role?: string } | null): void {
  try {
    loadSentry()?.setUser(user ? { id: String(user.id ?? ''), role: String(user.role ?? '') } : null);
  } catch {
    // ignore
  }
}

/** Report an error to Sentry (no-op without DSN/package). Always console-errors in dev. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error('[observability]', error, context ?? '');
  }
  try {
    loadSentry()?.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}

/** Breadcrumb for crash-report timelines (screen views, hire actions, ...). */
export function leaveBreadcrumb(message: string, data?: Record<string, unknown>): void {
  try {
    loadSentry()?.addBreadcrumb({ message, data, level: 'info' });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Product analytics — the 7 key lifecycle events.
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | 'user_signup'
  | 'worker_registered'
  | 'hire_created'
  | 'hire_accepted'
  | 'hire_completed'
  | 'feedback_submitted'
  | 'search_performed';

/**
 * Fire-and-forget lifecycle event. Dropped silently when no endpoint is
 * configured, when offline, or in demo mode — analytics must never block UX.
 */
export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    if (!ANALYTICS_ENDPOINT || DEMO_MODE) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    void fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties: properties ?? {}, ts: new Date().toISOString() }),
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  } catch {
    // ignore
  }
}
