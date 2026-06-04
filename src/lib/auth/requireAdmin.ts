/**
 * @fileoverview Admin auth guard — cookie + role + active-status verifier for admin routes.
 *
 * Reads the `token` httpOnly cookie from the request, verifies the JWT, checks
 * the role is exactly 'admin', and confirms the admin's status is 'active' in
 * the database. Throws a typed AuthError on any failure.
 *
 * The DB check (status === 'active') is deliberate — it costs one indexed
 * findById per admin request but provides immediate revocation when an admin
 * is disabled. With a small admin set this is the right trade-off; see LOGS.md.
 *
 * Routes use this at the top of every protected admin handler:
 *
 *     try {
 *       const { adminId, admin } = await requireAdmin(req);
 *       // ... handler proceeds ...
 *     } catch (err) {
 *       return apiAuthErrorResponse(err);
 *     }
 *
 * The error-to-response translation lives in src/lib/api/errors.ts (task 1.5).
 * This file knows nothing about HTTP status codes — that's the route layer's
 * concern.
 *
 * Note: this guard is ASYNC (unlike requireUser) because it hits the DB. Call
 * sites must `await` it.
 */

import type { NextRequest } from 'next/server';
import { verifyToken } from '@/utils/jwt';
import type { IJwtPayload } from '@/utils/jwt';
import dbConnect from '@/config/dbConnect';
import Admin from '@/models/admin';
import type { IAdminDocument } from '@/models/admin';
import { AuthError } from '@/lib/api/errors';

const COOKIE_NAME = 'token';

/**
 * The shape this guard returns. Carries both the id (most routes only need
 * this) and the full admin document (for routes that need to read name/email
 * for logging, or write `lastLogin` etc.).
 */
export interface AdminAuthContext {
  adminId: string;
  role: 'admin';
  /** The decoded JWT payload, for routes that need other claims. */
  payload: IJwtPayload;
  /** The full Admin document, freshly loaded. */
  admin: IAdminDocument;
}

/**
 * Verifies the admin's cookie, checks role, and confirms the admin is active
 * in the DB. Returns the auth context on success. Throws AuthError otherwise.
 *
 * Failure codes:
 *   - MISSING_AUTH_COOKIE — no `token` cookie on the request
 *   - INVALID_TOKEN       — verifyToken returned null (bad signature, expired, malformed)
 *   - MISSING_USER_ID     — token verified but payload had no userId
 *   - WRONG_ROLE          — token verified but role isn't 'admin' (a user token used here)
 *   - ADMIN_NOT_FOUND     — token's userId doesn't resolve to an Admin record (admin deleted mid-session)
 *   - ADMIN_NOT_ACTIVE    — admin exists but status is 'inactive' (immediate revocation)
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminAuthContext> {
  // Cookie lookup. Next's NextRequest cookies API returns { name, value } | undefined.
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) {
    throw new AuthError(
      'MISSING_AUTH_COOKIE',
      'Authentication cookie is required'
    );
  }

  // Collapse all token-verification failures to one client-facing error code.
  // Distinguishing "expired" from "bad signature" leaks information.
  const payload = verifyToken(cookie.value);
  if (!payload) {
    throw new AuthError(
      'INVALID_TOKEN',
      'Authentication token is invalid or expired'
    );
  }

  if (!payload.userId) {
    // Should be impossible — signToken requires userId — but defensive.
    throw new AuthError(
      'MISSING_USER_ID',
      'Authentication token is missing userId'
    );
  }

  // Strict role check: must be exactly 'admin'. User tokens (role 'user'),
  // roleless tokens, and any legacy roles ('editor', 'viewer') are rejected.
  if (payload.role !== 'admin') {
    throw new AuthError(
      'WRONG_ROLE',
      'This endpoint requires an admin token'
    );
  }

  // DB check. The cost (one indexed findById) buys immediate revocation when
  // an admin is disabled mid-session. With a tiny admin set this is the right
  // trade-off; see LOGS.md for the deliberation.
  //
  // dbConnect is idempotent (cached connection) — calling it from every guard
  // is the standard pattern and not a per-request cost.
  await dbConnect();
  const admin = await Admin.findById(payload.userId);
  if (!admin) {
    // Admin record was deleted while their session was still valid. Treat as
    // a normal auth failure rather than a 500; the session is genuinely gone.
    throw new AuthError(
      'ADMIN_NOT_FOUND',
      'Authenticated admin no longer exists'
    );
  }

  if (admin.status !== 'active') {
    throw new AuthError(
      'ADMIN_NOT_ACTIVE',
      'Admin account is not active'
    );
  }

  return {
    adminId: payload.userId,
    role: 'admin',
    payload,
    admin,
  };
}