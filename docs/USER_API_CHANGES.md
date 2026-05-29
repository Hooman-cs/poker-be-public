# USER_API_CHANGES.md — Auth Contract Update (Google login)

This supersedes the AUTH section of `user_api_contracts.pdf`. Everything in the PDF
OUTSIDE of auth (wallet, banks, payments, lobby) is UNCHANGED. The mobile app
(`ApiCaller.js`) — which we own — must be updated to match the new auth flow below.

## Removed (no longer exist)
- `POST /api/auth/otp/request`  — REMOVED (OTP was India-only)
- `POST /api/auth/otp/verify`   — REMOVED

## New auth flow (Google, works in all countries)

The mobile app uses the native Google Sign-In SDK to obtain a Google **ID token**,
then sends that token to the backend. The backend verifies it against Google's
public keys (`google-auth-library`), creates or loads the user, and issues the app's
own JWT (Bearer token) exactly as before.

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
  token: string,              // our JWT Bearer token (unchanged downstream)
  userId: string,
  userName: string,           // auto-generated unique name on first login
  isNewUser: boolean,         // true on first login → app shows username onboarding
  usernameLocked: boolean,    // whether the username has been confirmed/locked
  wallet: {
    balance: number,          // MINOR units (paise/cents)
    instantBonus: number,
    lockedBonus: number,
    currency: "INR" | "USD"
  }
}
Notes:
- First login: verifies Google token, creates User (with a google authProvider entry),
  creates Wallet, grants signup bonus, returns isNewUser=true.
- Returning user: loads by googleId, updates lastLogin/deviceType, returns isNewUser=false.
- Blocked/suspended accounts are rejected (same rule as before).
- Money fields are integer minor units + a currency code (new — see money model change).

## Username onboarding (NEW — set once at registration)

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
- Rejects if usernameLocked is already true (409/400) — username is set ONCE.
- Uniqueness is checked case-insensitively ("Shadow" == "shadow").
- On success the username is saved and usernameLocked is set true.

## Mobile app (ApiCaller.js) changes required
- Remove requeastOtp_Post / verifyLogin_Post.
- Add Google sign-in → googleLogin_Post({ idToken, deviceType }).
- Add username onboarding calls (suggestions + setUsername) shown when isNewUser.
- Everything else (wallet, banks, payments, lobby, history) keeps its existing calls,
  except amounts are now minor units + carry a currency code.

## Backend dependencies (parking lot)
- GOOGLE_CLIENT_ID env var (from a Google Cloud OAuth client configured for the apps).
- npm: google-auth-library (token verification).
