# CONTRACTS.md — Cross-phase callable surface

The authoritative reference for what every callable accepts and returns across
phase boundaries. When building a caller, look up the callee here BEFORE writing
code. If the entry disagrees with the code, the entry is wrong — fix the entry
in the same commit as the code.

## Why this file exists
Integration bugs come from the caller and the callee disagreeing about the
shape of what crosses the boundary between them. Memory and chat history are
not durable enough to keep them aligned. This file is.

## STATUS values
- **FROZEN** — Phase 0 frozen core. Editing requires the unlock process described in KEEP.md
  for the file's level: Level 1 (constants, user, wallet, jwt) requires written justification +
  cross-project ripple plan; Level 2 (engine, service) requires documented reason in LOGS.md +
  Tier-1 smoke test pass. Phase 1 demonstrated this process for two surgical bug fixes and
  one feature unlock (button rotation, task 1.9).
- **STABLE** — Phase complete; soft-frozen. May change with a deliberate
  version bump and a notification to all known callers.
- **DRAFT** — Mid-phase. May still change. Callers should confirm shape
  before depending on it.

## How to read an entry
Each entry has these sections (omit any that don't apply):
- **SIGNATURE** — exact TypeScript signature
- **INPUT** — each field, its meaning, units, constraints, required vs optional
- **OUTPUT** — each returned field; nullable cases
- **ERRORS** — typed errors thrown, with conditions
- **SIDE EFFECTS** — what is persisted or mutated
- **INVARIANTS** — guarantees about state after a successful call

## Discipline rule
Entry and code change in the SAME COMMIT. If the entry drifts, this file
becomes a lie, which is worse than not having it. When in doubt, the code
is truth and the entry is a description of the truth — never the other way
around.

---

# PHASE 0 — Frozen core (STATUS: FROZEN)

All entries in this section describe `src/services/gameService.ts` and the
engine helpers it composes. The underlying code is frozen via KEEP.md.

## gameService — Seat / wallet operations

### gameService.addUserToSeat

**SIGNATURE**
```ts
addUserToSeat(input: AddUserToSeatInput): Promise<IPokerDeskDocument>
```

**INPUT**
- `deskId: string` — desk's `_id` as string
- `userId: ObjectId | string` — the user seating themselves
- `seatNumber: number` — which seat at the desk
- `buyInAmount: number` — minor units. **CASH MODE:** validated against `[desk.minBuyIn, desk.maxBuyIn]`. **PRACTICE MODE:** IGNORED — practice always uses `PRACTICE_STARTING_CHIPS` (100000) regardless of what's passed.

**OUTPUT**
- The updated `IPokerDeskDocument` after save (seat appended).

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `InvalidStateError` — desk is closed (status === 'closed', post-closure — no new seats)
- `AlreadySeatedError` — user already has a seat at this desk
- `DeskFullError` — no seats available
- `SeatTakenError` — `seatNumber` is occupied
- `BuyInOutOfRangeError` — cash mode, buy-in outside `[minBuyIn, maxBuyIn]`
- `InsufficientFundsError` — cash mode, wallet balance < buyInAmount
- `InvalidStateError` — wallet currency does not match desk currency

**SIDE EFFECTS**
- Cash mode: wallet debit + `WalletTransaction(type='deskIn')` + seat create, all in one Mongo transaction (atomic).
- Practice mode: just appends the seat, no wallet writes, no transaction.
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- Money in/out of wallet ↔ seat is always integer minor units.
- After a successful cash-mode call, `wallet.balance + seat.balanceAtTable` equals the pre-call wallet balance.
- Gate is `desk.isPractice` (boolean). `isCashMode(desk.mode)` must NOT be used as the practice gate per LOGS.md 2026-06-07.

---

### gameService.userLeavesSeat

**SIGNATURE**
```ts
userLeavesSeat(input: UserLeavesSeatInput): Promise<UserLeavesSeatResult>
```

**INPUT**
- `deskId: string`
- `userId: ObjectId | string`

**OUTPUT**
- `desk: IPokerDeskDocument` — updated desk after seat removal
- `needsShowdown: boolean` — **TRUE** if the leave dropped the table to ≤1 active/all-in player. The caller MUST invoke `showdown({ deskId })` next.
- `finalChips: number | null` — **practice mode only:** the player's `balanceAtTable` at the moment of leaving (minor units). **Always `null` in cash mode.** Used by `server.ts` to close the `PracticeSession` record.

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `NotSeatedError` — user has no seat at this desk
- `InvalidStateError` — wallet currency mismatch (cash mode)

**SIDE EFFECTS**
- Mid-hand: if the leaver was an active player, marks them `'folded'`. If they were the current turn player, advances `currentTurnPlayer` to the next active player. (Without this, the game would stall.)
- Cash mode + `balanceAtTable > 0`: wallet credit + `WalletTransaction(type='deskWithdraw')` + seat removal, atomic.
- Cash mode + `balanceAtTable == 0`: just removes the seat (no wallet writes).
- Practice mode: removes the seat; captures `finalChips = seat.balanceAtTable` for the caller.
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- A leave never leaves `currentTurnPlayer` pointing at a folded player.
- `needsShowdown === true` ⇒ caller must call `showdown` to finalize the hand.
- **Between-hand closure (LOGS.md 2026-06-01):** after the seat is removed, if `desk.currentGame === null` AND `desk.firstGameStartedAt !== null` (warm desk) AND `desk.seats.length < 3`, `forceCloseDesk` is called. All remaining players are forced to leave (chips returned to wallets) and desk transitions to 'closed'. Mid-hand leaves do NOT trigger this — the post-showdown check handles it after the hand completes.
- `finalChips` is ALWAYS non-null when `desk.isPractice === true`. The socket server must check this to close the PracticeSession record (LOGS.md 2026-06-07).

---

### gameService.addUserBalanceAtTable

**SIGNATURE**
```ts
addUserBalanceAtTable(input: AddUserBalanceAtTableInput): Promise<IPokerDeskDocument>
```

**INPUT**
- `deskId: string`
- `userId: ObjectId | string`
- `amount: number` — minor units, must be positive

**OUTPUT**
- The updated desk after top-up.

**ERRORS**
- `InvalidStateError` — `amount <= 0`, or practice mode (top-up not allowed), or wallet currency mismatch
- `NotFoundError` — desk or wallet doesn't exist
- `NotSeatedError`
- `BuyInOutOfRangeError` — new `balanceAtTable` would exceed `desk.maxBuyIn`
- `InsufficientFundsError` — wallet balance < amount

**SIDE EFFECTS**
- Wallet debit + `WalletTransaction(type='deskIn')` + seat balance update, atomic.
- Practice mode: rejected outright.
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- Post-call `seat.balanceAtTable <= desk.maxBuyIn`.
- Top-up does NOT modify `seat.buyInAmount`? Yes it does — `buyInAmount` accumulates lifetime buy-in for the seat (used to compute starting stack on the next archive).

---

## gameService — Game lifecycle

### gameService.createGame

**SIGNATURE**
```ts
createGame(input: CreateGameInput): Promise<IPokerDeskDocument>
```

**INPUT**
- `deskId: string`

**OUTPUT**
- The desk with `currentGame` populated and `currentGameStatus = 'in-progress'`.

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `InvalidStateError` — game already in progress, or fewer than `desk.minToStart` eligible seats

**SIDE EFFECTS**
- Engine's `initializeGameState` deals hole cards, applies blinds/antes.
- Mirrors post-blind/ante balances back to seat docs.
- Sets `desk.currentGame` and `desk.currentGameStatus`.
- One save. Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- A new game starts with at least `desk.minToStart` players (cold desk) or at least 3 players (warm desk). See LOGS.md 2026-06-01 for the cold/warm/closed state machine.
- `desk.status === 'closed'` rejects the call immediately.
- Blinds/antes are taken from seat balances before any betting round begins.
- On the first successful hand, `desk.firstGameStartedAt` is set (cold → warm transition).
- **Button rotation (task 1.9, LOGS.md 2026-06-01):** `createGame` computes the next button position before calling `initializeGameState`. First hand on a desk picks the lowest-numbered eligible seat (rule 3A). Subsequent hands advance clockwise (next eligible seat with higher seatNumber, wrapping). The chosen `buttonSeatNumber` is persisted on the desk top-level field so it survives between hands.
- **Post-showdown closure (LOGS.md 2026-06-01):** after the hand concludes, if `desk.seats.length < 3`, `forceCloseDesk` is called — all remaining players are forced to leave (chips returned to wallets) and desk transitions to 'closed'.

---

### gameService.handlePlayerAction

**SIGNATURE**
```ts
handlePlayerAction(input: HandlePlayerActionInput): Promise<HandlePlayerActionResult>
```

**INPUT**
- `deskId: string`
- `userId: ObjectId | string` — the acting player
- `action: 'fold' | 'check' | 'call' | 'raise' | 'all-in'`
- `amount?: number` — required for `'raise'`, ignored otherwise. Minor units.

**OUTPUT**
- `desk: IPokerDeskDocument` — updated desk
- `progression: 'continue' | 'nextRound' | 'showdown'` — what the engine decided
- `needsShowdown: boolean` — **TRUE** ⇒ caller MUST invoke `showdown({ deskId })` next

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `InvalidStateError` — no game in progress, not the user's turn, user not in game, no active round, illegal action for the state

**SIDE EFFECTS**
- Applies the engine's action result to player, seat, totalBet, round actions.
- On `'continue'`: updates `currentTurnPlayer`.
- On `'nextRound'`: AUTO-ADVANCES synchronously — pushes the new round, appends community cards, resets turn. **Caller does NOT call `advanceGameRound` separately.**
- On `'showdown'`: sets `currentTurnPlayer = null`. Caller MUST call `showdown` next.
- One save. Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- `[INVARIANT]` After a successful call with `needsShowdown=true`, no further `handlePlayerAction` will succeed (currentTurnPlayer is null) until `showdown` is called.
- `[INVARIANT]` Money in/out of seats is always integer minor units.
- The engine's turn check rejects out-of-turn actions even before the mutex serializes them — defense in depth against double-firing.

---

### gameService.advanceGameRound

**SIGNATURE**
```ts
advanceGameRound(deskId: string): Promise<IPokerDeskDocument>
```

**INPUT**
- `deskId: string`

**OUTPUT**
- The desk with a new round appended.

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `InvalidStateError` — no game in progress, no active round, current round is already `'showdown'`

**SIDE EFFECTS**
- Pushes a new round, appends dealt community cards, sets `currentTurnPlayer` to first active.
- Runs inside `withDeskLock(deskId)`.

**WHEN TO CALL THIS**
- Most callers do NOT need this. `handlePlayerAction` auto-advances on `'nextRound'`.
- Use this for all-in run-out: when every remaining player is all-in, no betting action will trigger the auto-advance, so the lifecycle layer calls this explicitly to deal remaining streets.

---

### gameService.showdown

**SIGNATURE**
```ts
showdown(input: ShowdownInput): Promise<ShowdownResult>
```

**INPUT**
- `deskId: string`

**OUTPUT**
- `desk: IPokerDeskDocument` — `currentGame = null`, `currentGameStatus = 'finished'`
- `archive: { _id: ObjectId }` — the created `PokerGameArchive` document's id
- `potResults: { potNumber, amount, winners: [{ userId, username, amount }] }[]` — per-pot winners for broadcast

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `InvalidStateError` — no game in progress, or archive creation silently failed (defensive — shouldn't happen)

**SIDE EFFECTS**
- One `User.find` to build the `userId → username` map.
- Calls `calculatePots` over the game's rounds.
- Single-survivor short-circuit: if only one active/all-in player remains, skips the hand evaluator and awards each pot to the survivor (if they contributed to it). Otherwise calls `evaluatePots`.
- Credits winnings to each winner's `seat.balanceAtTable` (winners can appear in multiple pots; credits are accumulated per-userId).
- Calls `buildArchiveData` to produce the archive payload.
- Persists `PokerGameArchive.create` + `desk.save` in ONE Mongo transaction.
- Clears `desk.currentGame`, sets `currentGameStatus = 'finished'`.
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- `[INVARIANT]` Wallets are NOT touched at showdown. Winnings land in `seat.balanceAtTable`; they convert to wallet money only when the user leaves the seat (`userLeavesSeat`).
- `[INVARIANT]` The archive write and the desk cleanup commit together or roll back together. The system cannot end up with paid-out winnings and no archive.
- `[INVARIANT]` Archive `username` fields are always populated (the fix for the empty-username crash). Fallback is the literal string `'unknown'` if a user doc is unexpectedly missing — the showdown does not crash.

---

### gameService.withDeskLock

**SIGNATURE**
```ts
withDeskLock<T>(deskId: string, fn: () => Promise<T>): Promise<T>
```

**WHEN TO CALL THIS**
- Every desk-mutating service function MUST run inside this. The service's own functions already do; if you write a new desk-mutating function, wrap it.

**INVARIANTS**
- `[INVARIANT]` All mutations to a single desk are serialized in this process. Two concurrent calls for the same desk will run one-at-a-time.
- `[INVARIANT]` NEVER call another `withDeskLock(sameDeskId, ...)` from inside `fn` — that deadlocks.
- The mutex is in-memory and per-process. Safe for our single-process socket server. If we ever shard the game server across processes, this must move to a distributed lock.

---

## Service errors (typed)

All thrown from the service. The route/socket layer (Phase 3 / Phase 5) maps each to an HTTP status / socket error event.

| Class | code | Maps to |
|---|---|---|
| `ServiceError` | (base) | 500 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `InsufficientFundsError` | `INSUFFICIENT_FUNDS` | 400 |
| `SeatTakenError` | `SEAT_TAKEN` | 409 |
| `DeskFullError` | `DESK_FULL` | 409 |
| `AlreadySeatedError` | `ALREADY_SEATED` | 409 |
| `NotSeatedError` | `NOT_SEATED` | 404 |
| `BuyInOutOfRangeError` | `BUY_IN_OUT_OF_RANGE` | 400 |
| `InvalidStateError` | `INVALID_STATE` | 400 |

The Phase 3 task that builds the error-response helper (1.5) consumes this mapping.

---

## Engine (called by service; rarely cross-phase, but listed for completeness)

### engine.initializeGameState
Initializes deck, applies blinds/antes, deals hole cards. Returns `{ players, currentTurnPlayer, totalBet, pots, rounds, communityCards, deck }`. The service discards `deck` (not persisted).

**SIGNATURE (updated task 1.9, 2026-06-01):**
```ts
initializeGameState(
  seats: ISeat[],
  bType: 'blinds' | 'antes',
  stake: number,
  gameType: PokerGameType,
  minBuyIn: number,
  buttonSeatNumber: number       // NEW — see LOGS.md 2026-06-01
): IInitialGameState
```

SB/BB/UTG are derived from `buttonSeatNumber` rather than hardcoded to `players[0/1/2]`. Throws if eligible seat count < 3 (heads-up not supported per `minToContinue >= 3`). `players` array still preserves seat-arrival order; only role assignments change with rotation.

### engine.processPlayerAction
Pure. Returns `{ actionRecord, updatedPlayer, updatedSeatBalance, updatedTotalBet }`. The service applies these to documents.

### engine.determineRoundProgression
Pure. Returns `{ type: 'continue'|'nextRound'|'showdown', nextPlayerId, nextRoundName? }`. Round-closure considers only players still required to match (active + all-in); folded players' historical bets are excluded. [INVARIANT recorded in LOGS.md 2026-06-01.]

### engine.advanceRound (aliased `engineAdvanceRound` in service)
Pure. Composes `getNextRoundName + dealCards + getFirstActivePlayer`. Returns `{ newRound, newCommunityCards, nextTurnPlayer }`.

**SIGNATURE (updated task 1.9b, 2026-06-01):**
```ts
advanceRound(
  currentRoundName: RoundName,
  players: IGamePlayer[],
  existingCommunityCards: ICard[],
  seats: ISeat[],                 // NEW
  buttonSeatNumber: number        // NEW
): IAdvanceRoundResult
```

Post-flop first-actor is now button-relative (first active seat clockwise of the button, starting at SB) rather than the seat-arrival-order default that pre-button-rotation `getFirstActivePlayer` used. The service passes `desk.seats` and `desk.buttonSeatNumber ?? 1` at every call site.

### engine.buildArchiveData
Pure. Takes `(seats, players, potResults, totalPot, startedAt, usernameByUserId)`. The username map is required — the service builds it via one `User.find` before calling this. Returns `{ players, pots, totalPot, startedAt, completedAt }`. **The service must add `deskId`, `pokerModeId`, `gameType`, `currency` to the payload before saving** — these are top-level required fields on the archive model.

### engine.calculatePots (potCalculator)
Pure. Returns `WPot[]` from `IRound[]`. Handles main + side pots correctly.

### engine.evaluatePots (handEvaluator)
Pure. Returns `IEvaluatedPot[]` with winners and amounts. Uses `pokersolver` for Hold'em/Omaha. Integer split-pot math (`Math.floor(pot / n)` + remainder to first winner). Stud/Razz/5-Card-Draw branches retained as forward-compatible code but unreachable for now — `PokerGameType` is narrowed to `"Texas Hold'em" | 'Omaha'` (see LOGS.md 2026-06-01).

---

# PHASE 1 — Foundation (STATUS: DRAFT during phase; entries promote to STABLE at phase end)

## lib/auth.requireUser

**SIGNATURE**
```ts
requireUser(req: NextRequest): UserAuthContext
```
where
```ts
interface UserAuthContext {
  userId: string;
  role: 'user';
  payload: IJwtPayload;
}
```

**INPUT**
- `req: NextRequest` — the Next.js App Router request object. Reads `Authorization` header only.

**OUTPUT**
- `userId: string` — extracted from the JWT payload, guaranteed present.
- `role: 'user'` — literal type; tokens without this exact role are rejected.
- `payload: IJwtPayload` — the full decoded payload for routes that need other claims (exp, iat).

**ERRORS THROWN** (all are `AuthError` instances; all map to HTTP 401 at the route layer)
- `MISSING_AUTH_HEADER` — no Authorization header on the request
- `INVALID_AUTH_SCHEME` — header didn't start with "Bearer "
- `EMPTY_TOKEN` — header was "Bearer " with empty value
- `INVALID_TOKEN` — bad signature, expired, or malformed (collapsed for security)
- `MISSING_USER_ID` — verified token had no userId (shouldn't happen — defensive)
- `WRONG_ROLE` — token's role is not exactly `'user'` (rejects admin tokens, roleless tokens, legacy roles)

**SIDE EFFECTS**
- None. Pure synchronous read of headers + JWT verification.

**INVARIANTS**
- `[INVARIANT]` Any JWT issued for user-facing routes MUST be signed with `role: 'user'` explicitly. `signToken`'s payload type makes this optional, but `requireUser` rejects anything else. Phase 3 task 3.1 (POST /api/auth/google) must remember this.
- `[INVARIANT]` Auth failures throw, they do not return. Routes catch via try/catch; error-to-status mapping happens in `src/lib/api/errors.ts` (task 1.5).

## lib/auth.requireAdmin

**SIGNATURE**
```ts
requireAdmin(req: NextRequest): Promise<AdminAuthContext>
```
where
```ts
interface AdminAuthContext {
  adminId: string;
  role: 'admin';
  payload: IJwtPayload;
  admin: IAdminDocument;   // freshly loaded
}
```

**INPUT**
- `req: NextRequest` — reads the `token` httpOnly cookie. Not the Authorization header.

**OUTPUT**
- `adminId: string` — extracted from the JWT payload's `userId`.
- `role: 'admin'` — literal.
- `payload: IJwtPayload` — full decoded payload.
- `admin: IAdminDocument` — fresh DB load. Routes that need name/email/lastLogin use this; routes only doing CRUD use adminId.

**ERRORS THROWN**
- `AuthError('MISSING_AUTH_COOKIE')` → 401 — no `token` cookie present
- `AuthError('INVALID_TOKEN')` → 401 — bad signature, expired, or malformed (collapsed for security)
- `AuthError('MISSING_USER_ID')` → 401 — verified token had no userId (defensive)
- `AuthError('WRONG_ROLE')` → 401 — role isn't exactly `'admin'` (rejects user tokens, roleless tokens, legacy roles)
- `AuthError('ADMIN_NOT_FOUND')` → 401 — token's userId doesn't resolve to an Admin record (deleted mid-session)
- `AuthError('ADMIN_NOT_ACTIVE')` → **403** — admin exists but status isn't `'active'` (immediate revocation on disable)

**SIDE EFFECTS**
- One `dbConnect()` call (idempotent — cached connection, not per-request cost).
- One indexed `Admin.findById` per call.
- ASYNC — call sites must `await`.

**INVARIANTS**
- `[INVARIANT]` Any JWT issued for admin routes MUST be signed with `role: 'admin'` explicitly. Phase 4 task 4.1 (admin login) must remember this — same pattern as the user side.
- `[INVARIANT]` Token validity ≠ session validity. The DB check makes status revocation immediate; do not rely on the JWT alone to assert "this admin can act."
- `[INVARIANT]` Both auth guards throw `AuthError` (not the same class, but identical shape). The response mapper in `src/lib/api/errors.ts` should target the `code` field, not `instanceof`.

## lib/api.money — serializeMoney

**SIGNATURE**
```ts
serializeMoney(minor: number, currency: Currency): string
```

**INPUT**
- `minor: number` — integer minor units (paise/cents). Must be a safe integer.
- `currency: Currency` — `'INR' | 'USD'`.

**OUTPUT**
- Formatted display string, e.g. `"₹12.34"`, `"$5.00"`.

**ERRORS**
- Throws (from underlying `formatMoney`) if currency is unknown or value isn't an integer. These are programmer errors — routes should never see them in practice.

**SIDE EFFECTS** — none.

**INVARIANTS**
- `[INVARIANT]` Routes serialize EVERY outbound money field via this helper (or its convenience wrapper below). The mobile app never receives raw integer amounts and never does math on money. If a feature needs computed money, expose an endpoint that returns the precomputed result.

## lib/api.money — serializeMoneyFields

**SIGNATURE**
```ts
serializeMoneyFields<T>(obj: T, fields: ReadonlyArray<keyof T>, currency: Currency): T-shaped object with named fields replaced by strings
```

**INPUT**
- `obj` — any plain object.
- `fields` — which keys hold integer minor amounts.
- `currency` — the currency to format with.

**OUTPUT**
- A new object (no mutation) with the named fields replaced by formatted display strings. Non-money fields pass through untouched.

**ERRORS**
- Throws if any named field is not a number (catches "I passed the wrong field name" bugs loudly at the route).

**INVARIANTS**
- `[INVARIANT]` Use this for multi-field money payloads (wallet snapshot, transaction breakdown). Don't repeat `serializeMoney` per field in route code.

## lib/api.money — parseAmount

**SIGNATURE**
```ts
parseAmount(value: unknown, currency: Currency): number
```

**INPUT**
- `value: unknown` — the raw body value (typically a JSON-parsed `number`).
- `currency: Currency` — for validation that the currency is supported.

**OUTPUT**
- The same value as a non-negative safe integer in minor units.

**ERRORS** (all `InvalidAmountError`; route maps to 400)
- `INVALID_AMOUNT_TYPE` — value isn't a number (strings are NOT coerced)
- `INVALID_AMOUNT_VALUE` — NaN, Infinity, non-integer, negative, or exceeds `MAX_AMOUNT_MINOR`
- `UNKNOWN_CURRENCY` — currency code not supported

**SIDE EFFECTS** — none.

**INVARIANTS**
- `[INVARIANT]` All inbound money values pass through `parseAmount` at the API edge. The model's float-guards are last-line defense; this is first-line.
- `[INVARIANT]` Strings are NOT coerced to numbers. The contract says "number", and accepting `"1234"` would mask mobile-app bugs.
- `[INVARIANT]` Negatives are NOT accepted. Debits are expressed by transaction type (e.g. `'withdraw'`), not by sign.

## lib/api.errors — successResponse

**SIGNATURE**
```ts
successResponse(body?: Record<string, unknown>, status?: number): NextResponse
```

**INPUT**
- `body` — fields to include in the response. Defaults to `{}`.
- `status` — HTTP status. Defaults to 200. Use 201 for creation endpoints.

**OUTPUT**
- A `NextResponse` with body `{ message: 'OK', ...body }`. If `body` itself
  contains a `message` field, that wins (the default is a fallback only).

**INVARIANTS**
- `[INVARIANT]` Every successful response uses this helper. Routes never call
  `NextResponse.json` directly for success paths — that's how envelope drift starts.
- `[INVARIANT]` Response envelope is FLAT: `{ message, ...named-fields }`. No
  `success: true` flag, no `data` wrapper. HTTP status discriminates success
  from failure.

## lib/api.errors — errorResponse

**SIGNATURE**
```ts
errorResponse(err: unknown): NextResponse
```

**INPUT**
- `err: unknown` — anything caught in the route's try/catch.

**OUTPUT**
- `NextResponse` with body `{ message, code }` and an appropriate status:
  - `AuthError` -> 401
  - `ServiceError` (NOT_FOUND/NOT_SEATED) -> 404
  - `ServiceError` (SEAT_TAKEN/DESK_FULL/ALREADY_SEATED) -> 409
  - `ServiceError` (INSUFFICIENT_FUNDS/BUY_IN_OUT_OF_RANGE/INVALID_STATE) -> 400
  - `InvalidAmountError` -> 400
  - Anything else -> 500 with `code: 'INTERNAL_ERROR'` and a sanitized message

**SIDE EFFECTS**
- Logs unrecognized errors to `console.error` (server-side) before responding.

**INVARIANTS**
- `[INVARIANT]` Routes use ONE try/catch at the top, wrapping the whole handler
  body, and end the catch with `return errorResponse(err)`. This keeps the
  error-mapping logic in exactly one place across the whole app.
- `[INVARIANT]` Routes do NOT pick their own status codes. Throw a typed error;
  the helper maps. If a new error code is added to a service or guard and
  doesn't appear in the status table, every test of that path will hit a 500
  — the bug is loud, not silent.
- `[INVARIANT]` Unrecognized errors NEVER leak their original message to the
  client. Stack traces, mongoose error strings, and DB connection details
  stay server-side.

## lib/api.errors — AuthError (moved from auth guards)

**SIGNATURE**
```ts
class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
```

**WHERE IT'S THROWN**
- `requireUser` (six codes; see its entry)
- `requireAdmin` (six codes; see its entry)

**WHERE IT'S CAUGHT**
- `errorResponse` — maps to HTTP 401.

**INVARIANTS**
- `[INVARIANT]` Only the two auth guards throw `AuthError`. New auth-failure
  codes are added by extending the guards, not by introducing new throw sites.
  Exception: `googleVerify.ts` and `route.ts` also throw `AuthError` for
  Google-token failure and suspended accounts — added Phase 3.1 with matching
  entries in `statusForCode`.

# PHASE 3 — User API (STATUS: IN PROGRESS)

Each route gets an entry as it's built. Expected entries:
- `POST /api/auth/google` ✓ (see below)
- `GET /api/user/username/suggestions`
- `PATCH /api/user/username`
- `GET /api/user/wallet`
- `GET /api/user/wallet/transactions`
- ... etc per TASKS.md Phase 3

---

## [POST /api/auth/google]

**SIGNATURE**
```ts
POST /api/auth/google
Body: { idToken: string; deviceType?: 'android' | 'ios' | 'unknown' }
```

**INPUT**
- `idToken` — Google ID token from the native Google Sign-In SDK. String, required.
- `deviceType` — optional; one of `'android' | 'ios' | 'unknown'`. Stored on User doc for returning users; ignored if not one of the valid values.

**OUTPUT**
```ts
{
  message: string;
  token: string;           // JWT Bearer token (role: 'user', TTL: USER_TOKEN_TTL = '7d')
  userId: string;
  userName: string;        // user.username
  isNewUser: boolean;      // true on first login — app shows username onboarding
  usernameLocked: boolean; // false until user confirms via PATCH /api/user/username
  wallet: {
    balance: string;       // formatted display string e.g. "₹10.00"
    instantBonus: string;  // formatted display string
    lockedBonus: string;   // formatted display string
    currency: 'INR' | 'USD';
  };
}
```
HTTP 201 on new user created, HTTP 200 on returning user.

**ERRORS THROWN**
- `AuthError` (`MISSING_ID_TOKEN`) → 400 — `idToken` absent or not a string.
- `AuthError` (`INVALID_GOOGLE_TOKEN`) → 401 — Firebase token invalid/expired, or `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` env vars missing.
- `AuthError` (`ACCOUNT_SUSPENDED`) → 403 — `user.status === 'suspended'`.

**SIDE EFFECTS**
- **First login:** `User.create` + `Wallet.create` (balance = `SIGNUP_BONUS_MINOR`) + `WalletTransaction.create` (type `'bonus'`, remark `'signupBonus'`), all in one Mongo session/transaction.
- **Returning user:** `user.lastLogin = new Date()`, `user.deviceType` updated if valid value sent, then `user.save()`.

**INVARIANTS**
- `[INVARIANT]` JWT must be signed with `role: 'user'` explicitly — `IJwtPayload` makes `role` optional, omitting it causes `requireUser` to reject the token with `WRONG_ROLE`.
- `[INVARIANT]` Google provider ID is stored as `authProviders[].providerId`. `googleUserId` comes from `decodedToken.uid` (Firebase UID). Lookup query: `{ 'authProviders.provider': 'google', 'authProviders.providerId': googleUserId }`.
- `[INVARIANT]` `'signupBonus'` is not a valid `TransactionType`. Use `type: 'bonus'` with `remark: 'signupBonus'` for the signup bonus transaction.
- `[INVARIANT]` Wallet creation is guarded: `Wallet.findOne({ userId })` first. If wallet already exists (e.g. re-entrant call), skip creation. This prevents double-granting the signup bonus.

---

## [GET /api/user/username/suggestions]

**SIGNATURE**
```ts
GET /api/user/username/suggestions
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No request body.

**OUTPUT**
```ts
{ suggestions: string[] }   // 3 currently-available unique gamer names
```

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.

**SIDE EFFECTS**
- Read-only. Calls `User.exists` up to 60 times to check availability. No writes.

**INVARIANTS**
- `[INVARIANT]` Returns exactly 3 suggestions (may return fewer only if 60 generation attempts are exhausted — degenerate case, not expected in practice).
- `[INVARIANT]` Availability check is case-insensitive. A returned suggestion is available at time-of-check; the caller must tolerate a race (another user may claim it between check and PATCH).

---

## [PATCH /api/user/username]

**SIGNATURE**
```ts
PATCH /api/user/username
Headers: Authorization: Bearer <token>
Body: { username: string }
```

**INPUT**
- Bearer token (required).
- `username` — desired username string, trimmed before use. Must be non-empty.

**OUTPUT**
```ts
{ message: 'Username set', userName: string, usernameLocked: true }
```

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `AuthError` (`MISSING_USERNAME`) → 400 — body missing `username` or empty string.
- `AuthError` (`NOT_FOUND`) → 404 — userId from token no longer exists in DB (shouldn't happen).
- `AuthError` (`USERNAME_LOCKED`) → 409 — `user.usernameLocked === true`; username is permanent.
- `AuthError` (`USERNAME_TAKEN`) → 409 — case-insensitive match found on another user.

**SIDE EFFECTS**
- `user.username = trimmed; user.usernameLocked = true; user.save()` — one write.

**INVARIANTS**
- `[INVARIANT]` Uniqueness check excludes the current user (`_id: { $ne: user._id }`) so a user may confirm their existing auto-generated name without collision.
- `[INVARIANT]` Case-insensitive uniqueness is enforced at the API layer via regex. The Mongoose unique index on `username` is case-sensitive by default — the regex check is the real gate. Do not rely on the index alone for this.
- `[INVARIANT]` Once `usernameLocked === true`, no route may change `username` or unset the lock. The lock is permanent.

---

## [GET /api/user/wallet]

**SIGNATURE**
```ts
GET /api/user/wallet
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No request body.

**OUTPUT**
```ts
{
  wallet: {
    balance: string;       // formatted display string e.g. "₹10.00"
    instantBonus: string;  // formatted display string
    lockedBonus: string;   // formatted display string
    currency: 'INR' | 'USD';
  }
}
```

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `AuthError` (`NOT_FOUND`) → 404 — no wallet document for this userId.

**SIDE EFFECTS**
- Read-only. One `Wallet.findOne` query, no writes.

**INVARIANTS**
- `[INVARIANT]` All three balance fields (`balance`, `instantBonus`, `lockedBonus`) are serialized via `serializeMoney` — never returned as raw integers.

---

## [GET /api/user/wallet/transactions]

**SIGNATURE**
```ts
GET /api/user/wallet/transactions?page=1&limit=20
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No request body.
- `page` — query param, integer ≥ 1, default 1.
- `limit` — query param, integer 1–50, default 20. Capped at 50.

**OUTPUT**
```ts
{
  transactions: Array<{
    id: string;
    type: 'deposit' | 'withdraw' | 'deskIn' | 'deskWithdraw' | 'bonus' | 'pgDeposit';
    status: 'pending' | 'completed' | 'failed' | 'reversed';
    amount: {
      cashAmount: string;      // formatted display string
      instantBonus: string;
      lockedBonus: string;
      gst: string;
      tds: string;
      otherDeductions: string;
      total: string;
    };
    currency: 'INR' | 'USD';
    remark: string | null;
    deskId: string | null;
    completedAt: Date | null;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```
Sorted newest-first (`createdAt` descending).

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `AuthError` (`NOT_FOUND`) → 404 — no wallet document for this userId.

**SIDE EFFECTS**
- Read-only. `Wallet.findOne` + `WalletTransaction.find` + `WalletTransaction.countDocuments`. No writes.

**INVARIANTS**
- `[INVARIANT]` All seven `amount` sub-fields are serialized via `serializeMoney` — never returned as raw integers.
- `[INVARIANT]` `limit` is hard-capped at 50 server-side regardless of what the client sends.
- `[INVARIANT]` Transactions are scoped to the wallet matching the authenticated user's `userId` — callers cannot request another user's transactions.

---

## [GET /api/user/banks]

**SIGNATURE**
```ts
GET /api/user/banks
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No request body.

**OUTPUT**
```ts
{
  banks: Array<{
    id: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountHolderName: string;
    isDefault: boolean;
    status: 'active' | 'blocked' | 'inactive';
    createdAt: Date;
  }>;
}
```
Sorted newest-first (`createdAt` descending).

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.

**SIDE EFFECTS**
- Read-only. One `BankAccount.find` query.

**INVARIANTS**
- `[INVARIANT]` Results are scoped to the authenticated user's `userId`. `userId` is not included in the response (redundant — it's the caller's own account).

---

## [POST /api/user/banks]

**SIGNATURE**
```ts
POST /api/user/banks
Headers: Authorization: Bearer <token>
Body: { accountNumber: string; bankName: string; ifscCode: string; accountHolderName: string }
```

**INPUT**
- Bearer token (required).
- `accountNumber` — bank account number string, trimmed. Required.
- `bankName` — name of the bank, trimmed. Required.
- `ifscCode` — IFSC code, trimmed, stored uppercase (schema enforces). Required.
- `accountHolderName` — name on the account, trimmed. Required.

**OUTPUT**
Same shape as a single bank in the GET response, HTTP 201.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `AuthError` (`MISSING_BANK_FIELD`) → 400 — any required field absent or empty.
- `AuthError` (`BANK_LIMIT_REACHED`) → 400 — user already has 5 bank accounts.

**SIDE EFFECTS**
- `BankAccount.create(...)` — one write. If this is the user's first account (`countDocuments === 0`), `isDefault` is set to `true`.

**INVARIANTS**
- `[INVARIANT]` Maximum 5 bank accounts per user. Enforced both at the route layer (returns 400) and in the model's pre-save hook (backup). The route-level check is the primary gate — the hook error would surface as 500 without it.
- `[INVARIANT]` The first account added for a user is always set as the default (`isDefault: true`). Subsequent accounts default to `isDefault: false`. There is currently no endpoint to change the default — deferred to a later phase.

---

## [GET /api/user/banks/transactions]

**SIGNATURE**
```ts
GET /api/user/banks/transactions?page=1&limit=20
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No body.
- `page` — query param, integer ≥ 1, default 1.
- `limit` — query param, integer 1–50, default 20. Capped server-side at 50.

**OUTPUT**
```ts
{
  transactions: Array<{
    id: string;
    bankAccountId: string;
    type: 'deposit' | 'withdraw';
    status: 'pending' | 'completed' | 'failed';
    amount: string;       // formatted display string e.g. "₹500.00"
    currency: 'INR' | 'USD';
    imageUrl: string | null;
    remark: string | null;
    completedAt: Date | null;
    createdAt: Date;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Sorted newest-first.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401.

**SIDE EFFECTS**
- Read-only. `BankTransaction.find` + `BankTransaction.countDocuments`.

**INVARIANTS**
- `[INVARIANT]` `amount` is serialized via `serializeMoney` — never a raw integer.
- `[INVARIANT]` Results are scoped to the authenticated user's `userId`.

---

## [POST /api/user/banks/transactions]

**SIGNATURE**
```ts
POST /api/user/banks/transactions
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data
Body fields:
  type: 'deposit' | 'withdraw'
  bankAccountId: string
  amount: string  (integer minor units as a string — parsed via parseAmount)
  remark?: string
  image?: File    (required when type === 'deposit')
```

**INPUT**
- Bearer token (required).
- `type` — `'deposit'` or `'withdraw'`. Required.
- `bankAccountId` — ObjectId string of an active bank account owned by the user. Required.
- `amount` — minor-unit integer as a form string. Parsed via `parseAmount`. Required.
- `remark` — optional string, trimmed before save.
- `image` — File upload, required for deposit. Max size controlled by `MAX_FILE_SIZE` env (default 5 242 880 bytes). Saved to `UPLOAD_DIR` env (default `'uploads'`).

**OUTPUT**
```ts
{
  transaction: {
    id: string;
    bankAccountId: string;
    type: 'deposit' | 'withdraw';
    status: 'pending';   // always pending on creation
    amount: string;      // formatted display string
    currency: 'INR' | 'USD';
    imageUrl: string | null;
    remark: string | null;
    completedAt: null;
  }
}
```
HTTP 201.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401.
- `AuthError` (`MISSING_BANK_FIELD`) → 400 — `type`, `bankAccountId`, or `amount` absent or invalid.
- `AuthError` (`INVALID_BANK_ACCOUNT`) → 404 — bank account not found, not owned by user, or not `status: 'active'`.
- `AuthError` (`MISSING_IMAGE`) → 400 — deposit with no image, or image exceeds `MAX_FILE_SIZE`.
- `AuthError` (`INSUFFICIENT_BALANCE`) → 400 — withdraw amount exceeds wallet balance.
- `InvalidAmountError` (`INVALID_AMOUNT_*`) → 400 — `amount` is not a valid non-negative integer.

**SIDE EFFECTS**
- Deposit: saves image file to `UPLOAD_DIR` on disk. Creates `BankTransaction` (status: `'pending'`). No wallet mutation.
- Withdraw: checks wallet balance. Creates `BankTransaction` (status: `'pending'`). Does NOT deduct from wallet — deduction happens on admin approval (Phase 4).

**INVARIANTS**
- `[INVARIANT]` Withdrawal does NOT modify the wallet at creation time. Wallet deduction is Phase 4 (admin approval flow).
- `[INVARIANT]` `bankAccountId` is verified against the authenticated user's `userId` and `status === 'active'` before creating the transaction — prevents cross-user and blocked-account abuse.
- `[INVARIANT]` `amount` passes through `parseAmount` — raw form strings are never trusted as integers directly.
- `[INVARIANT]` Upload directory is created with `mkdir({ recursive: true })` before every write — the route is safe on first use even if the directory doesn't exist.

---

## [POST /api/payments/razorpay/order]

**SIGNATURE**
```ts
POST /api/payments/razorpay/order
Headers: Authorization: Bearer <token>
Body: { amount: number }   // integer minor units
```

**INPUT**
- Bearer token (required).
- `amount` — payment amount in minor units (paise). Integer ≥ 1. Validated via `parseAmount`.

**OUTPUT**
```ts
{
  orderId: string;    // Razorpay order ID (e.g. "order_xyz...")
  amount: number;     // raw minor-unit integer — passed directly to Razorpay checkout SDK
  currency: 'INR' | 'USD';
  keyId: string;      // RAZORPAY_KEY_ID — used to initialise the frontend SDK
}
```
HTTP 201. **Note:** `amount` is a raw integer here, not a formatted display string. The frontend passes it directly to the Razorpay checkout SDK, which requires the minor-unit integer.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `InvalidAmountError` (`INVALID_AMOUNT_*`) → 400 — amount missing, not a number, non-integer, negative, or out of range.
- `ServiceError` (`RAZORPAY_NOT_CONFIGURED`) → 500 — `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` env vars missing.

**SIDE EFFECTS**
- Calls `razorpay.orders.create` (external HTTP call to Razorpay).
- `GatewayTransaction.create({ ..., status: 'created', gatewayOrderId: order.id })` — one DB write.

**INVARIANTS**
- `[INVARIANT]` The Razorpay instance is module-level (created once at import time). Env var presence is validated inside the handler before use.
- `[INVARIANT]` `GatewayTransaction` is created AFTER the Razorpay order succeeds. If Razorpay fails, no DB record is written.
- `[INVARIANT]` `receipt` field sent to Razorpay is `${userId}-${Date.now()}` — max 38 chars, within Razorpay's 40-char limit.
- `[INVARIANT]` `amount` in the response is a raw integer (exception to the formatted-string convention). This is required by the Razorpay frontend SDK. Do not change to `serializeMoney`.

---

## [POST /api/payments/razorpay/verify]

**SIGNATURE**
```ts
POST /api/payments/razorpay/verify
Headers: Authorization: Bearer <token>
Body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
```

**INPUT**
- Bearer token (required).
- `razorpay_order_id` — Razorpay order ID from the checkout response. Required.
- `razorpay_payment_id` — Razorpay payment ID from the checkout response. Required.
- `razorpay_signature` — HMAC-SHA256 signature from the checkout response. Required.

**OUTPUT**
```ts
{ message: 'Payment verified', credited: string }
// credited = serializeMoney(cashAmount, currency) — formatted display string
```

**ERRORS THROWN**
- `AuthError` (any auth code) → 401 — missing/invalid/expired token.
- `AuthError` (`MISSING_BANK_FIELD`) → 400 — any of the three Razorpay fields absent or not a string.
- `AuthError` (`INVALID_PAYMENT_SIGNATURE`) → 400 — HMAC-SHA256 verification failed.
- `AuthError` (`NOT_FOUND`) → 404 — no `GatewayTransaction` with `gatewayOrderId === razorpay_order_id`.
- `AuthError` (`FORBIDDEN`) → 403 — `GatewayTransaction.userId` does not match the authenticated user.
- `AuthError` (`PAYMENT_ALREADY_PROCESSED`) → 400 — `GatewayTransaction.status !== 'created'` (duplicate callback).

**SIDE EFFECTS**
All three writes are in one Mongo session/transaction — atomic:
1. `Wallet.findOneAndUpdate({ userId }, { $inc: { balance: cashAmount } })` — credits spendable balance.
2. `WalletTransaction.create([{ type: 'deposit', status: 'completed', amount: { cashAmount, gst: gstAmount, total: grossAmount } }])`.
3. `GatewayTransaction.findByIdAndUpdate(gtx._id, { status: 'completed', gatewayPaymentId, gatewaySignature })`.

**INVARIANTS**
- `[INVARIANT]` HMAC verification runs BEFORE any DB read — forged requests are rejected without touching the database.
- `[INVARIANT]` Never double-credit: the route rejects if `gtx.status !== 'created'`. The status is updated to `'completed'` inside the transaction, making re-entrant calls safe.
- `[INVARIANT]` GST split and bonus amounts are read from `AppConfig.findOne({})` at request time. Fallbacks: `gstMultiplier = 1.28`, `depositBonusRate = 1.0`. If no AppConfig document exists the route works correctly with these defaults.
- `[INVARIANT]` `cashAmount = Math.round(gross / gstMultiplier)`, `gstAmount = gross - cashAmount`, `bonusAmount = Math.round(gstAmount * depositBonusRate)`. Both `wallet.balance` (cashAmount) and `wallet.instantBonus` (bonusAmount) are incremented in the same transaction.

---

## [AppConfig model]

**SHAPE**
```ts
interface IAppConfig {
  gstMultiplier: number;    // default 1.28 — gross / gstMultiplier = cash credited
  depositBonusRate: number; // default 1.0  — fraction of gstAmount credited as instantBonus (0–1)
}
```

**USAGE**
Singleton — at most one document in the collection. Read with `AppConfig.findOne({})`. Updated by admin via `findOneAndUpdate({}, {...}, { upsert: true })` (Phase 4 task 4.15).

**VALIDATORS**
- `gstMultiplier` must be `>= 1` (pre-save hook).
- `depositBonusRate` must be `>= 0` and `<= 1` (pre-save hook).

**CALLERS**
- `POST /api/payments/razorpay/verify` — reads at verify time to compute GST split and bonus.
- `POST /api/admin/config` (Phase 4) — writes the document.

**INVARIANTS**
- `[INVARIANT]` Both `gstMultiplier` and `depositBonusRate` have defaults baked into every caller (`?? 1.28` / `?? 1.0`) — the route is safe if no config document has been created yet.
- `[INVARIANT]` This is a singleton. Never create a second document. Admin update uses `upsert: true` on `findOneAndUpdate({}, ...)`.
- `[INVARIANT]` Updating `gstMultiplier` changes the cash/bonus split for ALL future deposits — existing `GatewayTransaction` records are not retroactively affected.

---

## [GET /api/lobby/games]

**SIGNATURE**
```ts
GET /api/lobby/games
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No query params or body.

**OUTPUT**
```ts
{
  games: Array<{
    pokerGameId: string;
    gameType: 'Texas Hold\'em' | 'Omaha';
    description: string | null;
    modes: Array<{
      modeId: string;
      modeType: string;           // PokerMode.mode field
      stake: string;              // formatted display string (SB amount)
      bigBlind: string;           // formatted display string = stake * 2
      minBuyIn: string;           // formatted display string
      maxBuyIn: string;           // formatted display string
      currency: 'INR' | 'USD';
      desks: Array<{
        deskId: string;
        tableName: string;
        playerCount: number;      // desk.seats.length — live count
        maxPlayers: number;       // desk.maxPlayerCount
        gameStatus: string;       // desk.currentGameStatus
        totalPot: string;         // formatted display string; "₹0.00" when no active game
      }>;
    }>;
  }>;
}
```

**ERRORS THROWN**
- `AuthError` (any auth code) → 401.

**SIDE EFFECTS**
- Read-only. Three sequential `find` queries: `Poker`, `PokerMode`, `PokerDesk`.

**INVARIANTS**
- `[INVARIANT]` Only `status: 'active'` documents are returned at all three levels — closed desks, disabled modes, and inactive game types are excluded.
- `[INVARIANT]` `bigBlind` is always computed as `mode.stake * 2` — it is never a separate stored field. Do not add a `bigBlind` field to any model.
- `[INVARIANT]` `totalPot` uses `desk.currentGame?.totalBet ?? 0` — zero when no game is in progress.
- `[INVARIANT]` All three queries use `.lean()` — no Mongoose document overhead in this read-heavy endpoint.
- `[INVARIANT]` All IDs in the response are `.toString()` strings, not ObjectId objects.

---

## [GET /api/lobby/desks/best]

**SIGNATURE**
```ts
GET /api/lobby/desks/best?modeId=<ObjectId>
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required).
- `modeId` — query param, ObjectId string of an active `PokerMode`. Required; 400 if absent.

**OUTPUT**
```ts
// When a desk with open seats exists:
{
  desk: {
    deskId: string;
    tableName: string;
    playerCount: number;        // desk.seats.length — live count
    maxPlayers: number;         // desk.maxPlayerCount
    availableSeats: number;     // maxPlayers - playerCount
    gameStatus: string;         // desk.currentGameStatus
    stake: string;              // formatted display string (sourced from PokerMode)
    bigBlind: string;           // formatted display string = stake * 2
    minBuyIn: string;           // formatted display string (sourced from PokerMode)
    maxBuyIn: string;           // formatted display string (sourced from PokerMode)
    currency: 'INR' | 'USD';    // sourced from PokerMode
    mode: string;               // PokerMode.mode value
  }
}

// When no desk has open seats:
{ desk: null }
```
HTTP 200 in both cases. `{ desk: null }` is a valid, expected response — not 404.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401.
- `AuthError` (`MISSING_BANK_FIELD`) → 400 — `modeId` query param absent.
- `AuthError` (`NOT_FOUND`) → 404 — `modeId` not a valid ObjectId, mode not found, or `mode.status !== 'active'`.

**SIDE EFFECTS**
- Read-only. `PokerMode.findById` + `PokerDesk.find` with `$expr/$size`.

**INVARIANTS**
- `[INVARIANT]` `{ desk: null }` (HTTP 200) is the correct response when no seat-available desk exists — do not change to 404.
- `[INVARIANT]` Desk selection uses MongoDB `$expr: { $lt: [{ $size: '$seats' }, '$maxPlayerCount'] }` to compare array length against a stored field. Do not attempt this comparison in application code after loading all desks.
- `[INVARIANT]` `stake`, `minBuyIn`, `maxBuyIn`, and `mode` in the response are sourced from the loaded `PokerMode` document — these fields do not exist on `IPokerDesk`. The mode is loaded in step 4 for this exact purpose.
- `[INVARIANT]` Sort is `{ seats: -1 }` to prefer fuller (warmer) tables. Combined with the `$expr` filter this returns at most one document via `.limit(1)`.

---

## [GET /api/user/games/history]

**SIGNATURE**
```ts
GET /api/user/games/history?page=1&limit=20
Headers: Authorization: Bearer <token>
```

**INPUT**
- Bearer token (required). No body.
- `page` — query param, integer ≥ 1, default 1.
- `limit` — query param, integer 1–50, default 20. Capped at 50 server-side.

**OUTPUT**
```ts
{
  games: Array<{
    archiveId: string;
    gameType: string;
    completedAt: Date;
    totalPot: string;           // formatted display string
    myResult: {
      startingStack: string;    // formatted display string
      endingStack: string;      // formatted display string
      totalBet: string;         // formatted display string
      isWinner: boolean;
    };
    players: Array<{ username: string; isWinner: boolean }>;
    pots: Array<{
      potNumber: number;
      totalAmount: string;      // formatted display string
      winners: Array<{
        username: string;
        amount: string;         // formatted display string
        handDescription: string | null;
      }>;
    }>;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Sorted newest-first by `completedAt`.

**ERRORS THROWN**
- `AuthError` (any auth code) → 401.

**SIDE EFFECTS**
- Read-only. Uses index `{ 'players.userId': 1, completedAt: -1 }`.

**INVARIANTS**
- `[INVARIANT]` All money fields (`totalPot`, `startingStack`, `endingStack`, `totalBet`, `totalAmount`, `amount`) are serialized via `serializeMoney` — never raw integers.
- `[INVARIANT]` `completedAt` is a schema field on `IPokerGameArchive` (not a `timestamps` field) — it's always present and does not require lean type augmentation.
- `[INVARIANT]` If `archive.players.find(p => p.userId.toString() === userId)` returns undefined (data integrity issue), the archive is silently skipped rather than throwing. The query filter `{ 'players.userId': userId }` makes this theoretically impossible but the guard prevents a runtime crash.

# PHASE 4 — Admin API (STATUS: DRAFT)

---

## [POST /api/admin/auth/login]

**SIGNATURE**
```ts
POST /api/admin/auth/login
Body: { email: string; password: string }
```

**INPUT**
- `email` — admin email, string, required. Lowercased + trimmed before lookup.
- `password` — plaintext password, string, required.

**OUTPUT**
```ts
{
  message: 'Login successful';
  adminId: string;
  name: string;
  email: string;
}
```
Sets `Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=21600`.

**ERRORS THROWN**
- `AuthError('INVALID_CREDENTIALS')` → 401 — missing/non-string fields, admin not found, or wrong password (same code — no oracle).
- `AuthError('ADMIN_NOT_ACTIVE')` → 403 — admin exists and password matches but `status !== 'active'`.

**SIDE EFFECTS**
- Writes `admin.lastLogin = new Date()` and calls `admin.save()` on successful login.
- Sets an httpOnly cookie named `token` (TTL: 6h / 21600 s) containing a JWT signed with `role: 'admin'`.

**INVARIANTS**
- `[INVARIANT]` Cookie name is `'token'` (canonical per CLAUDE.md — admin auth uses httpOnly cookie, not Bearer header).
- `[INVARIANT]` `role: 'admin'` must be passed explicitly to `signToken` — `IJwtPayload` makes `role` optional, which is a trap.
- `[INVARIANT]` Status gate fires AFTER password check to prevent account enumeration via timing.
- `[INVARIANT]` Admin email is stored lowercase by the schema; lookup uses `.toLowerCase().trim()` for belt-and-suspenders safety.

---

## [GET /api/admin/users]

**SIGNATURE**
```ts
GET /api/admin/users?page=&limit=&search=&status=
```

**INPUT** (query params — all optional)
- `page` — integer ≥ 1, default 1.
- `limit` — integer 1–50, default 20. Capped at 50 server-side.
- `search` — free-text string; regex-escaped before use; case-insensitive match against `username` OR `email`.
- `status` — one of `'active' | 'inactive' | 'suspended'`; silently ignored if not a valid enum value.

**OUTPUT**
```ts
{
  users: Array<{
    userId: string;
    username: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    mobileNumber: string | null;
    usernameLocked: boolean;
    createdAt: Date;
    wallet: {
      balance: string;        // formatted display string
      instantBonus: string;   // formatted display string
      lockedBonus: string;    // formatted display string
      currency: string;
    } | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Sorted newest-first by `createdAt`.

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403 depending on code.

**SIDE EFFECTS**
- Read-only. Two sequential queries: `User.find(filter)` + `Wallet.find({ userId: { $in: userIds } })`.

**INVARIANTS**
- `[INVARIANT]` `search` input is regex-escaped before building the `RegExp` — prevents injection via crafted usernames/emails.
- `[INVARIANT]` Invalid `status` query param values are silently ignored (not a 400) — admin UI may send stale enum values.
- `[INVARIANT]` `wallet` is `null` when no wallet document exists for the user (data integrity issue); never throws.
- `[INVARIANT]` All three wallet balance fields are serialized via `serializeMoney` — never raw integers.

---

## [GET /api/admin/users/[userId]]

**SIGNATURE**
```ts
GET /api/admin/users/:userId
```

**INPUT**
- `userId` — route param, must be a valid MongoDB ObjectId string.

**OUTPUT**
```ts
{
  user: {
    userId: string;
    username: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    mobileNumber: string | null;
    usernameLocked: boolean;
    deviceType: 'android' | 'ios' | 'unknown';
    lastLogin: Date | null;
    authProviders: Array<{ provider: string; providerId: string; linkedAt: Date }>;
    createdAt: Date;
    updatedAt: Date;
  };
  wallet: {
    balance: string;        // formatted display string
    instantBonus: string;   // formatted display string
    lockedBonus: string;    // formatted display string
    currency: string;
  } | null;
  banks: Array<{
    bankId: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountHolderName: string;
    isDefault: boolean;
    status: 'active' | 'blocked' | 'inactive';
    createdAt: Date;
  }>;
}
```

**ERRORS THROWN**
- `ServiceError('NOT_FOUND')` → 404 — invalid ObjectId format OR no user document found (same code — no oracle).
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. Three parallel queries via `Promise.all`: `User.findById`, `Wallet.findOne`, `BankAccount.find`.

**INVARIANTS**
- `[INVARIANT]` ObjectId format is validated BEFORE `dbConnect()` to avoid a round-trip on garbage input.
- `[INVARIANT]` Invalid ObjectId and missing user both return `NOT_FOUND` (no oracle).
- `[INVARIANT]` `wallet` is `null` when no wallet document exists — never throws.
- `[INVARIANT]` `banks` is sorted newest-first by `createdAt`. Does NOT include bank transaction history.
- `[INVARIANT]` All wallet money fields serialized via `serializeMoney` — never raw integers.

---

## [PATCH /api/admin/users/[userId]/status]

**SIGNATURE**
```ts
PATCH /api/admin/users/:userId/status
Body: { status: 'active' | 'inactive' | 'suspended' }
```

**INPUT**
- `userId` — route param, valid MongoDB ObjectId string.
- `status` — required string, one of `'active' | 'inactive' | 'suspended'`.

**OUTPUT**
```ts
{
  message: 'User status updated';
  user: { userId: string; username: string; email: string; status: string };
}
```

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId format OR user not found (same code).
- `AuthError('INVALID_STATE')` → 400 — `status` missing, non-string, or not in the valid enum set.
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Writes `user.status` via `findByIdAndUpdate({ new: true, runValidators: true })`.

**INVARIANTS**
- `[INVARIANT]` ObjectId validated BEFORE `dbConnect()`.
- `[INVARIANT]` Uses `AuthError` (not `ServiceError`) for NOT_FOUND — import kept to `@/lib/api/errors` only.
- `[INVARIANT]` `runValidators: true` ensures the schema enum constraint fires on update.

---

## [POST /api/admin/users/[userId]/balance]

**SIGNATURE**
```ts
POST /api/admin/users/:userId/balance
Body: { bonusAmount: number }
```

**INPUT**
- `userId` — route param, valid MongoDB ObjectId string.
- `bonusAmount` — required integer (minor units). Positive = credit, negative = debit. Zero and non-integers are rejected. Must be a safe integer.

**OUTPUT**
```ts
{
  message: 'Locked bonus updated';
  lockedBonus: string;   // formatted display string — new lockedBonus balance
}
```

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId format OR no wallet found for userId.
- `AuthError('INVALID_STATE')` → 400 — `bonusAmount` missing, non-number, non-integer, non-safe, or zero.
- `AuthError('INSUFFICIENT_BALANCE')` → 400 — `wallet.lockedBonus + bonusAmount < 0` (would go negative).
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Atomic Mongo session: `Wallet.$inc({ lockedBonus: bonusAmount })` + `WalletTransaction.create(type='bonus', remark='adminAdjustment')`.
- `WalletTransaction.amount.lockedBonus = Math.abs(bonusAmount)`, `amount.total = Math.abs(bonusAmount)` (always positive — direction encoded by sign of `bonusAmount`).

**INVARIANTS**
- `[INVARIANT]` `bonusAmount` is validated manually — NOT via `parseAmount`. It is stored as-is (signed integer minor units).
- `[INVARIANT]` `amount.lockedBonus` and `amount.total` in the created WalletTransaction always equal `Math.abs(bonusAmount)` — direction is inferred from context, not stored in the amount breakdown.
- `[INVARIANT]` Floor check (`lockedBonus + bonusAmount >= 0`) runs inside the Mongo session to prevent a race where two concurrent adjustments both pass the check but together go negative.
- `[INVARIANT]` Only `lockedBonus` is modified — `balance` and `instantBonus` are untouched.

---

## [GET /api/admin/bankTransactions]

**SIGNATURE**
```ts
GET /api/admin/bankTransactions?page=&limit=&status=&type=&userId=
```

**INPUT** (query params — all optional)
- `page` — integer ≥ 1, default 1.
- `limit` — integer 1–50, default 20. Capped at 50 server-side.
- `status` — one of `'pending' | 'completed' | 'failed'`; silently ignored if invalid.
- `type` — one of `'deposit' | 'withdraw'`; silently ignored if invalid.
- `userId` — valid MongoDB ObjectId string; silently ignored if not a valid ObjectId format.

**OUTPUT**
```ts
{
  transactions: Array<{
    transactionId: string;
    userId: string;
    type: 'deposit' | 'withdraw';
    amount: string;          // formatted display string (minor units serialized)
    currency: string;
    status: 'pending' | 'completed' | 'failed';
    imageUrl: string | null;
    remark: string | null;
    completedAt: Date | null;
    createdAt: Date;
    bankAccount: {
      bankId: string;
      accountNumber: string;
      bankName: string;
      ifscCode: string;
      accountHolderName: string;
      isDefault: boolean;
      status: 'active' | 'blocked' | 'inactive';
    } | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Sorted newest-first by `createdAt`.

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. Uses `.populate('bankAccountId').lean()` — lean applied after populate.

**INVARIANTS**
- `[INVARIANT]` `bankAccount` is `null` when the referenced BankAccount document has been deleted — never throws.
- `[INVARIANT]` All invalid filter param values are silently ignored — this endpoint never returns 400 for bad query params.
- `[INVARIANT]` `amount` is serialized via `serializeMoney` — never a raw integer.
- `[INVARIANT]` `userId` filter param must be a valid ObjectId string; non-ObjectId strings are silently ignored (not a 400).

---

## [PATCH /api/admin/bankTransactions/[transactionId]/status]

**SIGNATURE**
```ts
PATCH /api/admin/bankTransactions/:transactionId/status
Body: { status: 'completed' | 'failed' }
```

**INPUT**
- `transactionId` — route param, valid MongoDB ObjectId string.
- `status` — required, one of `'completed' | 'failed'`.

**OUTPUT**
```ts
// Failed approval:
{ message: 'Bank transaction rejected' }

// Completed deposit:
{ message: 'Deposit approved'; credited: string }   // credited = serializeMoney(cashAmount)

// Completed withdrawal:
{ message: 'Withdrawal approved' }
```

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId, transaction not found, or wallet not found.
- `AuthError('INVALID_STATE')` → 400 — invalid body status, OR `tx.status !== 'pending'` (double-processing guard).
- `AuthError('INSUFFICIENT_BALANCE')` → 400 — withdrawal where `wallet.balance < tx.amount`.
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- **Failed**: `BankTransaction.status = 'failed'`, `completedAt = now`. No wallet writes. No session.
- **Completed deposit** (Mongo session):
  - `cashAmount = Math.round(gross / gstMultiplier)`, `gstAmount = gross - cashAmount`, `bonusAmount = Math.round(gstAmount * depositBonusRate)`.
  - `Wallet.$inc({ balance: cashAmount, instantBonus: bonusAmount })`.
  - `WalletTransaction.create(type='deposit', status='completed', amount.cashAmount, amount.instantBonus, amount.gst, amount.total=gross, bankTransactionId=tx._id)`.
  - `BankTransaction.status = 'completed'`, `completedAt = now`.
- **Completed withdrawal** (Mongo session):
  - `Wallet.$inc({ balance: -tx.amount })`.
  - `WalletTransaction.create(type='withdraw', status='completed', amount.cashAmount=tx.amount, amount.total=tx.amount, bankTransactionId=tx._id)`.
  - `BankTransaction.status = 'completed'`, `completedAt = now`.

**INVARIANTS**
- `[INVARIANT]` Double-processing guard (`tx.status !== 'pending'`) fires BEFORE any session is opened.
- `[INVARIANT]` Withdrawal balance check runs INSIDE the session to prevent a race where two concurrent approvals both pass but together over-debit the wallet.
- `[INVARIANT]` GST split uses `AppConfig.findOne({})` with fallbacks `gstMultiplier=1.28`, `depositBonusRate=1.0`. Same formula as `POST /api/payments/razorpay/verify`.
- `[INVARIANT]` `try/finally` wraps every session to guarantee `endSession()` even if `withTransaction` throws.
- `[INVARIANT]` `credited` field only appears in the response for deposit approvals.

---

## [GET /api/admin/gatewayTransaction]

**SIGNATURE**
```ts
GET /api/admin/gatewayTransaction?page=&limit=&status=&gateway=&userId=
```

**INPUT** (query params — all optional)
- `page` — integer ≥ 1, default 1.
- `limit` — integer 1–50, default 20. Capped at 50 server-side.
- `status` — one of `'created' | 'pending' | 'completed' | 'failed'`; silently ignored if invalid.
- `gateway` — one of `'razorpay' | 'stripe'`; silently ignored if invalid.
- `userId` — valid MongoDB ObjectId string; silently ignored if not a valid ObjectId format.

**OUTPUT**
```ts
{
  transactions: Array<{
    id: string;
    userId: string;
    gateway: 'razorpay' | 'stripe';
    amount: string;              // formatted display string
    currency: string;
    status: 'created' | 'pending' | 'completed' | 'failed';
    gatewayOrderId: string | null;
    gatewayPaymentId: string | null;
    createdAt: Date;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```
Sorted newest-first by `createdAt`.

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. `Promise.all` for `countDocuments` + `find`.

**INVARIANTS**
- `[INVARIANT]` `gatewaySignature` is NEVER included in the response — it is the HMAC verification secret. Excluded via `.select('-gatewaySignature')` at the query level (not just omitted from the mapping).
- `[INVARIANT]` `amount` is serialized via `serializeMoney` — never a raw integer.
- `[INVARIANT]` All invalid filter param values are silently ignored — this endpoint never returns 400 for bad query params.

---

## [GET + POST /api/admin/poker]

**GET SIGNATURE**
```ts
GET /api/admin/poker
```
**GET OUTPUT**
```ts
{
  games: Array<{
    id: string; gameType: string; description: string | null;
    objective: string | null; status: 'active' | 'maintenance' | 'disabled';
    createdAt: Date; updatedAt: Date;
  }>;
}
```
Sorted ascending by `gameType`. No pagination.

**POST SIGNATURE**
```ts
POST /api/admin/poker
Body: { gameType: string; description?: string; objective?: string; status?: string }
```
**POST OUTPUT** — 201
```ts
{
  message: 'Poker game type created';
  game: { id: string; gameType: string; description: string | null; objective: string | null; status: string };
}
```

**ERRORS THROWN (POST)**
- `AuthError('INVALID_STATE')` → 400 — `gameType` missing, non-string, or not in `["Texas Hold'em", "Omaha"]`.
- `AuthError('INVALID_STATE')` → 400 — duplicate `gameType` (MongoServerError code 11000).
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- POST: `Poker.create(...)`. No cascade.

**INVARIANTS**
- `[INVARIANT]` Only `"Texas Hold'em"` and `"Omaha"` are valid game types in v1 (see FUTURE_V2.md for Stud/Razz/5-Card Draw).
- `[INVARIANT]` `gameType` is unique — duplicate creates return 400 INVALID_STATE via 11000 catch.

---

## [PUT + DELETE /api/admin/poker/[id]]

**PUT SIGNATURE**
```ts
PUT /api/admin/poker/:id
Body: { description?: string; objective?: string; status?: string }
```
**PUT OUTPUT**
```ts
{
  message: 'Poker game type updated';
  game: { id: string; gameType: string; description: string | null; objective: string | null; status: string };
}
```

**DELETE SIGNATURE**
```ts
DELETE /api/admin/poker/:id
```
**DELETE OUTPUT**
```ts
{ message: 'Poker game type deleted' }
```

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId format OR document not found (same code).
- `AuthError('INVALID_STATE')` → 400 (DELETE only) — `PokerMode.exists({ pokerId: id })` is truthy; cascade delete refused.
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- PUT: `Poker.findByIdAndUpdate({ new: true, runValidators: true })`.
- DELETE: hard delete via `Poker.findByIdAndDelete`.

**INVARIANTS**
- `[INVARIANT]` `gameType` is NOT updatable via PUT — it is silently ignored if present in the request body.
- `[INVARIANT]` DELETE is refused if any PokerMode references this Poker (cascade safety). Delete all modes first.
- `[INVARIANT]` PUT status values outside `['active', 'maintenance', 'disabled']` are silently ignored.

---

## [GET + POST /api/admin/pokerModes]

**GET SIGNATURE**
```ts
GET /api/admin/pokerModes?pokerId=&status=&mode=
```
**GET OUTPUT**
```ts
{
  modes: Array<{
    id: string; pokerId: string; gameType: string; bType: 'blinds' | 'antes';
    stake: string; minBuyIn: string; maxBuyIn: string;  // formatted display strings
    currency: string; mode: 'cash' | 'practice';
    status: 'active' | 'disabled'; createdAt: Date; updatedAt: Date;
  }>;
}
```
All filters optional, silently ignored if invalid. Sorted `{ gameType: 1, stake: 1 }`.

**POST SIGNATURE**
```ts
POST /api/admin/pokerModes
Body: { pokerId: string; stake: number; minBuyIn: number; maxBuyIn: number;
        currency?: string; mode?: string; status?: string }
```
All money fields in minor units. **POST OUTPUT** — 201, same shape as one mode entry.

**ERRORS THROWN (POST)**
- `AuthError('INVALID_STATE')` → 400 — invalid/missing pokerId, bad money values (via `parseAmount`), or `maxBuyIn <= minBuyIn`.
- `AuthError('NOT_FOUND')` → 404 — `pokerId` doesn't resolve to a Poker document.

**SIDE EFFECTS**
- POST: `PokerMode.create(...)` with `bType` passed explicitly.

**INVARIANTS**
- `[INVARIANT]` `bType` MUST be passed explicitly on create — the pre-save hook that auto-sets it fires AFTER validation, so omitting it would fail schema validation (Phase 1 invariant: validators run before hooks).
- `[INVARIANT]` `gameType` is inherited from the parent Poker document — never taken from the POST body.
- `[INVARIANT]` `bType` is derived as: `BLINDS_GAMES.has(gameType) ? 'blinds' : 'antes'`. In v1 all game types are in BLINDS_GAMES.
- `[INVARIANT]` All money fields serialized via `serializeMoney` in responses — never raw integers.

---

## [PUT + DELETE /api/admin/pokerModes/[id]]

**PUT SIGNATURE**
```ts
PUT /api/admin/pokerModes/:id
Body: { stake?: number; minBuyIn?: number; maxBuyIn?: number;
        mode?: string; status?: string }
```
**PUT OUTPUT** — same shape as GET mode entry (with timestamps).

**DELETE SIGNATURE**
```ts
DELETE /api/admin/pokerModes/:id
```
**DELETE OUTPUT** — `{ message: 'Poker mode deleted' }`

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId or document not found.
- `AuthError('INVALID_STATE')` → 400 (PUT) — `maxBuyIn <= minBuyIn` cross-field constraint failed.
- `AuthError('INVALID_STATE')` → 400 (DELETE) — `PokerDesk.exists({ pokerModeId: id })` is truthy; cascade delete refused.

**SIDE EFFECTS**
- PUT: loads current doc when any money field is present (for currency context + cross-field validation); then `findByIdAndUpdate({ new: true, runValidators: true })`.
- DELETE: hard delete via `PokerMode.findByIdAndDelete`.

**INVARIANTS**
- `[INVARIANT]` `pokerId`, `gameType`, and `bType` are NOT updatable via PUT — silently ignored.
- `[INVARIANT]` Cross-field `maxBuyIn > minBuyIn` check uses effective values: updated value if provided, current doc value otherwise. Requires loading the current doc.
- `[INVARIANT]` DELETE refused if any PokerDesk has `pokerModeId` referencing this mode. Delete all desks first.

---

## [GET + POST /api/admin/pokerDesks]

**GET SIGNATURE**
```ts
GET /api/admin/pokerDesks?pokerModeId=&status=&mode=
```
**GET OUTPUT**
```ts
{
  desks: Array<{
    id: string; pokerModeId: string; tableName: string;
    gameType: string; bType: string; mode: string; currency: string;
    status: 'active' | 'disabled' | 'closed';
    stake: string; minBuyIn: string; maxBuyIn: string;  // formatted display strings
    minToStart: number; minToContinue: number; maxPlayerCount: number; maxSeats: number;
    seatedCount: number; currentGameStatus: string;
    buttonSeatNumber: number | null; firstGameStartedAt: Date | null;
    createdAt: Date; updatedAt: Date;
  }>;
}
```
All filters optional, silently ignored if invalid. `currentGame` object is NEVER included. Sorted newest-first.

**POST SIGNATURE**
```ts
POST /api/admin/pokerDesks
Body: { pokerModeId: string; tableName: string;
        minToStart?: number; minToContinue?: number; maxPlayerCount?: number }
```
**POST OUTPUT** — 201, same shape as one desk entry.

**ERRORS THROWN (POST)**
- `AuthError('INVALID_STATE')` → 400 — missing/invalid pokerModeId or tableName; `maxPlayerCount < minToStart`; `minToContinue > minToStart`.
- `AuthError('NOT_FOUND')` → 404 — pokerModeId doesn't resolve to a PokerMode document.

**SIDE EFFECTS**
- POST: `PokerDesk.create(...)` with all money/game config inherited from PokerMode.

**INVARIANTS**
- `[INVARIANT]` `gameType`, `bType`, `stake`, `minBuyIn`, `maxBuyIn`, `currency`, `mode` are inherited exclusively from the parent PokerMode — never taken from the POST body.
- `[INVARIANT]` `maxSeats` is always set equal to `maxPlayerCount` on creation.
- `[INVARIANT]` Cross-field checks (`maxPlayerCount >= minToStart`, `minToContinue <= minToStart`) run BEFORE `dbConnect()` in POST.
- `[INVARIANT]` `currentGame` object is never included in any response — only `seatedCount` and `currentGameStatus`.
- `[INVARIANT]` All money fields serialized via `serializeMoney` — never raw integers.

---

## [PUT + DELETE /api/admin/pokerDesks/[id]]

**PUT SIGNATURE**
```ts
PUT /api/admin/pokerDesks/:id
Body: { tableName?: string; status?: 'active' | 'disabled';
        minToStart?: number; minToContinue?: number; maxPlayerCount?: number }
```
**PUT OUTPUT** — same shape as GET desk entry.

**DELETE SIGNATURE**
```ts
DELETE /api/admin/pokerDesks/:id
```
**DELETE OUTPUT** — `{ message: 'Poker desk deleted' }`

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` → 404 — invalid ObjectId or document not found.
- `AuthError('INVALID_STATE')` → 400 (PUT) — cross-field constraint failed on effective merged values.
- `AuthError('INVALID_STATE')` → 400 (DELETE) — `seats.length > 0` (players seated) or `currentGameStatus === 'in-progress'`.

**SIDE EFFECTS**
- PUT: always loads current doc first for cross-field merge-validation; then `findByIdAndUpdate({ new: true, runValidators: true })`.
- DELETE: loads desk to check guards, then hard-deletes.

**INVARIANTS**
- `[INVARIANT]` `status: 'closed'` is NOT settable via PUT — it is engine-only (set by `gameService.forceCloseDesk`). Only `'active'` and `'disabled'` are admin-settable.
- `[INVARIANT]` Inherited fields (`pokerModeId`, `gameType`, `bType`, `stake`, `minBuyIn`, `maxBuyIn`, `currency`, `mode`) are silently ignored in PUT — not updatable.
- `[INVARIANT]` Pre-save hook cross-field validators do NOT run via `findByIdAndUpdate`. All cross-field checks are performed manually using effective (merged) values before the update call.
- `[INVARIANT]` DELETE is refused if players are seated OR if a game is in progress. Both checks are necessary — a game can theoretically be in-progress with no active seats if all players folded/left in an edge case.

---

## [GET /api/admin/analytics/dashboard]

**SIGNATURE**
```ts
GET /api/admin/analytics/dashboard
```

**OUTPUT**
```ts
{
  users: {
    total: number;
    active: number;
    newToday: number;          // createdAt >= start of today (midnight local)
    newThisWeek: number;       // createdAt >= 7 days ago
    newThisMonth: number;      // createdAt >= 30 days ago
  };
  bankTransactions: {
    pendingDeposits: number;
    pendingWithdrawals: number;
    completedToday: number;    // completedAt >= start of today
  };
  games: {
    totalArchived: number;
    activeDesksNow: number;    // currentGameStatus === 'in-progress'
    totalActiveDesks: number;  // status === 'active'
  };
  recentUsers: Array<{
    userId: string; username: string; email: string;
    status: string; createdAt: Date;
  }>;
  leaderboard: Array<{
    userId: string; username: string;
    totalWinnings: string;     // serializeMoney — may be negative (e.g. "₹-12.34")
  }>;
}
```

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. All 11 underlying queries run concurrently via nested `Promise.all` (5 outer groups, each group its own `Promise.all`).

**INVARIANTS**
- `[INVARIANT]` All queries are parallel — no sequential DB calls. Structure: outer `Promise.all` with 5 groups; each group is its own `Promise.all`.
- `[INVARIANT]` Leaderboard aggregates `$sum($subtract(endingStack, startingStack))` across all `PokerGameArchive` documents per player. Negative values are valid (net losers). Serialized via `serializeMoney`.
- `[INVARIANT]` `recentUsers` is the 5 most recently registered users, sorted by `createdAt desc`. Does NOT filter by status.
- `[INVARIANT]` Leaderboard `username` comes from `$first: '$players.username'` in the archive — may be stale if the user renamed. No live User lookup is performed.
- `[INVARIANT]` `bankTransactions.completedToday` filters on `completedAt` (the settlement timestamp), not `createdAt` (the row creation timestamp).

---

## PHASE 4 — 4.13 GET /api/admin/analytics/games

**STATUS:** DRAFT

**FILE:** `src/app/api/admin/analytics/games/route.ts`

**AUTH:** `requireAdmin` (httpOnly cookie `token`, role `'admin'`, admin status `'active'`)

**QUERY PARAMS**
| Param | Type | Notes |
|---|---|---|
| `page` | integer | Default 1 |
| `limit` | integer | Default 20, capped 50 |
| `deskId` | ObjectId string | Filter by deskId; ignored if invalid ObjectId |
| `pokerModeId` | ObjectId string | Filter by pokerModeId; ignored if invalid ObjectId |
| `gameType` | string | Must be in VALID_GAME_TYPES set; ignored otherwise |
| `from` | date string | `completedAt >= from`; ignored if `new Date(from)` is invalid |
| `to` | date string | `completedAt <= to`; ignored if `new Date(to)` is invalid |

**OUTPUT**
```ts
{
  games: Array<{
    id: string;
    deskId: string;
    pokerModeId: string;
    gameType: string;
    currency: string;
    totalPot: string;           // serializeMoney(totalPot, currency)
    playerCount: number;        // archive.players.length
    durationSeconds: number;    // Math.round((completedAt - startedAt) / 1000)
    startedAt: Date;
    completedAt: Date;
    players: Array<{
      userId: string;
      username: string;
      isWinner: boolean;
      netChange: string;        // serializeMoney(endingStack - startingStack, currency) — may be negative
    }>;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number; };
}
```

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. `Promise.all([countDocuments, find])` — two parallel DB calls.

**INVARIANTS**
- `[INVARIANT]` `from`/`to` filter on `completedAt`, not `startedAt`. This is intentional — games in progress have no `completedAt`.
- `[INVARIANT]` `netChange` may be negative (a player who lost chips). `serializeMoney` serializes signed integers correctly.
- `[INVARIANT]` Sort is `{ completedAt: -1 }` — most recent first.
- `[INVARIANT]` Invalid filter params (bad ObjectId, unknown gameType, unparseable date) are silently ignored — not an error. Malformed filters simply don't narrow the result set.

---

## PHASE 4 — 4.14 GET /api/admin/analytics/users/[userId]

**STATUS:** DRAFT

**FILE:** `src/app/api/admin/analytics/users/[userId]/route.ts`

**AUTH:** `requireAdmin` (httpOnly cookie `token`, role `'admin'`, admin status `'active'`)

**PATH PARAMS**
| Param | Notes |
|---|---|
| `userId` | Must be a valid MongoDB ObjectId — invalid → 404 |

**QUERY PARAMS**
| Param | Type | Notes |
|---|---|---|
| `page` | integer | Default 1 |
| `limit` | integer | Default 20, capped 50 |

**OUTPUT**
```ts
{
  stats: {
    gamesPlayed: number;
    wins: number;
    winRate: string;            // e.g. "42.5%" — (wins/gamesPlayed * 100).toFixed(1) + '%'
    totalNetChange: string;     // serializeMoney — may be negative
    totalBet: string;           // serializeMoney
    currency: 'INR' | 'USD';
  } | null;                     // null if user has no archived games
  games: Array<{
    id: string;
    gameType: string;
    currency: 'INR' | 'USD';
    totalPot: string;           // serializeMoney(totalPot, currency)
    isWinner: boolean;
    netChange: string;          // serializeMoney(endingStack - startingStack) — may be negative
    startedAt: Date;
    completedAt: Date;
    durationSeconds: number;    // Math.round((completedAt - startedAt) / 1000)
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number; };
}
```

**ERRORS THROWN**
- `AuthError('NOT_FOUND')` — `userId` is not a valid ObjectId.
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only. Three parallel queries via `Promise.all`: aggregate (lifetime stats), `countDocuments`, `find` (paginated game list).

**INVARIANTS**
- `[INVARIANT]` ObjectId is validated BEFORE `dbConnect()`.
- `[INVARIANT]` Aggregate uses double-match pattern: first `$match` on `players.userId` pre-filters documents (uses index), second `$match` after `$unwind` isolates this user's player record from multi-player documents.
- `[INVARIANT]` `stats` is `null` if the aggregate returns no result (`statsResult[0]` is undefined). Do not return an empty stats object.
- `[INVARIANT]` `netChange` and `totalNetChange` may be negative — `endingStack` can be 0 (all-in loss) while `startingStack` was positive. Serialized as-is.
- `[INVARIANT]` Per-game player record is found via `archive.players.find(p => p.userId.toString() === userId)`. Fallback `isWinner: false` / `netChange: "₹0.00"` if somehow not found (should never happen given the find filter).

---

## PHASE 4 — 4.15 GET /api/admin/config + PATCH /api/admin/config

**STATUS:** DRAFT

**FILE:** `src/app/api/admin/config/route.ts`

**AUTH:** `requireAdmin` (httpOnly cookie `token`, role `'admin'`, admin status `'active'`)

---

### GET /api/admin/config

**OUTPUT**
```ts
{ gstMultiplier: number; depositBonusRate: number }
```
Returns `AppConfig.findOne({}).lean()`. If no document exists, returns defaults: `gstMultiplier: 1.28`, `depositBonusRate: 1.0`.

**ERRORS THROWN**
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- Read-only.

---

### PATCH /api/admin/config

**INPUT**
```ts
// body — both fields optional
{ gstMultiplier?: number; depositBonusRate?: number }
```

| Field | Constraint |
|---|---|
| `gstMultiplier` | `typeof === 'number'` AND `>= 1` |
| `depositBonusRate` | `typeof === 'number'` AND `>= 0` AND `<= 1` |

**OUTPUT**
```ts
// if any field was updated:
{ message: 'Config updated'; config: { gstMultiplier: number; depositBonusRate: number } }
// if body had no valid fields (empty PATCH):
{ gstMultiplier: number; depositBonusRate: number }  // same as GET
```

**ERRORS THROWN**
- `AuthError('INVALID_STATE')` — `gstMultiplier` provided but not a number, or `< 1`.
- `AuthError('INVALID_STATE')` — `depositBonusRate` provided but not a number, or outside `[0, 1]`.
- Any `AuthError` from `requireAdmin` → 401/403.

**SIDE EFFECTS**
- `AppConfig.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true })` — creates the singleton if absent.

**INVARIANTS**
- `[INVARIANT]` Manual validation is mandatory — pre-save hooks do NOT fire on `findOneAndUpdate`. `runValidators: true` does not fire pre-save hooks either.
- `[INVARIANT]` `upsert: true` — the singleton is created on first PATCH if no document exists yet.
- `[INVARIANT]` Empty PATCH body (no valid fields) returns current config with GET response shape, not an error.
- `[INVARIANT]` `gstMultiplier` and `depositBonusRate` are plain decimal numbers — NOT money. Do NOT apply `serializeMoney`.
- `[INVARIANT]` Defaults when no DB document exists: `gstMultiplier = 1.28`, `depositBonusRate = 1.0`. These must match the fallback values used in `src/app/api/payments/razorpay/verify/route.ts`.

---

## PHASE 5 — 5.3c GET /api/admin/practiceSessions

**STATUS:** STABLE

**AUTH:** `requireAdmin` (httpOnly `token` cookie, role `'admin'`).

**QUERY PARAMS**
| Param | Default | Constraint |
|-------|---------|------------|
| `page` | 1 | ≥ 1 |
| `limit` | 20 | 1–100 |

**OUTPUT**
```ts
{
  sessions: Array<{
    _id: string;
    user: { id: string; username: string; email: string } | null; // null if user deleted
    deskId: string;
    startedAt: Date;
    endedAt: Date | null;
    finalChips: string | null; // formatted money string (e.g. "₹1,000.00") or null if session still open
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

**INVARIANTS**
- `finalChips` is always formatted via `serializeMoney(..., 'INR')` — never raw minor units.
- Sorted by `startedAt` descending.
- `userId` is populated; the raw ObjectId is not exposed.

---

## PHASE 5 — 5.3c POST /api/admin/pokerDesks — `isPractice` field

**STATUS:** STABLE (additive change to existing 4.8 endpoint)

**CHANGE:** Added optional `isPractice: boolean` to the POST body. Defaults to `false` if absent.

**UPDATED INPUT FIELD**
```ts
isPractice?: boolean  // default false — desk will use PRACTICE_STARTING_CHIPS stack, no wallet ops
```

**INVARIANTS**
- `isPractice` is parsed as `body.isPractice === true` — any other value (string, number) is treated as `false`.
- All other POST fields and validation logic are unchanged.
- `serializeDesk` does not yet expose `isPractice` in the GET/POST response; it is stored on the document.

---

## PHASE 5 — 5.1 src/server.ts + src/types/socketTypes.ts

**STATUS:** DRAFT

**FILES:**
- `src/types/socketTypes.ts` — socket event payload type definitions
- `src/server.ts` — standalone Socket.io server (NOT a Next.js route)

**PROCESS:** standalone Node.js process on `process.env.SOCKET_PORT ?? 3001`. Started independently of `next dev`. Uses `http.createServer()` + `new Server(httpServer)`.

---

### Socket.io Event Protocol

**Client → Server** (C→S)
| Event | Payload type | Notes |
|---|---|---|
| `join` | `JoinPayload` | `{ deskId, seatNumber, buyInAmount }` |
| `action` | `ActionPayload` | `{ deskId, action, amount? }` |
| `leave` | `LeavePayload` | `{ deskId }` |

**Server → Client** (S→C, room broadcast unless noted)
| Event | Payload | Notes |
|---|---|---|
| `player:joined` | `{ desk }` | Redacted desk state |
| `player:left` | `{ desk }` | Redacted desk state |
| `game:start` | `{ desk }` | Redacted broadcast; then targeted `{ holeCards }` to each player |
| `game:action` | `{ desk }` | Redacted desk state |
| `game:roundAdvance` | `{ desk }` | Redacted desk state |
| `game:showdown` | `{ desk, potResults }` | `potResults[].winners[].userId` serialized as string |
| `desk:closed` | `{}` | Broadcast to room |
| `turn:start` | `{ deadline: Date }` | Targeted (60s window) |
| `error` | `{ code, message }` | Targeted — only to offending socket |

---

### Auth Middleware

`io.use(...)` reads JWT from `socket.handshake.auth.token`. Verifies via `verifyToken`. Attaches `socket.data.userId` and `socket.data.role`. Rejects with `next(new Error('MISSING_AUTH'))` or `next(new Error('INVALID_TOKEN'))`.

---

### DeskRuntimeState

Ephemeral in-memory state per desk. Never persisted.

```ts
interface DeskRuntimeState {
  userSockets: Map<string, string>;   // userId → socketId
  botSeats: Map<string, { strategy: 'easy' | 'medium' | 'hard' }>;
  skipCounts: Map<string, number>;    // userId → consecutive auto-folds (3-skip eviction)
  turnTimer: ReturnType<typeof setTimeout> | null;
  turnTimerUserId: string | null;     // which player the current turnTimer belongs to
  autoStartTimer: ReturnType<typeof setTimeout> | null;
}
const deskRuntime = new Map<string, DeskRuntimeState>();
```

---

### Turn Timer

`startTurnTimer(deskId, userId)` — clears any existing `runtime.turnTimer` and sets a new 60s `setTimeout`. On expiry:
1. Increment `skipCounts` for `userId`.
2. Auto-fold via `handlePlayerAction({ action: 'fold' })`.
3. Emit `turn:timeout` room broadcast `{ userId }`.
4. **3-skip path** (skipCount >= 3): resolve fold result (showdown/broadcast/runout), then call `userLeavesSeat` and handle result like the `leave` handler.
5. **Normal path** (skipCount < 3): handle fold result like the `action` handler, then call `startTurnTimer` for the new `currentTurnPlayer`.
6. **Race** (`InvalidStateError` from fold): player already acted before timer fired; silently discard — the `action` handler has already cleared the timer and set the next one.

---

### 3-Skip Disconnect Rule

- Counter incremented by `startTurnTimer` expiry callback.
- Counter reset (`skipCounts.delete(userId)`) on any successful voluntary `action`.
- At count >= 3: forced `userLeavesSeat` eviction; cleanup identical to the `leave` handler.
- Counter NOT reset on `disconnect` alone — persists across reconnects intentionally.

---

### Key Invariants

**INVARIANTS**
- `[INVARIANT]` `holeCards` are NEVER included in room broadcasts. Every player's `holeCards` is replaced with `[]` before the desk object is emitted to the room. Only the targeted `game:start` emit to each individual socket includes real hole cards.
- `[INVARIANT]` No game logic lives in `server.ts` — every state-mutating decision goes through a `gameService` function.
- `[INVARIANT]` No `withDeskLock` calls from `server.ts` — the service functions acquire the lock internally.
- `[INVARIANT]` After `userLeavesSeat` returns `needsShowdown=true`, `handleNeedsShowdown` is called immediately. If `needsShowdown=false` but `activePlayers===0 && allInPlayers>=2`, `handleAllInRunout` is called instead.
- `[INVARIANT]` `disconnect` does NOT call `userLeavesSeat`. Only removes the socket from `userSockets`. The 3-skip rule (task 5.2) handles eviction.
- `[INVARIANT]` Auto-start timer is replaced (clearTimeout + new setTimeout) every time `scheduleAutoStart` is called for the same desk — prevents double-start races.
- `[INVARIANT]` After `game:start` broadcast, `startTurnTimer(deskId, currentTurnPlayer)` is called — this both emits a targeted `turn:start { deadline }` to the player's socket AND starts the 60s server-side auto-fold timer. There is no separate targeted emit for turn:start elsewhere.
- `[INVARIANT]` Auto-start threshold: cold desk (firstGameStartedAt === null) → `desk.minToStart`; warm desk → `desk.minToContinue`.

---

## PHASE 5 — 5.3a PracticeSession model

### models.PracticeSession

**SIGNATURE**
```ts
// Schema fields
{
  userId:     ObjectId   // ref: 'User', required, indexed
  deskId:     ObjectId   // ref: 'PokerDesk', required
  startedAt:  Date       // required, default: Date.now
  endedAt?:   Date       // set when session ends
  finalChips?: number    // minor units; null until session ends
}
```

**PURPOSE**
Tracks a user's practice-mode session from seat-join to seat-leave. Created by `server.ts` on `join` for practice desks; closed (endedAt + finalChips written) on `leave` using `finalChips` from `userLeavesSeat`.

**INDEXES**
- `{ userId: 1, startedAt: -1 }` — compound, for history queries
- `{ userId: 1 }` — single, for per-user lookups

**INVARIANTS**
- `timestamps: false` — `startedAt`/`endedAt` are explicit, no auto Mongoose timestamps.
- `finalChips` is always in minor units (paise). Never major.
- A session without `endedAt` is an open/active session.

---

## PHASE 5 — 5.3b botService.addBotToSeat

### botService.addBotToSeat

**SIGNATURE**
```ts
addBotToSeat(input: { deskId: string; seatNumber: number; strategy: BotDifficulty }): Promise<AddBotToSeatResult>
```

**INPUT**
- `deskId: string` — desk's `_id`
- `seatNumber: number` — which seat to occupy
- `strategy: BotDifficulty` — `'easy' | 'medium' | 'hard'` (stored in `DeskRuntimeState.botSeats` by caller)

**OUTPUT**
- `desk: IPokerDeskDocument` — updated desk after bot seat added
- `botUserId: Types.ObjectId` — synthetic ObjectId; no DB User record created

**ERRORS**
- `NotFoundError` — desk not found
- `InvalidStateError` — desk is not a practice desk, is closed, seat is taken, or desk is full

**SIDE EFFECTS**
- Appends a seat with `balanceAtTable = PRACTICE_STARTING_CHIPS` to the desk document. No wallet writes (practice mode).
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- [INVARIANT] Only valid on practice desks (`desk.isPractice === true`). Throws on cash desks.
- [INVARIANT] Never call `addBotToSeat` from inside `withDeskLock` — it acquires the lock internally and will deadlock.
- [INVARIANT] `PRACTICE_STARTING_CHIPS` is the only permitted source for `balanceAtTable`. Never hardcode 100000.

---

## PHASE 5 — 5.3b lib/bots BotStrategy

### lib/bots.BotStrategy

**SIGNATURE**
```ts
interface BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction;
}
interface BotAction {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number; // minor units; required for raise only
}
function getBotStrategy(difficulty: BotDifficulty): BotStrategy
```

**INPUT**
- `game: IPokerGame` — current game state (lean or hydrated)
- `botUserId: Types.ObjectId` — the bot's synthetic userId

**OUTPUT**
- `BotAction` with `action` and optional `amount` (required for `'raise'`)

**IMPLEMENTATIONS**
- `EasyStrategy` — check when free, call if affordable, fold if not. Never raises.
- `MediumStrategy` — pot-odds aware (call if odds < 0.35); raises to `floor(pot × 0.75)` on a pair.
- `HardStrategy` — position-aware; tight (odds < 0.25) in early position, raises to pot in late position with a pair.

**INVARIANTS**
- `getBotStrategy` is the only permitted factory for `BotStrategy` instances.
- Import from `@/lib/bots/index` — not from a relative path.

---

## PHASE 5 — 5.6 scripts/tier2Smoke.ts

**PURPOSE** — Tier-2 end-to-end smoke test. Exercises the full stack (HTTP + Socket.io) without importing from `@/services/gameService`. Requires `npm run dev` running on ports 3000 and 3001.

**USAGE**
```
npx tsx --env-file=.env.local scripts/tier2Smoke.ts [--keep]
```

**WHAT IT CHECKS**
1. `GET /api/lobby/games` — 200, non-empty `games` array
2. `GET /api/lobby/desks/best?modeId=<id>` — 200, `desk` not null
3. Socket auth rejection — bad token → `connect_error` with message `'INVALID_TOKEN'`
4. Full 5-hand lifecycle (mirrors playLifecycle.ts) via socket events only
5. Room broadcasts have redacted `holeCards` (empty arrays for all players)
6. Targeted `game:start` delivers 2 hole cards to each player's socket
7. Mid-hand leave (Hand 3): `userLeavesSeat` works while a game is in progress
8. Force-close (after Hand 5): `desk:closed` event emitted to remaining sockets
9. Join on closed desk → `error` event
10. Money conservation across all 5 hands
11. 5 archive documents with non-empty `username` on all players

**KEY DESIGN DECISIONS**
- `turn:start` listeners are registered BEFORE awaiting `game:start` to avoid racing the server's immediate `turn:start` emit.
- `gameStartP` parameter on `playHandViaSocket`: pre-registered promise passed when a between-hand leave could race the 3 s auto-start timer. Register before emitting leave; pass to the next `playHandViaSocket` call.
- Hand 3 uses `Promise.race`-style `h3Done` (resolves on first `game:showdown` from any remaining socket) because the mid-hand leaver's socket leaves the room before the broadcast fires.
- Force-close leave: waits for `desk:closed` on an OBSERVER socket (not the leaver) because the leaver has left the room before the server emits it.

**INVARIANTS**
- [INVARIANT] Do NOT import from `@/services/gameService`.
- [INVARIANT] Pre-register `game:start` (`waitFor`) BEFORE emitting a between-hand leave.
- [INVARIANT] `game:start` arrives twice per hand per socket: (1) room broadcast `{ desk }` (holeCards all empty); (2) targeted `{ holeCards }`. Both listeners must be registered before the first arrives.

---

# PHASE 5 — Socket / Live engine (STATUS: DRAFT — not built yet)