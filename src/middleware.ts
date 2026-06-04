/**
 * @fileoverview Next.js middleware — cheap auth gate for admin routes and pages.
 *
 * Runs at the Edge (no Node built-ins available), so JWT verification uses
 * `jose`, not the Node `jsonwebtoken` library used elsewhere.
 *
 * RESPONSIBILITIES (deliberately narrow):
 *   - Protect `/admin/**` pages: unauthenticated requests redirect to the login page.
 *   - Bounce authenticated users away from `/auth/login` to the admin overview.
 *
 * EXPLICITLY NOT THIS LAYER'S JOB:
 *   - Verifying `role === 'admin'` strictly (a user-role token would pass the
 *     middleware gate). That check happens at the route level via `requireAdmin`,
 *     which also enforces `status === 'active'` via a DB lookup.
 *   - Logging auth failures. A normal expired-token flow IS a verification
 *     failure; logging it would be operational noise. Real auth debugging
 *     belongs in a proper logger, not here.
 *   - Anything to do with the socket server. Sockets run on port 3001 via the
 *     standalone Socket.io server; Next.js middleware never sees those requests.
 *     The previous `/api/socket` matcher entry and CORS branch were dead code.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const config = {
  matcher: ['/admin/:path*', '/auth/login'],
};

const LOGIN_PATH = '/auth/login';
const POST_LOGIN_LANDING = '/admin/overview';

/**
 * Reads the `token` httpOnly cookie and confirms it's a structurally-valid JWT
 * with both a `userId` and a `role` claim. Returns true ONLY if all of that
 * holds. Any failure (missing cookie, bad signature, expired, missing claim)
 * returns false silently — this gate has one job and "report why" isn't part
 * of it.
 */
async function hasValidAuthToken(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('token')?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return Boolean(payload.userId && payload.role);
  } catch {
    // Any failure — expired, invalid signature, malformed — means "not auth'd"
    // from this gate's perspective. Route-level `requireAdmin` will produce
    // a specific 401 with a code if needed; here we just route the redirect.
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdminPath = path.startsWith('/admin');
  const isLoginPath = path === LOGIN_PATH;

  // The matcher already filters to these two surfaces, but checking
  // defensively here keeps the function self-describing and would survive
  // a future matcher widening.
  if (!isAdminPath && !isLoginPath) {
    return NextResponse.next();
  }

  const isAuthed = await hasValidAuthToken(req);

  // Authenticated users on the login page get bounced to the admin landing.
  // This prevents the awkward "log in again while already logged in" loop.
  if (isLoginPath && isAuthed) {
    return NextResponse.redirect(new URL(POST_LOGIN_LANDING, req.url));
  }

  // Unauthenticated requests to an admin page redirect to login.
  if (isAdminPath && !isAuthed) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  return NextResponse.next();
}