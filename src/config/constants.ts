/**
 * @fileoverview Application Constants & Money Utilities
 *
 * SINGLE SOURCE OF TRUTH for:
 *   - all magic numbers (bonuses, limits, timers)
 *   - the supported currencies and their minor-unit scale
 *   - the ONLY money conversion/formatting functions in the app
 *
 * MONEY RULE (read this before touching any amount anywhere):
 *   Every monetary value is stored and computed as an INTEGER in the currency's
 *   MINOR UNIT (paise for INR, cents for USD). Never store or do math on a
 *   floating-point major value (e.g. 12.34). Convert to a decimal string ONLY
 *   at the very edge (API response / UI) using formatMoney(). Convert user input
 *   (a decimal they typed) into minor units with toMinor() as early as possible.
 *
 *   Examples:  ₹12.34  ->  1234 (minor)      $5.00  ->  500 (minor)
 */

// -----------------------------------------------------------------------------
// Currencies
// -----------------------------------------------------------------------------

/** The currencies the platform supports. INR today; USD planned. */
export const SUPPORTED_CURRENCIES = ['INR', 'USD'] as const;

/** A currency code — narrowed to exactly the supported set. */
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** The default currency for new wallets / records. */
export const DEFAULT_CURRENCY: Currency = 'INR';

/**
 * How many minor units make up one major unit, per currency.
 * INR: 100 paise = ₹1.  USD: 100 cents = $1.
 * (If a 0- or 3-decimal currency is ever added, it goes here and nowhere else.)
 */
export const MINOR_UNITS: Record<Currency, number> = {
  INR: 100,
  USD: 100,
};

/** Display symbol per currency, used by formatMoney(). */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: '₹',
  USD: '$',
};

// -----------------------------------------------------------------------------
// Money helpers — the ONLY place decimal <-> integer conversion may happen
// -----------------------------------------------------------------------------

/**
 * Converts a human/major amount (e.g. 12.34 rupees) into integer minor units
 * (e.g. 1234 paise). Use this at the boundary where amounts ENTER the system
 * (user input, gateway responses expressed in major units).
 *
 * Rounds to the nearest minor unit to absorb float noise in the INPUT only;
 * the RESULT is a clean integer that all downstream math uses.
 *
 * @throws if the currency is unknown or the value is not finite.
 */
export function toMinor(major: number, currency: Currency = DEFAULT_CURRENCY): number {
  const scale = MINOR_UNITS[currency];
  if (scale === undefined) throw new Error(`Unknown currency: ${currency}`);
  if (!Number.isFinite(major)) throw new Error(`Invalid amount: ${major}`);
  return Math.round(major * scale);
}

/**
 * Converts integer minor units back to a major Number (e.g. 1234 -> 12.34).
 * Use ONLY when something genuinely needs the major numeric value. For display,
 * prefer formatMoney() so the symbol and fixed decimals come along too.
 *
 * @throws if the currency is unknown or the value is not a safe integer.
 */
export function toMajor(minor: number, currency: Currency = DEFAULT_CURRENCY): number {
  const scale = MINOR_UNITS[currency];
  if (scale === undefined) throw new Error(`Unknown currency: ${currency}`);
  if (!Number.isInteger(minor)) throw new Error(`Minor amount must be an integer: ${minor}`);
  return minor / scale;
}

/**
 * Formats integer minor units as a display string with symbol and fixed decimals.
 * e.g. formatMoney(1234, 'INR') -> "₹12.34"   formatMoney(500, 'USD') -> "$5.00"
 * This is the canonical way to render money in any API response or UI label.
 *
 * @throws if the currency is unknown or the value is not a safe integer.
 */
export function formatMoney(minor: number, currency: Currency = DEFAULT_CURRENCY): string {
  const scale = MINOR_UNITS[currency];
  if (scale === undefined) throw new Error(`Unknown currency: ${currency}`);
  if (!Number.isInteger(minor)) throw new Error(`Minor amount must be an integer: ${minor}`);

  const decimals = Math.log10(scale); // 100 -> 2 decimal places
  const major = (minor / scale).toFixed(decimals);
  return `${CURRENCY_SYMBOL[currency]}${major}`;
}

// -----------------------------------------------------------------------------
// Wallet / bonus
// -----------------------------------------------------------------------------

/** Signup bonus granted on first login, in MINOR units (₹10.00 = 1000 paise). */
export const SIGNUP_BONUS_MINOR = 1000;

/**
 * GST multiplier applied to deposits. The gross amount the user pays is split:
 *   cash      = round(amount / GST_MULTIPLIER)   <- credited as spendable balance
 *   gst       = amount - cash                    <- the tax portion
 *   instantBonus = gst                           <- bonus equal to the gst portion
 * All three are computed in MINOR units (integers). See razorpay/verify + bank status.
 */
export const GST_MULTIPLIER = 1.28;

// -----------------------------------------------------------------------------
// Bank accounts
// -----------------------------------------------------------------------------

/** Maximum saved bank accounts per user (enforced at the BankAccount model). */
export const MAX_BANK_ACCOUNTS = 5;

// -----------------------------------------------------------------------------
// OTP / auth
// -----------------------------------------------------------------------------

/** Max OTP requests allowed within OTP_WINDOW_MS before the user is blocked. */
export const OTP_MAX_REQUESTS = 3;

/** Rolling window (ms) over which OTP requests are counted. 10 minutes. */
export const OTP_WINDOW_MS = 10 * 60 * 1000;

/** How long (ms) a user is blocked after exceeding the request limit. 10 minutes. */
export const OTP_BLOCK_MS = 10 * 60 * 1000;

/** How long (ms) an issued OTP remains valid. 10 minutes. */
export const OTP_EXPIRY_MS = 10 * 60 * 1000;

// -----------------------------------------------------------------------------
// Gameplay timers / rules
// -----------------------------------------------------------------------------

/** Seconds a player has to act before the turn auto-resolves (check/fold). 60s. */
export const AUTO_FOLD_MS = 60 * 1000;

/** Consecutive skipped turns after which a player is treated as disconnected. */
export const MAX_SKIPS_BEFORE_DISCONNECT = 3;

/** Delay (ms) before auto-starting the next hand once a game finishes. */
export const NEXT_GAME_DELAY_MS = 5 * 1000;

// -----------------------------------------------------------------------------
// Practice mode
// -----------------------------------------------------------------------------

/** Starting stack (MINOR units) every player + bot begins a practice session with. */
export const PRACTICE_STARTING_STACK_MINOR = toMinor(1000); // 1000 major -> 100000 minor

/** Difficulty levels selectable for practice-mode bots. */
export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

// -----------------------------------------------------------------------------
// Auth lifetimes
// -----------------------------------------------------------------------------

/** Admin session lifetime. Token AND cookie both use this (kept in sync). */
export const ADMIN_TOKEN_TTL = '6h';
export const ADMIN_COOKIE_MAX_AGE_S = 6 * 60 * 60; // 21600 seconds

/** User session lifetime (issued by signToken on OTP verify). */
export const USER_TOKEN_TTL = '7d';