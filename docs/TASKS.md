# TASKS.md — Poker App Rebuild Tracker

Single source of truth for the whole rebuild. Status legend:
`[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked / needs decision

Order matters top-to-bottom. Each item is sized to be done and reviewed in one focused pass.

---

## PHASE 0 — Frozen Core (edit once, then lock)

Per `FROZEN_CORE_EDITS.md`. After this phase is green and reviewed, these files are off-limits.

- [ ] 0.1  `src/config/constants.ts` — NEW. Money helpers (toMinor/toMajor/formatMoney), currencies, all constants
- [ ] 0.2  `src/models/wallet.ts` — integer money, `currency`, keep `userId` unique
- [ ] 0.3  `src/models/walletTransaction.ts` — integer money, `currency`, rename model → `WalletTransaction`, timestamps
- [ ] 0.4  `src/models/bankTransaction.ts` — integer money, `currency`, timestamps (keep `bankAccountId`)
- [ ] 0.5  `src/models/gatewayTransaction.ts` — integer money, status `successful`→`completed`
- [ ] 0.6  `src/models/pokerMode.ts` — integer money, `currency`, timestamps
- [ ] 0.7  `src/models/pokerGameArchive.ts` — integer money, `currency` (keep username required)
- [ ] 0.8  `src/models/pokerDesk.ts` — SLIM DOWN to schema + validation only. Integer money on all
           seat/player/pot fields. REMOVE all game-logic methods (createGameFromTable, handlePlayerAction,
           showdown, dealCards, getNextActivePlayer, getFirstActivePlayer, startNextRound) — they move to
           the service layer (0.8b). Keep only pure schema, indexes, and the integer-money guard.
- [ ] 0.8b `src/services/gameService.ts` — NEW. Orchestration layer: takes a desk doc, calls the ENGINE for
           all decisions, performs wallet/archive writes + persistence, owns Mongo sessions for atomicity.
           Houses: createGame, handlePlayerAction, showdown, advanceRound, addUserToSeat, addWalletBalance,
           userLeavesSeat. Showdown resolves userId→username before archiving (the empty-username fix).
           This is FROZEN core too (the standalone server is built around it).
- [ ] 0.9  `src/models/poker.ts` — confirm status enum `active|maintenance|disabled`, timestamps (light)
- [ ] 0.10 `src/models/user.ts` — Google-auth identity: `authProviders` array (Option 2, extensible),
           `email` unique, `mobileNumber` OPTIONAL + NOT unique, `usernameLocked` flag; remove duplicate
           indexes; use `createdAt` (drop `registrationDate`)
- [ ] 0.11 `src/models/otp.ts` — DELETE entirely (OTP auth removed; India-only, replaced by Google).
           Also remove `generateOtp` from `src/utils/helpers.ts` (keep `generateGamerName`).
- [ ] 0.12 `src/models/admin.ts` — confirm timestamps/enums (near-keep)
- [ ] 0.13 `src/engine/potCalculator.ts` — integer split math, drop `sanitizeMath`
- [ ] 0.14 `src/engine/handEvaluator.ts` — integer split math
- [ ] 0.15 `src/engine/gameEngine.ts` — integer math; `buildArchiveData` takes username map; add `advanceRound`
           helper (composes getNextRoundName + getCommunityCardsForRound) for the service to call
- [ ] 0.16 Wipe test database (terminal task)
- [ ] 0.17 Verify: type-check + build green; money-helper sanity checks; grep for leftover floats/`successful`/`createdOn`;
           confirm pokerDesk.ts has NO game-logic methods left
- [ ] 0.18 **FREEZE** — mark core locked (models + engine + services/gameService)

---

## PHASE 1 — Foundation (shared building blocks, built before features)

- [ ] 1.1  `src/utils/pokerModelTypes.ts` — NEW clean version, shared DTO/response types derived from model types
- [ ] 1.2  User auth guard — reusable Bearer-token verifier (returns payload or throws typed error)
- [ ] 1.3  Admin auth guard — reusable cookie+`role==='admin'` verifier
- [ ] 1.4  Money formatting at the API edge — confirm pattern for serializing integer minor → response shape
- [ ] 1.5  Standard API response/error helpers (consistent `{ message, ... }` + status codes)
- [ ] 1.6  `src/middleware.ts` — clean in place (strip logs/dead code, fix redirect target to `/admin/statistics`)

---

## PHASE 2 — Application Design (decide before building features)

This is a design conversation, not files. Produces a short design doc we build against.

- [ ] 2.1  Folder/route structure decided (our way) — API tree, components tree, pages tree
- [ ] 2.2  Naming conventions locked (files, types, routes)
- [ ] 2.3  User API integration plan — map each PDF endpoint → route file; confirm shapes
- [ ] 2.4  Practice/bot subsystem design — how bots produce actions, difficulty levels, ephemeral state
- [ ] 2.5  Live gameplay/socket design — events, turn loop, 60s timer, 3-skip disconnect, auto-start
- [ ] 2.6  Admin panel scope & screens confirmed
- [ ] 2.7  Edge-case catalog (timer-vs-action race, disconnect handling, all-in/side-pots, etc.)

---

## PHASE 3 — User-facing API (rebuild to locked PDF contract)

Order = dependency order. Each route reviewed before the next.

- [ ] 3.1  `POST /api/auth/google` — **NEW**. Verify Google ID token (google-auth-library), create-or-load
           user via authProviders, create wallet + signup bonus on first login, issue JWT. Replaces OTP.
- [ ] 3.2  `GET /api/user/username/suggestions` + `PATCH /api/user/username` — **NEW**. Onboarding username
           flow: suggest unique names; set a chosen unique name ONCE (rejects if `usernameLocked`); case-insensitive
           uniqueness check; sets `usernameLocked` on confirm
- [ ] 3.3  `GET /api/user/wallet` — balances
- [ ] 3.4  `GET /api/user/wallet/transactions` — paginated history
- [ ] 3.5  `GET /api/user/banks` + `POST /api/user/banks` — list / add (max 5, default handling)
- [ ] 3.6  `GET /api/user/banks/transactions` + `POST` — history / create (deposit needs image; withdraw guard)
- [ ] 3.7  `POST /api/payments/razorpay/order` — create gateway txn + order
- [ ] 3.8  `POST /api/payments/razorpay/verify` — HMAC verify, GST split, credit wallet
- [ ] 3.9  `GET /api/lobby/games` — games + modes + live stats (no phantom fields; bigBlind=2×stake)
- [ ] 3.10 `GET /api/lobby/desks/best` — matchmaking
- [ ] 3.11 `GET /api/user/games/history` — **NEW** endpoint (build fresh)
- [ ] 3.12 Update mobile app `ApiCaller.js`: Google sign-in auth, username onboarding, history endpoint; remove OTP calls
- [ ] 3.13 Verify every user route response matches the (updated) contract; OTP endpoints fully removed

---

## PHASE 4 — Admin API (rebuild to new models)

- [ ] 4.1  `POST /api/admin/auth/login` — bcrypt, 6h JWT + 6h cookie, status gate, role `admin`
- [ ] 4.2  `GET /api/admin/users` — paginated list + enrichment
- [ ] 4.3  `GET /api/admin/users/[userId]` — detail
- [ ] 4.4  `PATCH /api/admin/users/[userId]/status`
- [ ] 4.5  `POST /api/admin/users/[userId]/balance` — add/remove lockedBonus (`bonusAmount` field)
- [ ] 4.6  `GET /api/admin/bankTransactions` — list (populate `bankAccountId`)
- [ ] 4.7  `PATCH /api/admin/bankTransactions/[transactionId]/status` — GST/ACID ledger (preserve rules)
- [ ] 4.8  `GET /api/admin/pmgTransactions` — flattened gateway list
- [ ] 4.9  `GET/POST /api/admin/poker` + `PUT/DELETE /api/admin/poker/[id]` — canonical taxonomy
- [ ] 4.10 `GET/POST /api/admin/pokerModes` + `[id]` — inherit gameType from parent
- [ ] 4.11 `GET/POST /api/admin/pokerDesks` + `[id]` — inherit from mode+poker
- [ ] 4.12 `GET /api/admin/analytics/dashboard` — against new archive schema
- [ ] 4.13 `GET /api/admin/analytics/games`
- [ ] 4.14 `GET /api/admin/analytics/users/[userId]`

---

## PHASE 5 — Socket / Live Engine

- [ ] 5.1  `src/server.ts` — rebuild as a THIN socket transport: receive event → call gameService → emit.
           No game logic in the server; it calls services/gameService (0.8b), which calls the engine.
- [ ] 5.2  Turn loop + 60s auto-fold timer + 3-skip disconnect (orchestrated via gameService)
- [ ] 5.3  Bot action driver for practice mode (per difficulty) — feeds actions into the same gameService path
- [ ] 5.4  Reconnection + seat-status handling
- [ ] 5.5  Verify a full hand plays through to showdown + archives correctly (username fix proven)

---

## PHASE 6 — Admin Frontend

Components first, then pages.

- [ ] 6.1  Components: Sidebar, Header, SearchInput
- [ ] 6.2  Dashboard widgets: UserStats, BankStats, GameStats, GameUsage, BankTransactionOverview, LatestPlayers, LeaderBoard
- [ ] 6.3  LatestGameHistory, UserBankTransactionsHistory
- [ ] 6.4  `auth/login` page + `app/page.tsx` redirect
- [ ] 6.5  Pages: statistics, users, users/[userId]
- [ ] 6.6  Pages: transactions, PGTransactions
- [ ] 6.7  Pages: poker mgmt (`admin/page`), pokerMode/[pokerId]
- [ ] 6.8  Pages: pokerDesk/[pokerModeId], pokerDesk/details/[pokerDeskId], gameList
- [ ] 6.9  Currency rendered via `formatMoney`; status dropdowns use model enums only

---

## PHASE 7 — Integration & Verification

- [ ] 7.1  End-to-end: admin login → manage poker/modes/desks → see data
- [ ] 7.2  End-to-end: user OTP login → wallet → deposit (Razorpay) → lobby → join table
- [ ] 7.3  End-to-end: live hand to showdown; practice hand vs bots
- [ ] 7.4  Final type-check + build; confirm no frozen-core regressions
- [ ] 7.5  (Deferred) Vitest money-math suite — revisit before trusting live-mode money

---

## Open decisions / parking lot

- [ ] Blind/stake semantics documented in lobby (settled: SB=stake, BB=2×stake, ante=stake)
- [ ] `walletTransaction` collection name after model rename — confirm `wallettransactions`
- [ ] Bot identity representation at runtime (synthetic in-memory ids — no DB)
- [ ] Deployment topology for next(3000) + socket(3001) — revisit before going live

### Auth change log (frozen core was unlocked deliberately)
- REASON: launching in USA + India. OTP (2factor) is India-only; Google login works everywhere. Boss directive.
- Identity is now provider-based via `authProviders` (Option 2, extensible). Google is the only provider for now.
- OTP fully removed (endpoints + `otp.ts` model + `generateOtp`). `mobileNumber` is optional, non-unique, contact-only.
- TO RE-ADD OTP LATER (mobile or Google-OTP): add a provider value to authProviders + one verify endpoint.
  No user-model change needed — that's the whole point of the providers structure. Do NOT revive old OTP code.
- NEW DEPENDENCY: Google Cloud OAuth client (`GOOGLE_CLIENT_ID` env var) + `google-auth-library` npm package,
  needed before `/api/auth/google` can be built/tested. Mobile app uses native Google SDK → sends ID token to backend.
- CONTRACT IMPACT: the user API contract's auth section (OTP request/verify) is SUPERSEDED by `/api/auth/google`
  + the username onboarding endpoints. Mobile `ApiCaller.js` must change (we own it). Non-auth user endpoints unchanged.
