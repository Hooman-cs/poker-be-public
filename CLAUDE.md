# CLAUDE.md — Poker Admin Project Briefing

Read this file fully before doing anything. It defines what is locked, what the
source of truth is, and how you must behave in this repo.

---

## What this project is

Next.js 14 **App Router**, TypeScript only (`.ts` / `.tsx`). This repo contains:

- The **complete backend** (auth, user routes, lobby, payments, game engine, models).
- The **admin-side frontend** (the dashboard under `src/app/admin/**`).

A separate **user-side frontend** (not in this repo) consumes the user-facing API.
Its expected request/response shapes are LOCKED and documented in
`user_api_contracts.pdf`. We must never change those shapes.

---

## Source-of-truth precedence (resolve every conflict this way)

1. **Models** (`src/models/**`) — the highest authority for data shape.
2. **User API Contract PDF** — the authority for user-facing route shapes.
3. Everything else (admin routes, components, pages) must conform to 1 and 2.

If a route or component disagrees with the model, **the model is correct** and the
route/component must change. The only exception: user-facing routes must satisfy
BOTH the model and the PDF contract.

---

## LOCKED — never edit these

- `src/models/**` — finalized.
- `src/engine/**` — finalized game engine (`gameEngine.ts`, `handEvaluator.ts`, `potCalculator.ts`).
- `src/utils/jwt.ts`, `src/utils/helpers.ts`, `src/config/dbConnect.ts`.
- The **request/response shapes** of user-facing routes:
  `src/app/api/auth/**`, `src/app/api/lobby/**`, `src/app/api/user/**`, `src/app/api/payments/**`.
  (Internal implementation may be corrected, but the shapes in the PDF must not change.)

If you believe a locked file has a real bug, STOP and tell me — do not edit it.

---

## Conventions (apply consistently everywhere)

- **Admin auth = httpOnly cookie** named `token`, read via `cookies().get('token')`.
- **User auth = Bearer token** in the `Authorization` header.
- **JWT role**: the `admin` model issues `role: 'admin'`. Every admin route must
  authorize on `payload.role === 'admin'`. Do NOT check for `'superadmin'` anywhere.
- **Currency is INR**, displayed as `₹`, amounts stored in rupees. Never render `$`.
- One concern per file. Keep route handlers thin; no phantom fields.
- Always `await dbConnect()` first; always wrap in try/catch with correct status codes.

---

## Canonical data shapes (from the finalized models)

- **Poker game types**: `"Texas Hold'em" | "Omaha" | "Seven-Card Stud" | "Razz" | "Five-Card Draw"`.
  There is NO `NLH` / `PLO4` / `PLO5`, no `name`, no `rules` on Poker. Poker = `{ gameType, description, objective, status }`.
- **PokerMode** = `{ pokerId, gameType, bType, stake, minBuyIn, maxBuyIn, mode, status }`.
  `bType` is auto-set from `gameType` in a pre-save hook. There is NO `minPlayerCount` or `description` on PokerMode.
- **PokerDesk** holds `minPlayerCount` / `maxPlayerCount` / `maxSeats` (table-level).
- **PokerGameArchive** = `{ deskId, pokerModeId, gameType, players[], pots[], totalPot, startedAt, completedAt }`.
  - `players[]` = `{ userId, username, seatNumber, startingStack, endingStack, totalBet, isWinner }` — **no `status` field**.
  - `pots[]` = `{ potNumber, totalAmount, winners[] }`, winners = `{ playerId, username, amount, handDescription }` — **no `contributors`**.
  - There is NO `mode`, `status`, `bType`, `stack`, `deskName`, `totalBet`, or `createdAt` on the archive.
- **BankTransaction** uses `bankAccountId` (NOT `bankId`), timestamps via `createdOn`/`completedOn`,
  status enum `pending | completed | failed`, type `deposit | withdraw`.
- **GatewayTransaction** uses `gatewayOrderId` / `gatewayPaymentId` (NOT `orderId`),
  status enum `created | pending | successful | failed`.
- **Wallet/WalletTransaction** are separate from User; transaction `amount` is an
  `IAmountBreakdown` object, not a number.

The shared TS interface `IGameHistory` in `src/utils/pokerModelTypes.ts` already matches the
new archive — prefer it as the canonical game-history shape for admin UI.

---

## Known issues to fix during the rebuild

These are confirmed mismatches. Fix them as you rebuild each layer.

### Auth (highest priority — breaks most of the panel)
- Admin routes inconsistently check `'superadmin'` vs `'admin'`. The token carries `'admin'`.
  Standardize every admin route to `payload.role === 'admin'`.

### PokerGameArchive read APIs target a stale schema
- `api/admin/analytics/dashboard`: remove `mode: 'cash'` and `status: 'finished'` matches
  (fields don't exist). An archive row already means a completed game. Use `totalPot`.
- `api/admin/games`: remove the phantom `mode` filter; read `page`/`limit` (NOT `pageNo`/`itemsPerPage`);
  map `totalPot` (not `totalBet`); use `completedAt` (not `createdAt`); drop `bType`/`stack`/`deskName`
  and `players.status` (don't exist). Players already store `username`, so the `.populate` is unnecessary.
- `api/admin/analytics/games`: drop the `pots.contributors` aggregation (no contributors); use
  `pots.winners.playerId`/`amount`; `totalPot` not `totalBet`.
- `api/admin/analytics/users/[userId]`: `foldRate` is NOT derivable (archive has no per-player status).
  Drop it or return N/A. `totalBet` via `players.totalBet` is fine.

### Field-name drift
- BankTransaction admin route + UI use `bankId`; the model field is `bankAccountId`. Standardize to `bankAccountId`.
- PMG UI reads `transaction.username` / `transaction.orderId`; API returns populated `userId` + `gatewayOrderId`.
  Decide one shape and align both (recommend the API flattens to `{ username, orderId, amount, status, createdAt }`).
- Pagination param drift: UI sends `page`/`limit`; `games` route reads `pageNo`/`itemsPerPage`. Standardize on `page`/`limit`.
- `LatestGameHistory` sends `search`; API expects `username`. Standardize on `username`.

### Status handling
- Bank status update: `UserBankTransactionsHistory` sends `{ status }`; route reads `{ newStatus }`. Standardize on `newStatus`.
- Admin status dropdowns offer `waiting`/`successful` — not in the model enum. Use only `pending | completed | failed`.

### Poker domain UI is on the old taxonomy
- `admin/page.tsx`, `gameList`, `pokerMode/[pokerId]` use `NLH/PLO4/PLO5`, `name`, `rules`, and
  collect `minPlayerCount`/`description` on Mode. Rebuild to the canonical taxonomy and fields above.
- `POST /api/admin/pokerModes` must inject `gameType` from the parent Poker (mode form should not send it);
  the pre-save hook then sets `bType`.

### Misc
- `admin/page.tsx` calls `useSocket('admin')` for no reason — remove.
- Standardize the post-login redirect and the middleware `/auth/login` redirect to the same path
  (`/admin/statistics`). Clean up the `console.log` noise in `middleware.ts`.
- Currency symbols: replace all `$` in admin UI with `₹`.

---

## Rules of engagement (how you must work)

- Before writing code for a task, state a short plan and which files you'll touch. Then STOP for my OK.
- Work on **one file or one tightly-scoped slice at a time**. After each, STOP and wait for review.
- Never edit anything in the LOCKED list.
- Never change a user-facing request/response shape (cross-check the PDF).
- If something is ambiguous, ask one question rather than guessing.
- Prefer deleting dead/commented-out code over leaving it. Many files contain large commented-out
  "legacy" blocks — remove them when you rebuild that file.
