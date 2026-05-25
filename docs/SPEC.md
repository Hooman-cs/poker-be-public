# SPEC.md — Intent & Source of Truth

This is the document the rebuild is built FROM. It captures the *intent* of every
API, component, hook, util, and the socket subsystem — reconciled against the
finalized models/engine and the locked user contract. Where the old code and the
new models disagreed, this spec resolves in favor of the models.

Rebuild everything (except `src/models/**` and `src/engine/**`) to satisfy this spec.

---

## 0. Locked inputs (do not change)

- **Models**: `src/models/**` — finalized, authoritative for data shape.
- **Engine**: `src/engine/**` — finalized pure functions. `pokerDesk.ts` methods call them.
- **User API contract**: `user_api_contracts.pdf` — authoritative request/response shapes for
  all user-facing routes. The implementation may be rewritten; the shapes may not change.
- **Utils to keep as-is**: `src/utils/jwt.ts`, `src/utils/helpers.ts`, `src/config/dbConnect.ts`.

---

## 1. Cross-cutting business rules (THE CROWN JEWELS — must survive the rebuild)

| Rule | Value / Logic | Where it lives today |
|---|---|---|
| Signup bonus | ₹10 credited to `instantBonus` on first login; logged as a `bonus` WalletTransaction | otp/verify |
| GST split (deposits) | `cash = round(amount / 1.28)`, `gst = amount - cash`, `instantBonus = gst` | razorpay/verify, bank status |
| OTP rate limit | 3 requests per 10-min window; then blocked 10 min; count resets after block | otp/request |
| OTP expiry | 10 minutes; record auto-deleted via TTL index and on successful verify | otp model + verify |
| Max bank accounts | 5 per user (enforced in BankAccount pre-save) | bankAccount model |
| Default bank account | Setting `isDefault=true` unsets all other defaults for that user | user/banks POST |
| Deposit receipt | Manual `deposit` bank transactions REQUIRE `imageUrl`; withdrawals ignore it | user/banks/transactions |
| Withdrawal guard | `withdraw` requests must not exceed wallet balance | user/banks/transactions |
| Razorpay verify | HMAC `sha256(order_id\|payment_id, KEY_SECRET)` must equal signature; reject double-verify | razorpay/verify |
| Razorpay amount | Sent to gateway in paise (`amount * 100`); stored in rupees | razorpay/order |
| Matchmaking | Prefer active desks with `0 < seats <= 75% of maxSeats`, sort by seat count then observer count; fallback to first active desk | lobby/desks/best |
| Auto-fold | A player's turn auto-folds after 30s of inactivity | server.ts |
| Auto-start | A game should start when seated players **>= minPlayerCount** (current code uses `<=` — that is a bug to fix) | server.ts |
| Account status gate | Non-`active` users are blocked at login and from creating bank transactions | otp/verify, user/banks/transactions |

Constants to centralize (e.g. `src/config/constants.ts`):
`SIGNUP_BONUS = 10`, `GST_MULTIPLIER = 1.28`, `MAX_BANK_ACCOUNTS = 5`,
`OTP_MAX_REQUESTS = 3`, `OTP_WINDOW_MS = 10*60*1000`, `OTP_BLOCK_MS = 10*60*1000`,
`OTP_EXPIRY_MS = 10*60*1000`, `AUTO_FOLD_MS = 30*1000`.

**JWT expiry inconsistency to resolve:** `signToken` (user) defaults to `7d`; admin login uses `6h`.
Pick deliberately per role and document the choice.

---

## 2. Auth & conventions

- **User auth**: Bearer token in `Authorization` header. Issued by otp/verify with `role: 'user'`.
- **Admin auth**: httpOnly cookie `token`. Issued by admin login with `role: 'admin'`.
  There is no `superadmin` — every admin route authorizes on `payload.role === 'admin'`.
- **Middleware** (`src/middleware.ts`): protects `/admin/**`; redirects unauthenticated → `/auth/login`;
  redirects authenticated user away from `/auth/login` → `/admin/statistics`. Uses `jose` for Edge.
  Strip the console logs and dead commented blocks.
- **Entry flow**: `/` server-redirects to `/auth/login` (no client-side bounce, no interstitial page).
  After successful admin login → `/admin/statistics`.
- **Currency**: INR, rendered `₹`, stored in rupees.

---

## 3. User-facing API (shapes locked by the PDF — rebuild implementation only)

For exact request/response shapes, the PDF is authoritative. Below is the intent + the
fixes each route needs against the new models.

- **POST /api/auth/otp/request** — generate + send OTP with rate limiting (see §1). Dev mode logs OTP.
- **POST /api/auth/otp/verify** — verify OTP; create User+Wallet+bonus txn on first login; block
  non-active users; issue JWT (`user`); delete OTP; return token/userName/userId/wallet.
- **GET /api/lobby/games** — active+maintenance games with active modes + live desk stats.
  *Fix:* the Poker model has only `{ gameType, description, objective, status }` — stop selecting/returning
  `name`, `rules`, `blindsOrAntes` (phantom). Per mode, derive `smallBlind`/`bigBlind` for blinds games and
  `anteAmount` for antes games. Decide the blind relationship explicitly (e.g. `bigBlind = 2 * smallBlind`)
  and document it; the current `smallBlind = bigBlind = stake` is a known placeholder bug.
- **GET /api/lobby/desks/best?pokerModeId=** — matchmaking (see §1). Returns desk + formatted seats.
- **GET /api/user/wallet** — balance/instantBonus/lockedBonus from the Wallet model.
- **GET /api/user/wallet/transactions** — paginated; filter type/status/date; enums per WalletTransaction model.
- **GET/POST /api/user/banks** — list (paginated) / add (max 5, default handling, active user). Uses `bankAccountId` everywhere.
- **GET/POST /api/user/banks/transactions** — history / create. Deposit needs `imageUrl`; withdraw checks balance.
  Bank account must belong to user and be active. Populate path is `bankAccountId` (model field), not `bankId`.
- **POST /api/payments/razorpay/order** — create GatewayTransaction (`created`) + Razorpay order; link `gatewayOrderId`.
- **POST /api/payments/razorpay/verify** — verify HMAC; GST split; credit wallet; pgDeposit txn; mark `successful`.
- **GET /api/user/games/history** — **NEW, not yet implemented.** Per the PDF: query PokerGameArchive for the
  user, paginate, optional `gameType` filter, and project each game's `myResult` (startingStack, endingStack,
  totalBet, isWinner) from the matching entry in `players[]`. Must be added to the user frontend's ApiCaller.js.

---

## 4. Admin-facing API (intent — rebuild fully against the new models)

All admin routes: `await dbConnect()`, cookie token, `role === 'admin'`, try/catch with correct codes.

### Auth
- **POST /api/admin/auth/login** — email+password; bcrypt compare via `Admin.comparePassword`; set httpOnly
  cookie; update `lastLogin`. JWT carries `role: 'admin'`.

### Analytics (rebuild against the NEW PokerGameArchive: `totalPot`, `completedAt`, players w/ `isWinner`, pots w/ `winners`; NO `mode`/`status`/`bType`/`stack`/`deskName`/`totalBet`/`createdAt`/`contributors`)
- **GET /api/admin/analytics/dashboard** — userStats (counts by status, registered today, device split, newest users),
  bankTransactionStats (deposit/withdraw success/fail/pending — bank field is `bankAccountId`, status enum pending/completed/failed),
  pokerGameStats (finishedGames = archive count, totalPot sum, mostPlayedDesk by deskId, topPlayersByTotalBet from `players`).
- **GET /api/admin/analytics/games** — overall totals + top winners (from `pots.winners`). No contributors.
- **GET /api/admin/analytics/users/[userId]** — gamesPlayed, totalBet (`players.totalBet`), totalWins (`pots.winners`).
  Drop `foldRate` (archive has no per-player status — not derivable).

### Lists
- **GET /api/admin/users** — paginated, filter status/searchName/date; enrich with wallet + deposit/withdraw +
  gamesPlayed/totalBet aggregations. Wallet/WalletTransaction are separate models.
- **GET /api/admin/games** — paginated (`page`/`limit`), filter deskId/pokerModeId/username/gameType/date(completedAt).
  Return `IGameHistory[]` (see `pokerModelTypes.ts`). Remove the phantom `mode:'cash'` filter.
- **GET /api/admin/bankTransactions** — paginated, filter username/status/type/maxAmount/sort; populate `bankAccountId`.
- **GET /api/admin/pmgTransactions** — source is GatewayTransaction; field is `gatewayOrderId`; flatten to
  `{ id, username, amount, orderId, status, createdAt }` for the UI.

### Detail / mutations
- **GET /api/admin/users/[userId]** — profile + wallet + game stats + financial stats + recent bank/wallet txns.
- **PATCH /api/admin/users/[userId]/status** — set `active|inactive|suspended`.
- **POST /api/admin/users/[userId]/balance** — add/remove `lockedBonus`; require positive amount + remark +
  `action: add|remove`; remove checks sufficient lockedBonus; log a `bonus` WalletTransaction.
- **PATCH /api/admin/bankTransactions/[transactionId]/status** — the deposit/withdraw approval ledger.
  Body key is `newStatus`; valid `pending|completed|failed`. On state transitions, apply GST split, adjust
  `wallet.balance`, guard insufficient funds, and write a completion/reversal WalletTransaction inside a
  Mongo session (ACID). This is the most logic-heavy admin route — preserve its rules exactly.

### Poker domain (rebuild to the canonical taxonomy: `Texas Hold'em | Omaha | Seven-Card Stud | Razz | Five-Card Draw`)
- **GET/POST /api/admin/poker** + **PUT/DELETE /api/admin/poker/[id]** — Poker = `{ gameType, description, objective, status }`.
  No `name`, no `rules`.
- **GET/POST /api/admin/pokerModes** + **PUT/DELETE /api/admin/pokerModes/[id]** — Mode = `{ pokerId, gameType, bType, stake,
  minBuyIn, maxBuyIn, mode, status }`. POST must inherit `gameType` from the parent Poker (client does NOT send it);
  the model pre-save sets `bType`. No `minPlayerCount`/`description` on Mode.
- **GET/POST /api/admin/pokerDesks** + **GET/PUT/DELETE /api/admin/pokerDesks/[id]** — Desk holds table-level
  `minPlayerCount`/`maxPlayerCount`/`maxSeats`. POST inherits stake/minBuyIn/maxBuyIn/bType/gameType/mode from mode+poker.

---

## 5. Socket subsystem (`src/server.ts`) — rebuild against current model method signatures

Standalone Socket.io engine on `SOCKET_PORT` (3001), path `/api/socket`, CORS to the frontend origin.

Events: `register` (token→userId), `joinTable`, `sitAtTable` (→ `addUserToSeat`), `addBalance`
(→ `addWalletBalance`), `leaveSeat` (→ status `disconnected`), `playerAction` (→ `handlePlayerAction`),
`createGame` (→ `createGameFromTable`), `disconnect`. Emits: `seatData`, `gameData`, `resultData`, `wGameData`.

Responsibilities: socket registry per table/user, reconnection handling, 30s auto-fold timer per turn,
auto-start when seated players **>= minPlayerCount**.

Fixes for the rebuild:
- `createGameFromTable()` takes **no arguments** — stop passing `tableId`.
- `isUserSeated()` is **synchronous** (returns boolean) — fix the local `IPokerTableDoc` interface and `await` usage.
- Correct the auto-start comparison from `<=` to `>=`.
- Align all method signatures in the local `IPokerTableDoc` interface to the real `pokerDesk.ts` methods.

---

## 6. Admin frontend (pages, components, hooks)

Rebuild to consume the rebuilt admin APIs and the canonical shapes. Apply throughout:
- Currency `₹`; status dropdowns use ONLY model enum values (`pending|completed|failed`, never `waiting`/`successful`).
- Pagination params `page`/`limit`; game-history filter param `username` (not `search`).
- Bank fields use `bankAccountId`; PMG fields read the flattened `{ username, orderId }`.
- Use `IGameHistory` from `pokerModelTypes.ts` as the game-history shape (it already matches the new archive).
- Remove `useSocket('admin')` from the poker management page (it has no reason to open a socket).
- Components to recreate: Sidebar, Header, SearchInput, UserStats, BankStats, GameStats, GameUsage,
  BankTransactionOverview, LatestPlayers, LeaderBoard, LatestGameHistory, UserBankTransactionsHistory.
- Pages to recreate: `admin/page.tsx` (poker mgmt), `pokerMode/[pokerId]`, `pokerDesk/[pokerModeId]`,
  `pokerDesk/details/[pokerDeskId]`, `gameList`, `statistics`, `transactions`, `PGTransactions`,
  `users`, `users/[userId]`, plus `auth/login`.
- `useSocket` hook stays available for the live-table views but isn't used by CRUD admin pages.

---

## 7. Target conventions (decide once, apply everywhere)

- **Routes**: REST + resource folders. Collections at `/resource`, items at `/resource/[id]`,
  sub-actions at `/resource/[id]/action`. Methods map to HTTP verbs (GET/POST/PUT/PATCH/DELETE).
- **Files**: components PascalCase, hooks `useX`, utils camelCase, one default export per component.
- **Types**: shared cross-file types in `pokerModelTypes.ts`; model-local types stay in the model;
  engine-local types stay in the engine.
- **Auth helper**: factor the repeated cookie+role check into one admin auth guard and the repeated
  Bearer check into one user auth guard, instead of copy-pasting in every route.
- **No dead code**: delete commented-out legacy blocks as you rebuild each file.
