# Rebuild Plan v2 — Spec-First, Clean-Slate

This replaces the in-place plan. Strategy: lock the spec, remove the old API/UI/socket
code on a branch (git keeps it), then rebuild from `SPEC.md` with proper structure.

Keep in the repo root: `CLAUDE.md`, `SPEC.md`, and `user_api_contracts.pdf` (in `/docs`).
**Commit everything before you begin.**

---

## Phase A — Validate & complete the spec (no deletion yet)

```
Read CLAUDE.md, then SPEC.md, then docs/user_api_contracts.pdf, then everything in
src/models/ and src/engine/. SPEC.md was extracted from the existing code — your job is to
VERIFY it captured every business rule and side effect before we delete the old code.

Go through every file under src/app/api/, src/components/, src/hooks/, src/utils/ (except
jwt.ts, helpers.ts, dbConnect.ts) and src/server.ts. For each, confirm its real intent and
side effects are already in SPEC.md. Report ONLY: (a) any business rule, validation, or side
effect present in the code but MISSING from SPEC.md, and (b) any place SPEC.md contradicts the
models. Do not edit code. Output a list of additions/corrections for SPEC.md.
```

Apply any real gaps to `SPEC.md` yourself, then commit. **Do not proceed until the spec is complete** — once the code is gone, the spec is all you have.

---

## Phase B — Snapshot & clear the slate

Do this in your terminal, not via Claude:

```bash
git add -A && git commit -m "Pre-rebuild: spec complete"
git checkout -b rebuild-from-spec
git tag pre-rebuild-snapshot   # easy recovery point
```

Then have Claude remove the old implementation (git still has it):

```
We are clearing the implementation to rebuild from SPEC.md. Delete (remove from the working
tree) ONLY these, and nothing else:
- everything under src/app/api/**
- everything under src/components/**
- the admin pages under src/app/admin/** and src/app/auth/**
- src/server.ts
- src/utils/pokerModelTypes.ts   (shared types — recreated clean in Phase C; nothing in
  models/ or engine/ imports it, so removing it is safe)
Do NOT touch src/models/**, src/engine/**, src/utils/jwt.ts, src/utils/helpers.ts,
src/config/dbConnect.ts, src/hooks/useSocket.ts, src/app/layout.tsx, src/app/page.tsx,
src/middleware.ts (cleaned in place in Phase H, not deleted), or any config file.
List exactly what you removed. Then stop.
```

---

## Phase C — Foundation

```
Per SPEC.md §1 and §7, create the foundation before any routes:
1. src/config/constants.ts with the centralized constants in SPEC.md §1.
2. src/utils/pokerModelTypes.ts — recreate it clean. It holds ONLY genuinely cross-file
   shared types (the API-response / DTO shapes the admin UI consumes — e.g. IGameHistory,
   IUserStats, IDeviceStat, IBankTransaction). Wherever possible DERIVE these from the model
   interfaces (import the relevant types from src/models/** and compose/Pick from them) rather
   than redeclaring fields by hand, so they cannot drift from the models again. No commented-out
   legacy. Note: nothing in models/ or engine/ imports this file — its only consumers are the
   admin components and routes we are rebuilding — so the new definitions only need to match
   the rebuilt consumers, which import by the @/utils/pokerModelTypes path.
3. A reusable admin auth guard (cookie token + role === 'admin') and a user auth guard
   (Bearer token), each returning the decoded payload or throwing a typed auth error.
Show me each file one at a time, then stop.
```

---

## Phase D — User-facing API (rebuild to the locked PDF shapes)

```
Rebuild the user-facing API to satisfy docs/user_api_contracts.pdf exactly, using the user
auth guard and the finalized models. Follow SPEC.md §3 for intent and the fixes noted there
(no phantom Poker fields in lobby/games; bankAccountId everywhere; implement the new
/api/user/games/history). Build in this order, ONE route file at a time, stopping after each:
  1. auth/otp/request, 2. auth/otp/verify
  3. user/wallet, 4. user/wallet/transactions
  5. user/banks, 6. user/banks/transactions
  7. payments/razorpay/order, 8. payments/razorpay/verify
  9. lobby/games, 10. lobby/desks/best, 11. user/games/history (new)
For each route, before coding, restate the PDF shape you're targeting so I can confirm it.
```

---

## Phase E — Admin API

```
Rebuild the admin API per SPEC.md §4, using the admin auth guard and the new models. Order,
one file at a time, stop after each:
  1. admin/auth/login
  2. admin/users (list), admin/users/[userId], users/[userId]/status, users/[userId]/balance
  3. admin/bankTransactions (list), bankTransactions/[transactionId]/status  ← preserve the GST/ACID ledger rules exactly
  4. admin/pmgTransactions (flattened shape)
  5. admin/poker + poker/[id], pokerModes + pokerModes/[id] (inherit gameType from parent), pokerDesks + pokerDesks/[id]
  6. admin/analytics/dashboard, analytics/games, analytics/users/[userId]  ← against the NEW archive schema only
Reminder: role === 'admin' everywhere; no fields that don't exist on the models.
```

---

## Phase F — Socket subsystem

```
Rebuild src/server.ts per SPEC.md §5 against the REAL method signatures in src/models/pokerDesk.ts:
createGameFromTable() takes no args; isUserSeated() is synchronous; auto-start fires when seated
players >= minPlayerCount; align the local IPokerTableDoc interface to the actual methods. Keep the
event set, the registry, reconnection, and the 30s auto-fold. Show the full file, then stop.
```

---

## Phase G — Admin frontend

```
Rebuild the admin frontend per SPEC.md §6, consuming the rebuilt admin API. Build shared pieces
first, then pages, ONE file at a time, stopping after each:
  Components: Sidebar, Header, SearchInput, then the dashboard widgets (UserStats, BankStats,
  GameStats, GameUsage, BankTransactionOverview, LatestPlayers, LeaderBoard), then
  LatestGameHistory and UserBankTransactionsHistory.
  Pages: auth/login, admin/statistics, admin/users, admin/users/[userId], admin/transactions,
  admin/PGTransactions, admin/page (poker mgmt), admin/pokerMode/[pokerId],
  admin/pokerDesk/[pokerModeId], admin/pokerDesk/details/[pokerDeskId], admin/gameList.
Throughout: ₹ not $; status dropdowns only pending|completed|failed; pagination page/limit;
game-history filter param `username`; use IGameHistory; no useSocket on CRUD pages.
```

---

## Phase H — Flow, build, verify

```
1. Confirm src/app/page.tsx redirects '/' → '/auth/login', and middleware redirects an
   authenticated user from '/auth/login' → '/admin/statistics'. Clean middleware logging/dead code.
2. Run `npm run type-check` and `npm run build`; fix type/build errors WITHOUT changing models,
   engine, or any user-facing route shape.
3. Produce a final checklist against SPEC.md §1 (every business rule present), §2 (auth), and the
   "fixes" called out in §3–§6. Report pass/fail with file references.
```

---

## Recovery & discipline

- Old code is always recoverable: `git show pre-rebuild-snapshot:src/app/api/<path>` or
  `git checkout pre-rebuild-snapshot -- <path>` to pull a single old file back for reference.
- Commit after every reviewed file/phase. That's your real undo.
- If Claude tries to edit a locked file or change a user-facing shape, stop it and point to SPEC.md.
- One file per step. Approve the restated plan before any code.
