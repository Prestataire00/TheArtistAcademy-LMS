import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Artist Academy — LMS',
  description: 'Plateforme e-learning The Artist Academy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
