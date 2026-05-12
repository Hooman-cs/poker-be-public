import { redirect } from 'next/navigation';

/**
 * Root Page (Server Component)
 * Instantly intercepts traffic to the root URL '/' and redirects them 
 * to the authentication flow before any client-side rendering occurs.
 */
export default function HomePage() {
  // Native Next.js App Router server-side redirect
  redirect('/auth/login');
}