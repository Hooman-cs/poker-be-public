/**
 * @fileoverview Money helpers at the API edge.
 *
 * The boundary between "money as integer minor units" (DB + service + engine)
 * and "money as a string humans see" (mobile app + admin frontend) lives here.
 *
 * Routes use these helpers — NOT formatMoney directly — so the formatting
 * discipline is visible in every route file and consistent across the app.
 *
 * Outbound (responses):
 *   serializeMoney(1234, 'INR')  ->  "₹12.34"
 *   serializeMoneyFields(obj, ['balance', 'instantBonus'], 'INR')
 *     mutates a copy and returns it with those fields replaced by strings.
 *
 * Inbound (request bodies):
 *   parseAmount(req.body.amount, 'INR')  ->  number (integer minor units)
 *   Throws InvalidAmountError on anything that isn't a non-negative integer
 *   in a valid range. The route translates the error to HTTP 400.
 *
 * IMPORTANT CONVENTION:
 *   Outbound money is ALWAYS a formatted string. The frontend NEVER does math
 *   on money — it displays the string. If math is needed for a feature, the
 *   backend exposes an endpoint that returns the precomputed result (e.g. a
 *   list of valid withdrawal increments) rather than the frontend computing.
 *   See LOGS.md for the deliberation.
 *
 *   Inbound money is ALWAYS an integer in minor units. Floats, decimal strings,
 *   negatives, and NaN are rejected at the API edge before they reach the
 *   service or the model's float-guard. parseAmount is the gate.
 *
 *   Practice-mode amounts are still real integers in real wallets/seats, but
 *   they are NOT real money. Routes that serve practice-mode amounts should
 *   either omit the currency symbol (call serializeMoney with a synthetic
 *   "chips" label and handle that case in the response shape) OR clearly
 *   indicate "practice" in the surrounding response so users can't confuse
 *   chips with rupees. This file does not know which is which — that's the
 *   route's job. Flagging here so it's not forgotten when Phase 3 builds
 *   the practice lobby/joining flows.
 */

import { formatMoney, MINOR_UNITS, Currency } from '@/config/constants';

// ============================================================================
// Outbound — minor units -> formatted display string
// ============================================================================

/**
 * Converts an integer minor-unit amount to its display string.
 * Thin wrapper over formatMoney; exists so routes import from `@/lib/api/money`
 * (the boundary file) rather than reaching into `@/config/constants` (frozen
 * core). This keeps the layering clean — frozen-core is for math, lib/api is
 * for the wire.
 *
 * @throws if currency is unknown or value is not a safe integer (constants.ts guards).
 */
export function serializeMoney(minor: number, currency: Currency): string {
  return formatMoney(minor, currency);
}

/**
 * Convenience: takes a plain object and a list of field names that hold
 * integer minor amounts, returns a NEW object with those fields replaced by
 * formatted strings. Non-money fields pass through untouched.
 *
 * Use this in routes returning multi-field money payloads (wallet, transaction
 * breakdowns) so you don't repeat serializeMoney for each field.
 *
 * Example:
 *   const wallet = await Wallet.findOne({ userId }).lean();
 *   return Response.json({
 *     wallet: serializeMoneyFields(
 *       wallet,
 *       ['balance', 'instantBonus', 'lockedBonus'],
 *       wallet.currency
 *     ),
 *   });
 *
 * The function does NOT mutate the input. The output's typed fields are
 * widened to `string | number` because TypeScript can't narrow per-key
 * after a dynamic replace; callers can assert the response shape they
 * actually return.
 */
export function serializeMoneyFields<T extends Record<string, unknown>>(
  obj: T,
  fields: ReadonlyArray<keyof T>,
  currency: Currency
): { [K in keyof T]: K extends (typeof fields)[number] ? string : T[K] } {
  const out: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    const raw = obj[f];
    if (typeof raw !== 'number') {
      throw new Error(
        `serializeMoneyFields: field "${String(f)}" is not a number; got ${typeof raw}`
      );
    }
    out[f as string] = formatMoney(raw, currency);
  }
  return out as { [K in keyof T]: K extends (typeof fields)[number] ? string : T[K] };
}

// ============================================================================
// Inbound — request body value -> integer minor units (with strict validation)
// ============================================================================

/**
 * Thrown by parseAmount when an inbound amount is malformed. The route
 * translates this to HTTP 400 via the error helper (task 1.5). The `code`
 * is stable for logging.
 */
export class InvalidAmountError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'InvalidAmountError';
    this.code = code;
  }
}

/** Upper bound on a single amount: 1 trillion minor units (10 billion INR). */
const MAX_AMOUNT_MINOR = 1_000_000_000_000;

/**
 * Strict parse + validate of an inbound amount. Returns the value as a
 * non-negative integer in the given currency's minor units, or throws.
 *
 * Acceptance rules:
 *   - MUST be a JavaScript number (not a string — we don't coerce strings on
 *     purpose; the contract says number, and accepting "1234" would mask
 *     mobile-app bugs that should be fixed at the source).
 *   - MUST be a finite, safe integer (rejects NaN, Infinity, 12.34, 1e20).
 *   - MUST be >= 0 (rejects negatives — debits are expressed by transaction
 *     type, not by sign).
 *   - MUST be <= MAX_AMOUNT_MINOR (sanity check against accidental ten-zero
 *     amounts that would otherwise pass through to the service).
 *   - currency MUST be a known supported currency (looked up via MINOR_UNITS).
 *
 * Failure codes:
 *   - INVALID_AMOUNT_TYPE   — value isn't a number
 *   - INVALID_AMOUNT_VALUE  — value is NaN, Infinity, non-integer, negative,
 *                             or out of range
 *   - UNKNOWN_CURRENCY      — currency code not supported
 */
export function parseAmount(value: unknown, currency: Currency): number {
  // Type gate. Strict on "must be number" — string-to-number coercion has
  // bitten too many APIs to be worth accepting "1234" silently.
  if (typeof value !== 'number') {
    throw new InvalidAmountError(
      'INVALID_AMOUNT_TYPE',
      `Amount must be a number; got ${typeof value}`
    );
  }

  // Value gate. Number.isInteger covers NaN, Infinity, and floats in one check.
  if (!Number.isInteger(value)) {
    throw new InvalidAmountError(
      'INVALID_AMOUNT_VALUE',
      `Amount must be an integer in minor units; got ${value}`
    );
  }

  // Range gate. Both bounds.
  if (value < 0) {
    throw new InvalidAmountError(
      'INVALID_AMOUNT_VALUE',
      `Amount must be non-negative; got ${value}`
    );
  }
  if (value > MAX_AMOUNT_MINOR) {
    throw new InvalidAmountError(
      'INVALID_AMOUNT_VALUE',
      `Amount exceeds maximum allowed (${MAX_AMOUNT_MINOR} minor units); got ${value}`
    );
  }

  // Currency gate. MINOR_UNITS doubles as the supported-currency registry.
  if (!(currency in MINOR_UNITS)) {
    throw new InvalidAmountError(
      'UNKNOWN_CURRENCY',
      `Unsupported currency: ${currency}`
    );
  }

  return value;
}