# USER_API_CHANGES.md — Auth Contract + Money Format Update

This supersedes the AUTH section of `user_api_contracts.pdf` AND the money-field
shapes throughout it. The mobile app (`ApiCaller.js`) — which we own — must be
updated to match.

Two distinct changes are captured here:
1. **Auth flow** — OTP removed, Google added.
2. **Money format on the wire** — outbound money is now a formatted display
   string (e.g. `"₹12.34"`), not a number. Inbound money is still an integer
   in minor units.

---

## Change 1 — Auth flow

### Removed (no longer exist)
- `POST /api/auth/otp/request`  — REMOVED (OTP was India-only)
- `POST /api/auth/otp/verify`   — REMOVED

### New auth flow (Google, works in all countries)

The mobile app uses the native Google Sign-In SDK to obtain a Google **ID token**,
then sends that token to the backend. The backend verifies it against Google's
public keys (`google-auth-library`), creates or loads the user, and issues the
app's own JWT (Bearer token).

### POST /api/auth/google
Auth: none (this is how you authenticate)
REQUEST BODY
{
  idToken: string,            // Google ID token from the native SDK
  deviceType?: "android" | "ios" | "unknown"
}
RESPONSE
{
  message: string,
  token: string,              // our JWT Bearer token
  userId: string,
  userName: string,           // auto-generated unique name on first login
  isNewUser: boolean,         // true on first login → app shows username onboarding
  usernameLocked: boolean,    // whether the username has been confirmed/locked
  wallet: {
    balance: string,          // formatted display string, e.g. "₹12.34"
    instantBonus: string,     // formatted display string
    lockedBonus: string,      // formatted display string
    currency: "INR" | "USD"
  }
}
Notes:
- First login: verifies Google token, creates User (with a google authProvider entry),
  creates Wallet, grants signup bonus, returns isNewUser=true.
- Returning user: loads by googleId, updates lastLogin/deviceType, returns isNewUser=false.
- Blocked/suspended accounts are rejected.
- Wallet amounts are formatted strings — see Change 2 below for the full rationale.

## Username onboarding (set once at registration)

On first login the app shows the generated username and lets the user keep it or pick
another available one. Once confirmed, it is permanent (usernameLocked = true).

### GET /api/user/username/suggestions
Auth: Bearer token
RESPONSE
{ suggestions: string[] }     // a few currently-available unique candidates

### PATCH /api/user/username
Auth: Bearer token
REQUEST BODY
{ username: string }
RESPONSE
{ message: string, userName: string, usernameLocked: true }
Notes:
- Rejects if usernameLocked is already true (409/400).
- Uniqueness is checked case-insensitively ("Shadow" == "shadow").
- On success the username is saved and usernameLocked is set true.

---

## Change 2 — Money format on the wire

### Rule
**Outbound money fields are formatted display strings.** Examples: `"₹12.34"`, `"$5.00"`.
**Inbound money fields are integers in minor units.** Example: `1234` paise = ₹12.34.

This applies to EVERY money field across EVERY user-facing endpoint, including
the ones still documented in the original PDF.

### Why
The mobile app does not perform arithmetic on money (by design — see LOGS.md).
The backend is the system of record for monetary display. Sending a formatted
string ensures the user sees exactly what the server recorded; the frontend
just renders the string as text.

### Affected outbound fields (originally `number` in the PDF — now `string`)
- `wallet.balance`, `wallet.instantBonus`, `wallet.lockedBonus`
- `walletTransaction.amount.total` and every breakdown field (cashAmount, instantBonus, lockedBonus, gst, tds, otherDeductions)
- `bankTransaction.amount`
- `gatewayTransaction.amount` (and the flattened `pmgTransaction.amount` admin shape)
- `pokerGameArchive.totalPot`, `pokerGameArchive.players[*].startingStack/endingStack/totalBet`, `pokerGameArchive.pots[*].totalAmount` and `pots[*].winners[*].amount` — i.e. every money field in game-history responses
- Lobby `desks/best` and `games` responses — any per-desk `stake`, `minBuyIn`, `maxBuyIn`, seat balances, observed `totalPot`

### Inbound fields (unchanged — still integers in minor units)
- Deposit/withdraw amounts in bank-transaction creation requests
- Razorpay order-creation amounts
- Any future "submit an amount" body field

### Mobile app rendering
The app just inserts the string into UI text — no formatter, no math. If a
display feature ever needs the raw number (e.g. a balance progress bar that
goes from 0% to 100%), the backend will expose an endpoint that returns the
precomputed result, NOT the raw number for the app to compute.

### Currency field stays as a code
`currency` remains `"INR" | "USD"` — it's a discriminator and a label, not
formatted text. The mobile app uses it for things like "All amounts in INR"
banners or locale switches.

---

## Mobile app (ApiCaller.js) changes required

- Remove requeastOtp_Post / verifyLogin_Post.
- Add Google sign-in → googleLogin_Post({ idToken, deviceType }).
- Add username onboarding calls (suggestions + setUsername) shown when isNewUser.
- **All money fields in responses are now strings.** Display them as-is. Do NOT
  parse them back into numbers. Do NOT perform arithmetic on them. If a feature
  needs computed money, request the computed result from the backend.
- Inbound money (deposit amounts, etc.) is still integer minor units sent as
  JSON `number`. Do NOT format these before sending.
- Add the new `GET /api/user/games/history` endpoint call.
- **`GET /api/lobby/games` response shape change:** the top-level data key is now
  `games` (not `pokerData` or any other prior key). Full shape:
  ```
  { message, games: [{ pokerGameId, gameType, description, modes: [{ modeId,
  modeType, stake, bigBlind, minBuyIn, maxBuyIn, currency, desks: [{ deskId,
  tableName, playerCount, maxPlayers, gameStatus, totalPot }] }] }] }
  ```
  Access via `response.games`, not `response.pokerData` / `response.data`.

## Backend dependencies (parking lot)
- GOOGLE_CLIENT_ID env var (from a Google Cloud OAuth client configured for the apps).
- npm: google-auth-library (token verification).