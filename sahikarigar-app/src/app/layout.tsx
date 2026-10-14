import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'SahiKaarigar - Verified Electricians & Plumbers in Hyderabad',
    template: '%s | SahiKaarigar',
  },
  description:
    'Find trusted, verified workers in Hyderabad. Electricians, plumbers, painters with ratings & reviews. Book now!',
  keywords: [
    'electrician hyderabad',
    'plumber hyderabad',
    'carpenter hyderabad',
    'painter hyderabad',
    'worker hyderabad',
    'home services hyderabad',
  ],
  authors: [{ name: 'SahiKaarigar' }],
  creator: 'SahiKaarigar',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'SahiKaarigar',
    title: 'SahiKaarigar - Verified Electricians & Plumbers in Hyderabad',
    description:
      'Find trusted, verified workers in Hyderabad. Electricians, plumbers, painters with ratings & reviews.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SahiKaarigar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SahiKaarigar - Verified Electricians & Plumbers in Hyderabad',
    description:
      'Find trusted, verified workers in Hyderabad. Electricians, plumbers, painters with ratings & reviews.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#16A34A" />
      </head>
      <body className={`${inter.className} antialiased bg-background text-text-primary`}>
        <AuthProvider>
          <main className="min-h-screen">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}