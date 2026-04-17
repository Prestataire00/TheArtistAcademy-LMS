import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Artist Academy — LMS',
  description: 'Plateforme e-learning The Artist Academy',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
