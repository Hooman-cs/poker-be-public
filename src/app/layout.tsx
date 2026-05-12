import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
// import './globals.css';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Poker Application', // Update this to your actual app name
  description: 'Enterprise-grade Poker Management System',
};

/**
 * Root Layout (Server Component)
 * Wraps the entire application. Global providers (Auth, Theme) will go here later.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}