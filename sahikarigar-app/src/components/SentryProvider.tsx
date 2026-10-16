'use client';

import * as Sentry from '@sentry/browser';

// Sentry provider - initialized once when this module is first mounted.
// Reads NEXT_PUBLIC_SENTRY_DSN from the environment; if empty or unset, Sentry
// stays fully disabled and every call is a silent no-op.
export function SentryProvider({ children }: { children: React.ReactNode }) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // No additional integrations - @sentry/browser standalone only needs error+performance capture
    tracesSampleRate: 0.1,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  return <>{children}</>;
}
