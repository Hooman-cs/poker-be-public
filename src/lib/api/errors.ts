/**
 * @fileoverview API error/response helpers — the boundary between thrown
 * typed errors (from auth guards, services, parsing helpers) and the HTTP
 * responses the client sees.
 *
 * Routes use this in two ways:
 *
 * 1) WRAP THE WHOLE HANDLER:
 *
 *      export async function POST(req: NextRequest) {
 *        try {
 *          const { userId } = requireUser(req);
 *          await dbConnect();
 *          const result = await someService.doThing({ userId, ... });
 *          return successResponse({ result });
 *        } catch (err) {
 *          return errorResponse(err);
 *        }
 *      }
 *
 * 2) RETURN SUCCESS DIRECTLY:
 *
 *      return successResponse({ wallet: { balance: '₹12.34', ... } });
 *      // -> 200 { message: 'OK', wallet: { ... } }
 *
 * Response envelope (locked across the whole app):
 *   Success: { message: string, ...named-data-fields }
 *   Error:   { message: string, code: string }
 *
 * Status code is the primary discriminator. The `code` field on error
 * responses is a stable machine-readable identifier the client can
 * dispatch on (e.g. "INSUFFICIENT_FUNDS" -> show top-up flow).
 */

import { NextResponse } from 'next/server';
import { ServiceError } from '@/services/gameService';
import { InvalidAmountError } from '@/lib/api/money';

// ============================================================================
// AuthError — promoted here from the two guard files
// ============================================================================
//
// Both `requireUser` and `requireAdmin` throw AuthError. The class lives here
// (not in lib/auth/) because errors are fundamentally a response-mapping
// concern: every error class in this file is something the response mapper
// knows how to translate. Co-locating means one import point for routes that
// want to discriminate, and one place to add new error classes.

/**
 * Thrown by the auth guards (and only the auth guards). All instances map
 * to HTTP 401 with the response body `{ message, code }`.
 *
 * The set of valid `code` values is defined by the guards themselves; this
 * class doesn't enforce a closed enum because we want adding a new auth
 * failure to be a one-line change, not a multi-file ceremony.
 */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

// ============================================================================
// Code -> HTTP status mapping
// ============================================================================
//
// The single source of truth for "which error code becomes which HTTP status."
// Routes do NOT decide status codes themselves — they throw a typed error and
// the response mapper translates. This makes the API's error semantics
// consistent across hundreds of endpoints and easy to audit (grep this table).

/** All auth-failure codes from the two guards. All map to 401. */
const AUTH_CODES = new Set<string>([
  'MISSING_AUTH_HEADER',
  'INVALID_AUTH_SCHEME',
  'EMPTY_TOKEN',
  'INVALID_TOKEN',
  'MISSING_USER_ID',
  'WRONG_ROLE',
  'MISSING_AUTH_COOKIE',
  'ADMIN_NOT_FOUND',
  'ADMIN_NOT_ACTIVE',
]);

/**
 * The HTTP status to return for a given error code.
 * Unknown codes fall through to 500 — every code we throw should be in here;
 * if you add a new typed error and forget to add it, the route still responds
 * cleanly but the bug is loud (every test hits a 500).
 */
function statusForCode(code: string): number {
  if (AUTH_CODES.has(code)) return 401;

  switch (code) {
    // ServiceError variants (see services/gameService.ts)
    case 'NOT_FOUND':
    case 'NOT_SEATED':
      return 404;

    case 'SEAT_TAKEN':
    case 'DESK_FULL':
    case 'ALREADY_SEATED':
      return 409;

    case 'INSUFFICIENT_FUNDS':
    case 'BUY_IN_OUT_OF_RANGE':
    case 'INVALID_STATE':
      return 400;

    // InvalidAmountError variants (see lib/api/money.ts)
    case 'INVALID_AMOUNT_TYPE':
    case 'INVALID_AMOUNT_VALUE':
    case 'UNKNOWN_CURRENCY':
      return 400;

    default:
      return 500;
  }
}

// ============================================================================
// Response builders
// ============================================================================

/** Shape of an error response body. The route never builds this manually. */
interface ErrorBody {
  message: string;
  code: string;
}

/**
 * Builds the success response. The envelope is `{ message, ...rest }`.
 * If `body` doesn't include a `message`, we default to 'OK'. Status defaults
 * to 200; pass 201 for creation endpoints.
 *
 * Note: the spread merges the caller's fields AFTER the default message, so
 * a caller who passes `{ message: 'Wallet credited', wallet: ... }` wins —
 * their message survives.
 */
export function successResponse(
  body: Record<string, unknown> = {},
  status: number = 200
): NextResponse {
  const envelope = { message: 'OK', ...body };
  return NextResponse.json(envelope, { status });
}

/**
 * Translates any caught error into a properly-shaped HTTP response.
 *
 * The translation logic:
 *   - AuthError / ServiceError / InvalidAmountError -> status from the
 *     mapping table above, body { message, code } from the error.
 *   - Anything else (programmer bug, mongoose error, network blip) ->
 *     500 with a sanitized message. The real error is logged server-side
 *     but NOT included in the response (would leak internals).
 *
 * In dev/test you can inspect the original error in your logs. In prod
 * the client only ever sees the sanitized 500 message.
 */
export function errorResponse(err: unknown): NextResponse {
  // The three typed errors we know how to translate. Each has a `code` and
  // `message` directly — that's the entire payload.
  if (
    err instanceof AuthError ||
    err instanceof ServiceError ||
    err instanceof InvalidAmountError
  ) {
    const status = statusForCode(err.code);
    const body: ErrorBody = { message: err.message, code: err.code };
    return NextResponse.json(body, { status });
  }

  // Anything else is a real surprise. Log the actual error server-side
  // (so you can debug it), respond with a sanitized 500 (so the client
  // never sees stack traces or DB connection strings).
  //
  // We use console.error rather than throwing — this function is the
  // last line of defense; if IT throws, the Next.js runtime returns
  // an opaque 500 anyway and we've lost the context.
  // eslint-disable-next-line no-console
  console.error('[errorResponse] unhandled error:', err);

  const body: ErrorBody = {
    message: 'An internal server error occurred',
    code: 'INTERNAL_ERROR',
  };
  return NextResponse.json(body, { status: 500 });
}