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
- `buyInAmount: number` — minor units. **CASH MODE:** validated against `[desk.minBuyIn, desk.maxBuyIn]`. **PRACTICE MODE:** IGNORED — practice always uses `PRACTICE_STARTING_STACK_MINOR` regardless of what's passed.

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

**ERRORS**
- `NotFoundError` — desk doesn't exist
- `NotSeatedError` — user has no seat at this desk
- `InvalidStateError` — wallet currency mismatch (cash mode)

**SIDE EFFECTS**
- Mid-hand: if the leaver was an active player, marks them `'folded'`. If they were the current turn player, advances `currentTurnPlayer` to the next active player. (Without this, the game would stall.)
- Cash mode + `balanceAtTable > 0`: wallet credit + `WalletTransaction(type='deskWithdraw')` + seat removal, atomic.
- Cash mode + `balanceAtTable == 0`: just removes the seat (no wallet writes).
- Practice mode: just removes the seat.
- Runs inside `withDeskLock(deskId)`.

**INVARIANTS**
- A leave never leaves `currentTurnPlayer` pointing at a folded player.
- `needsShowdown === true` ⇒ caller must call `showdown` to finalize the hand.
- **Between-hand closure (LOGS.md 2026-06-01):** after the seat is removed, if `desk.currentGame === null` AND `desk.firstGameStartedAt !== null` (warm desk) AND `desk.seats.length < 3`, `forceCloseDesk` is called. All remaining players are forced to leave (chips returned to wallets) and desk transitions to 'closed'. Mid-hand leaves do NOT trigger this — the post-showdown check handles it after the hand completes.

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

**ERRORS THROWN** (all `AuthError`, all map to HTTP 401 at the route layer)
- `MISSING_AUTH_COOKIE` — no `token` cookie present
- `INVALID_TOKEN` — bad signature, expired, or malformed (collapsed for security)
- `MISSING_USER_ID` — verified token had no userId (defensive)
- `WRONG_ROLE` — role isn't exactly `'admin'` (rejects user tokens, roleless tokens, legacy roles)
- `ADMIN_NOT_FOUND` — token's userId doesn't resolve to an Admin record (deleted mid-session)
- `ADMIN_NOT_ACTIVE` — admin exists but status isn't `'active'` (immediate revocation on disable)

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

# PHASE 3 — User API (STATUS: DRAFT — not built yet)

Each route gets an entry as it's built. Expected entries:
- `POST /api/auth/google` (replaces OTP — see USER_API_CHANGES.md)
- `GET /api/user/username/suggestions`
- `PATCH /api/user/username`
- `GET /api/user/wallet`
- `GET /api/user/wallet/transactions`
- ... etc per TASKS.md Phase 3

# PHASE 4 — Admin API (STATUS: DRAFT — not built yet)

# PHASE 5 — Socket / Live engine (STATUS: DRAFT — not built yet)