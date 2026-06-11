import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function fetchAdmin<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = cookies().get('token')?.value ?? '';
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const url = new URL(`${base}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  }
  const res = await fetch(url.toString(), {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/auth/login');
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}
