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
import { PostHog } from 'posthog-react-native';

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const ANALYTICS_ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT ?? '';
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
/** EU Cloud unless overridden — events sent to the wrong region never appear. */
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/**
 * THE single PostHog client for the whole app.
 *
 * Consolidation requirement: exactly one `PostHog` instance must be used
 * everywhere. Before this fix there were TWO — the module-level instance in this
 * file (used by `trackEvent`) and a second one created in the root layout. The
 * layout's `identify()` therefore ran against a different client than the one
 * capturing events, so events never merged into the same user and the admin's
 * "active users" numbers looked empty.
 */
export const posthog = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });

/** Signed-in user id used as the analytics `distinct_id` (id + role only). */
let analyticsUserId: string | null = null;

/** Sets the current analytics user id — the value sent as `distinct_id`. */
export function setAnalyticsUserId(userId: string | null): void {
  analyticsUserId = userId;
}

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
  | 'hire_arrived'
  | 'hire_rejected'
  | 'hire_cancelled'
  | 'hire_started'
  | 'hire_completed'
  | 'feedback_submitted'
  | 'search_performed'
  | 'screen_view'
  | 'worker_viewed'
  | 'booking_started';

/**
 * Fire-and-forget lifecycle event via PostHog. Dropped silently when in demo
 * mode — analytics must never block UX. Only non-PII properties are accepted
 * (event name + safe properties such as counts, ratings, skill ids).
 *
 * Always goes through the SINGLE shared `posthog` instance, and stamps the
 * current signed-in user as the event's `distinct_id` so it lands on the same
 * person that `posthog.identify()` attached (previously it used a second,
 * un-identified instance and never matched).
 */
export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    if (DEMO_MODE || !POSTHOG_KEY) return;
    posthog.capture(event, {
      ...(properties ?? {}),
      ...(analyticsUserId ? { distinct_id: analyticsUserId } : {}),
    } as any);
  } catch {
    // ignore — PostHog is optional and must never break UX
  }
}
