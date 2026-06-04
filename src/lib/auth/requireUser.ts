/**
 * @fileoverview User auth guard — Bearer token verifier for user-facing routes.
 *
 * Reads the `Authorization: Bearer <token>` header from a Next.js request,
 * verifies the token via the shared signToken/verifyToken utility, and returns
 * the decoded payload. Throws a typed AuthError on any failure (missing header,
 * malformed header, invalid/expired token, wrong role).
 *
 * Routes use this at the top of every protected user handler:
 *
 *     try {
 *       const { userId } = requireUser(req);
 *       // ... handler proceeds with userId ...
 *     } catch (err) {
 *       return apiAuthErrorResponse(err);
 *     }
 *
 * The error-to-response translation lives in src/lib/api/errors.ts (task 1.5).
 * This file knows nothing about HTTP status codes — that's the route layer's
 * concern.
 */

import type { NextRequest } from 'next/server';
import { verifyToken } from '@/utils/jwt';
import type { IJwtPayload } from '@/utils/jwt';
import { AuthError } from '@/lib/api/errors';

/** Header name. Standard, but centralized so a future change is one place. */
const AUTH_HEADER = 'authorization';

/** Required prefix on the header value. Case-insensitive in the wild but we
 *  normalize before comparing. */
const BEARER_PREFIX = 'bearer ';

/**
 * The shape this guard returns. A narrowed version of IJwtPayload that
 * guarantees `userId` is present (the raw payload type makes it required,
 * but verifyToken's return passes through whatever was signed — we re-check).
 *
 * `role` is included in case a route wants to log it or branch on it, but
 * is otherwise informational here; the role check has already happened.
 */
export interface UserAuthContext {
  userId: string;
  role: 'user';
  /** The decoded JWT payload, in case a route needs other claims (exp, iat). */
  payload: IJwtPayload;
}

/**
 * Verifies the request's Bearer token. Returns the user's auth context on
 * success. Throws AuthError on any failure (the route layer catches and
 * translates to 401).
 *
 * Failure codes:
 *   - MISSING_AUTH_HEADER — no Authorization header on the request
 *   - INVALID_AUTH_SCHEME — header didn't start with "Bearer "
 *   - EMPTY_TOKEN        — header was "Bearer " with no value after
 *   - INVALID_TOKEN      — verifyToken returned null (bad signature, expired, malformed)
 *   - MISSING_USER_ID    — token verified but payload had no userId (shouldn't happen)
 *   - WRONG_ROLE         — token verified but role isn't 'user' (an admin token used here)
 */
export function requireUser(req: NextRequest): UserAuthContext {
  // Next.js's NextRequest headers are case-insensitive, but we lowercase
  // the lookup key defensively in case this is ever called with a plain
  // Request object in a test or alternate transport.
  const header = req.headers.get(AUTH_HEADER);
  if (!header) {
    throw new AuthError(
      'MISSING_AUTH_HEADER',
      'Authorization header is required'
    );
  }

  // The Bearer scheme: "Bearer <token>". Case-insensitive on "Bearer".
  if (!header.toLowerCase().startsWith(BEARER_PREFIX)) {
    throw new AuthError(
      'INVALID_AUTH_SCHEME',
      'Authorization header must use the Bearer scheme'
    );
  }

  // Slice off the prefix using the actual length (not the lowercase one,
  // which happens to match — but coding to the original avoids a subtle
  // bug if the prefix is ever changed).
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new AuthError('EMPTY_TOKEN', 'Bearer token is empty');
  }

  // verifyToken returns null on ANY failure (bad signature, expired,
  // malformed). We collapse all of these to one client-facing error code
  // — there's no useful distinction to expose, and revealing "expired vs
  // invalid signature" is a minor information leak.
  const payload = verifyToken(token);
  if (!payload) {
    throw new AuthError('INVALID_TOKEN', 'Authentication token is invalid or expired');
  }

  if (!payload.userId) {
    // Should be impossible — signToken requires userId — but defensive
    // because the JWT payload is just whatever was signed, and a misissued
    // token shouldn't crash the route. Surface as a normal auth failure.
    throw new AuthError(
      'MISSING_USER_ID',
      'Authentication token is missing userId'
    );
  }

  // Role check. User tokens must carry role 'user'. We DO NOT accept tokens
  // with no role (those would silently elevate older tokens issued before
  // we enforced the field). Admin tokens (role 'admin') are explicitly
  // rejected here so an admin can't accidentally hit user endpoints under
  // their admin session.
  if (payload.role !== 'user') {
    throw new AuthError(
      'WRONG_ROLE',
      'This endpoint requires a user token'
    );
  }

  return {
    userId: payload.userId,
    role: 'user',
    payload,
  };
}