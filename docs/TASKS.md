# TASKS.md — Poker App Rebuild Tracker

Single source of truth for the whole rebuild. Status legend:
`[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked / needs decision

Order matters top-to-bottom. Each item is sized to be done and reviewed in one focused pass.

---

## PHASE 0 — Frozen Core (edit once, then lock)

Per `FROZEN_CORE_EDITS.md`. After this phase is green and reviewed, these files are off-limits.

- [x] 0.1  `src/config/constants.ts` — NEW. Money helpers (toMinor/toMajor/formatMoney), currencies, all constants
- [x] 0.2  `src/models/wallet.ts` — integer money, `currency`, keep `userId` unique
- [x] 0.3  `src/models/walletTransaction.ts` — integer money, `currency`, rename model → `WalletTransaction`, timestamps
- [x] 0.4  `src/models/bankTransaction.ts` — integer money, `currency`, timestamps (keep `bankAccountId`)
- [x] 0.5  `src/models/gatewayTransaction.ts` — integer money, status `successful`→`completed`
- [x] 0.6  `src/models/pokerMode.ts` — integer money, `currency`, timestamps
- [x] 0.7  `src/models/pokerGameArchive.ts` — integer money, `currency` (keep username required)
- [x] 0.8  `src/models/pokerDesk.ts` — SLIM DOWN to schema + validation only. Integer money on all
           seat/player/pot fields. REMOVE all game-logic methods (createGameFromTable, handlePlayerAction,
           showdown, dealCards, getNextActivePlayer, getFirstActivePlayer, startNextRound) — they move to
           the service layer (0.8b). Keep only pure schema, indexes, and the integer-money guard.
- [x] 0.8b `src/services/gameService.ts` — NEW. Orchestration layer: takes a desk doc, calls the ENGINE for
           all decisions, performs wallet/archive writes + persistence, owns Mongo sessions for atomicity.
           Houses: createGame, handlePlayerAction, showdown, advanceRound, addUserToSeat, addWalletBalance,
           userLeavesSeat. Showdown resolves userId→username before archiving (the empty-username fix).
           This is FROZEN core too (the standalone server is built around it).
- [x] 0.9  `src/models/poker.ts` — confirm status enum `active|maintenance|disabled`, timestamps (light)
- [x] 0.10 `src/models/user.ts` — Google-auth identity: `authProviders` array (Option 2, extensible),
           `email` unique, `mobileNumber` OPTIONAL + NOT unique, `usernameLocked` flag; remove duplicate
           indexes; use `createdAt` (drop `registrationDate`)
- [x] 0.11 `src/models/otp.ts` — DELETE entirely (OTP auth removed; India-only, replaced by Google).
           Also remove `generateOtp` from `src/utils/helpers.ts` (keep `generateGamerName`).
- [x] 0.12 `src/models/admin.ts` — confirm timestamps/enums (near-keep)
- [x] 0.13 `src/engine/potCalculator.ts` — integer split math, drop `sanitizeMath`
- [x] 0.14 `src/engine/handEvaluator.ts` — integer split math
- [x] 0.15 `src/engine/gameEngine.ts` — integer math; `buildArchiveData` takes username map; add `advanceRound`
           helper (composes getNextRoundName + getCommunityCardsForRound) for the service to call
- [ ] 0.16 Wipe test database (terminal task)
- [ ] 0.17 Verify: type-check + build green; money-helper sanity checks; grep for leftover floats/`successful`/`createdOn`;
           confirm pokerDesk.ts has NO game-logic methods left
- [ ] 0.18 **FREEZE** — mark core locked. Promote every Phase 0 output to `KEEP.md`'s Foundation Keep
           section: all `src/models/**`, all `src/engine/**`, `src/config/constants.ts`, and
           `src/services/gameService.ts`. After this step they are governed by the same off-limits
           rule as the existing Foundation Keep entries.

---

## PHASE 1 — Foundation (shared building blocks, built before features)

- [x] 1.1  `src/types/pokerModelTypes.ts` — NEW clean version at NEW PATH (moved from src/utils/). Shared DTO/response types derived from model types; old empty file at src/utils/pokerModelTypes.ts deleted
- [x] 1.2  User auth guard — reusable Bearer-token verifier (returns payload or throws typed error)
- [x] 1.3  Admin auth guard — reusable cookie+`role==='admin'` verifier
- [x] 1.4  Money formatting at the API edge — confirm pattern for serializing integer minor → response shape
- [x] 1.5  Standard API response/error helpers (consistent `{ message, ... }` + status codes)
- [x] 1.6  `src/middleware.ts` — full rewrite. Strip debug logs, remove dead `/api/socket` matcher + branch,
           change post-login redirect from `/admin` to `/admin/overview` (general-purpose landing surface,
           not a deep section page). Behavior-equivalent to original on the auth-gate side; ~25% the lines.
- [x] 1.7  `scripts/createAdmin.ts` — CLI seed script. Reads name/email/mobile/password (prompts or args),
           calls `Admin.create(...)`, exits. Run from the server shell ONLY. Must be run once after the DB
           wipe (0.16) so the admin panel can be logged into before Phase 6.
- [x] 1.7b `scripts/changeAdminPassword.ts` — CLI companion to 1.7. Looks up an admin by email, confirms
           identity, prompts for a new password, saves through the model so the bcrypt pre-save hook hashes
           it. Only modifies the password field; never deletes, never creates. The recovery path if an
           admin password is forgotten or mistyped during seeding.
- [x] 1.8  `scripts/playOneHand.ts` — **Tier-1 smoke test.** CLI script that seeds a poker + mode + desk +
           N users with wallets, then drives a full hand through gameService end-to-end: createGame →
           handlePlayerAction (×several) → showdown. Inspects archive. NOT a test suite (no assertions
           framework, no Vitest yet) — just a "does the frozen core actually work" smoke test. Run before
           Phase 3 starts so we have ground truth on the engine+service before building routes on top.
- [x] 1.9  **Button rotation + narrow game-type scope** — Level 2 unlock (see LOGS.md 2026-06-01).
           Narrow `PokerGameType` to `"Texas Hold'em" | 'Omaha'` (Level 3 edit on `src/models/poker.ts`).
           Add `buttonPosition` field (PokerDesk or embedded currentGame — decided in design turn).
           Modify `initializeGameState` to accept button position and derive SB/BB/UTG from it.
           Modify `createGame` to advance button between hands, skipping empty seats; heads-up special
           case where button = SB. Keep `bType` and the engine's `'antes'` branch in place as
           forward-compatible dead code; comment them as unreachable-for-now. Acceptance: tasks 1.10's
           4-player, 6-player, and multi-hand smoke tests all pass; multi-hand shows different players
           holding SB across consecutive hands.
- [x] 1.10 **Extended Tier-1 smoke tests** — DELIVERED as two scripts:
             • `scripts/playThreeHands.ts` — 3 hands on same desk. Verifies button rotation across hands.
               14/14 checks passed.
             • `scripts/playLifecycle.ts` — single combined script covering 5 hands at varying player counts
               (4→6→5 mid-hand-leave→4→3→force-close→reject hand 6). Verifies cold-start gate, warm play,
               mid-hand leave, warm-floor play (3 players), force-closure when below minToContinue,
               rejection of new hands on closed desk, and money conservation across the full lifecycle.
               All checks passed.
           Originally planned as 4 separate scripts (playOneHand-4p, playOneHand-6p, playThreeHands,
           playHandWithLeave); combined into the lifecycle script per user's "test it as a real-world
           scenario" suggestion.
- [x] 1.11 `scripts/seedLobby.ts`
- [x] 1.12 `scripts/wipeDb.ts` — hard reset: deletes all documents from User, Wallet,
           WalletTransaction, BankAccount, BankTransaction, GatewayTransaction, Poker,
           PokerMode, PokerDesk, PokerGameArchive, PracticeSession, Admin. AppConfig
           preserved. Prints deleted count per collection. Prints next-step instructions
           (createAdmin.ts → seedLobby.ts).
- [x] 1.13 Update `scripts/seedLobby.ts` — add a practice desk after the two cash desks:
           a new PokerMode (`mode: 'practice'`, `stake: 10000`, same INR/blinds fields)
           and one PokerDesk (`isPractice: true`, `minToStart: 3`, `maxSeats: 6`,
           `tableName: 'Practice Table 1'`). Print the practice desk ID so the
           frontend dev can paste it into the socket `practice` event.
- [x] 1.14 `scripts/wipeGameData.ts` — partial wipe: deletes Poker, PokerMode, PokerDesk,
           PokerGameArchive, PracticeSession only. Users, wallets, admin, AppConfig preserved.
           Use this to reseed lobby without touching accounts.
- [x] 1.15 `scripts/seedPracticeDesks.ts` — creates 1 Poker (upsert) + 1 PokerMode
           (mode: 'practice') + 20 PokerDesks (isPractice: true, 6 seats, minToStart: 3).
           Idempotent via PokerMode.description marker. Prints all 20 deskIds.
- [x] 1.16 **Bot model** — fixes B8/B10. New `src/models/bot.ts` (deskId, botId,
           seatNumber, strategy, botName). `addBotToSeat` writes a Bot record per
           seated bot, with `botName = generateGamerName() + '_bot'`. Replaces
           in-memory `runtime.botSeats` as the source of truth for bot identity
           AND eviction. Two fixes: (1) practice desks no longer close after one
           hand — bots persist across hands; new `evictBotsIfNoHumans` helper
           (server.ts) evicts bots + force-closes the desk only when no human seat
           remains, called from handleNeedsShowdown / leave / 3-skip eviction paths.
           (2) `gameService.showdown()` (Level 2, surgical — see LOGS.md 2026-06-11)
           merges `Bot.find({deskId})` botName into `usernameByUserId` so bot players
           archive correctly instead of `'unknown'`. Tier-1 smoke tests run as
           regression check.
- [x] 1.17 **B11–B15 fixes** — PokerGameArchive gains a required `mode: 'cash'|'practice'`
           field (Level 3, additive), copied from `desk.mode` in `gameService.showdown()`
           (Level 2, one line — see LOGS.md 2026-06-11). Dashboard `totalArchived` +
           leaderboard, and per-user `analytics/users/[userId]` (stats/games/total),
           filter to `mode: 'cash'`; `analytics/games` gets an optional `mode` filter +
           `mode` in output (no default, B11e). `pokerDesks` POST derives `isPractice`
           from `pokerMode.mode === 'practice'` (B12). `server.ts` bot-strategy
           non-null assertion replaced with explicit guard (B13).
           `analytics/users/[userId]` 404s if no `User` exists (B14).
           `lobby/desks/best` missing-`modeId` uses new `MISSING_MODE_ID` (400);
           `errors.ts` adds that code + an explicit `RAZORPAY_NOT_CONFIGURED` → 500
           case (B15). Tier-1 smoke tests pass (Level 2 touched).
- [x] 1.19 **createGame eligibility threshold (cold vs warm)** — Level 2 fix
           (`gameService.createGame` + `engine.initializeGameState`, see
           LOGS.md 2026-06-11). Practice hand 2 silently never started: both
           functions gated per-hand eligibility on `balanceAtTable >=
           desk.minBuyIn`, and practice `minBuyIn === PRACTICE_STARTING_CHIPS`,
           so any chip loss in hand 1 made a player ineligible for hand 2 —
           `createGame` threw `InvalidStateError`, silently swallowed by
           `scheduleAutoStart`'s catch. Fix: cold desk (first hand ever) keeps
           `minBuyIn` as the sit-down gate; warm desk (subsequent hands) gates
           on `minChipsToContinue = bType==='blinds' ? stake*2 : stake`
           instead. `initializeGameState`'s `minBuyIn` param renamed
           `eligibilityThreshold` (caller-determined). `server.ts`
           `scheduleAutoStart` catch (Level 4) now logs non-"closed"
           `InvalidStateError`s instead of swallowing them silently. Tier-1
           smoke tests pass.
- [x] 1.20 **Statistics page redesign + Overview cross-links** -- all Level 4.
           New `GET /api/admin/analytics/statistics` route: 30-day daily series
           (signups, cash games played, deposit volume -- raw minor units, see
           LOGS.md 2026-06-11) + 30-day totals + top-20 all-time leaderboard.
           New `TrendChart` component (chart.js/react-chartjs-2, already in
           package.json, previously unused). `statistics/page.tsx` rewritten:
           3 stat cards, 3 charts (2 line + 1 bar), top-20 leaderboard table,
           link to `/admin/gameList` for the raw per-hand table (which keeps
           its existing view, untouched). 7 dashboard widgets
           (UserStats/GameStats/BankStats/GameUsage/BankTransactionOverview/
           LatestPlayers/LeaderBoard) get additive cross-links to
           users/statistics/transactions/poker. Also: investigate whether
           `src/types/pokerModelTypes.ts` has any external importers -- delete
           if dead, otherwise report importers for review.
- [ ] 1.21 **Multi-hand integration retest (post-1.19/1.20)** -- manual, real
           frontend + real socket server, no Claude Code prompt (or a small
           diagnostic-only prompt if a new bug is found). Goal: confirm the
           1.19 eligibility fix actually resolves "hand 2 never starts" in
           practice via the real client (not just the Tier-1 scripts), and do
           the same for a cash desk with 2+ real users across several hands.
           Checklist:
             - Practice desk: play through hand 1, confirm hand 2+ auto-starts
               with no manual reload.
             - If a hand still fails to start, check socket-server stderr for
               the new `[scheduleAutoStart] createGame precondition failed...`
               line (added in 1.19) -- that message pinpoints the exact gate
               that's failing.
             - Cash desk: 2+ real users, several consecutive hands, confirm
               button rotation + balances look correct across hands.
             - Re-check the "closed desk with seatedCount: 1, can't delete"
               symptom from earlier in this session. If it recurs, capture
               `db.pokerdesks.findOne({_id:...})` for that desk -- needed to
               diagnose, code-reading alone couldn't find the path that
               produces that state.
             - Admin: open the redesigned `/admin/statistics` page (task 1.20)
               and confirm charts render with real data, and the Overview
               cross-links navigate correctly.
           Feeds into Phase 7.3 (Tier-3 live-gameplay E2E) -- do this first,
           since 7.3 will otherwise hit the same hand-2 issue this retest is
           meant to catch early.
- [x] 1.18 **Admin frontend fixes** — edit modals (Option B), back links, remove
           isPractice checkbox. New shared `Modal` component (Tailwind, no deps).
           `ModeRowActions` gets "Edit" button + modal for stake/minBuyIn/maxBuyIn.
           `DeskRowActions` gets "Edit" button + modal for tableName/minToStart/
           minToContinue/maxPlayerCount. Back links added to pokerMode/[pokerId],
           pokerDesk/[pokerModeId], users/[userId]. `DeskCreateForm` isPractice
           checkbox removed (B12 frontend half). All Level 4, no backend changes.

---

## PHASE 2 — Application Design (decide before building features)

This is a design conversation, not files. Produces a short design doc we build against.

- [x] 2.1  Folder/route structure decided — full API tree in ARCHITECTURE.md (user + admin routes);
           components tree and pages tree captured in Phase 6 task list
- [x] 2.2  Naming conventions locked — camelCase ts, PascalCase tsx, route.ts, @/ imports, no barrels;
           all documented in ARCHITECTURE.md Conventions section
- [x] 2.3  User API integration plan — each PDF endpoint mapped to route file in Phase 3 task
           descriptions (3.1–3.12) with exact paths and shapes confirmed
- [x] 2.4  Practice/bot subsystem design — same handlePlayerAction path; pluggable BotStrategy
           interface; 3 difficulty levels (easy/medium/hard); synthetic ObjectId identity, no DB;
           ephemeral Map<deskId, BotSeat[]> in server process. Documented in ARCHITECTURE.md.
- [x] 2.5  Live gameplay/socket design — namespace:verb events; full state broadcast; 60s
           server-side timer; 3-skip auto-leave; server-driven auto-start (3s delay).
           DeskRuntimeState shape defined. Documented in ARCHITECTURE.md.
- [x] 2.6  Admin panel scope & screens confirmed — 13 screens mapped to Phase 6 tasks;
           GameHistory + BankTransactionsHistory embedded in user detail (not standalone);
           sidebar drill-down nav (poker → modes → desks). Documented in ARCHITECTURE.md.
- [x] 2.7  Edge-case catalog — 8 cases documented in ARCHITECTURE.md: timer/action race,
           disconnect handling, all-in run-out after leave, auto-start timer race,
           needsShowdown from leave, all-in on blind, double-join on reconnect,
           leave during auto-start window.

---

## PHASE 3 — User-facing API (rebuild to locked PDF contract)

Order = dependency order. Each route reviewed before the next.

- [x] 3.1  `POST /api/auth/google` — DONE. Note: schema field is `authProviders.providerId`
           (not `providerUserId`). WalletTransaction type is `'bonus'` with `remark: 'signupBonus'`
           (no `'signupBonus'` enum value exists). `'inactive'` status also rejected (only `'active'`
           gets a JWT — consistent with requireAdmin).
- [x] 3.2  `GET /api/user/username/suggestions` + `PATCH /api/user/username` — DONE.
           Regex-escapes user input before MongoDB case-insensitive query. Max 60 attempts
           to find 3 available suggestions. New error codes: USERNAME_LOCKED (409),
           USERNAME_TAKEN (409), MISSING_USERNAME (400).
- [x] 3.3  `GET /api/user/wallet` — DONE. Field names confirmed: `balance`, `instantBonus`,
           `lockedBonus`, `currency` — all schema-defaulted to 0, no fallbacks needed.
- [x] 3.4  `GET /api/user/wallet/transactions` — DONE. Seven amount sub-fields confirmed:
           cashAmount, instantBonus, lockedBonus, gst, tds, otherDeductions, total.
           Used `.lean<LeanTx[]>()` for TypeScript access to timestamps fields.
- [x] 3.5  `GET /api/user/banks` + `POST /api/user/banks` — DONE. Route-level 5-account
           check added on top of model pre-save hook (hook gives untyped 500; route gives
           clean BANK_LIMIT_REACHED 400). isDefault auto-set for first account.
- [x] 3.6  `GET /api/user/banks/transactions` + `POST` — DONE. POST accepts multipart
           formData for both deposit and withdraw. Deposit saves image to UPLOAD_DIR
           (mkdir recursive). Withdraw checks wallet balance but does NOT deduct
           (pending only — admin approves in Phase 4). New error codes:
           INVALID_BANK_ACCOUNT (404), MISSING_IMAGE (400), INSUFFICIENT_BALANCE (400).
- [x] 3.7  `POST /api/payments/razorpay/order` — DONE. Creates Razorpay order + GatewayTransaction
           (status: 'created'). Response `amount` is raw integer (not serializeMoney) —
           intentional exception; Razorpay SDK requires minor-unit integer.
- [x] 3.8  `POST /api/payments/razorpay/verify` — DONE. HMAC-SHA256 verify (timingSafeEqual)
           before any DB read. GST split via GST_MULTIPLIER from constants. All three DB
           writes in one Mongo transaction. Rejects if status !== 'created' (no double-credit).
           instantBonus credit deferred to 3.8b (AppConfig). FORBIDDEN (403) added to errors.
- [x] 3.8b `AppConfig` model + update verify route — DONE. Singleton model with
           `gstMultiplier` (default 1.28) and `depositBonusRate` (default 1.0). Pre-save
           validators. Verify route loads config with fallbacks; bonus = gstAmount × rate.
           Both wallet.balance and wallet.instantBonus incremented in same Mongo transaction.
- [x] 3.9  `GET /api/lobby/games` — DONE. Three sequential .lean() queries assembled via Maps
           for O(1) lookup. bigBlind computed inline (stake × 2). All three levels filtered
           to status: 'active'. No phantom fields.
- [x] 3.10 `GET /api/lobby/desks/best` — DONE. $expr/$size for open-seat filter. Sorted
           fullest-first. Returns { desk: null } on no match. modeId.isValid() guard
           prevents CastError 500 on malformed ObjectId.
- [x] 3.11 `GET /api/user/games/history` — DONE. Queries PokerGameArchive on existing
           compound index. completedAt is a schema field (not timestamps), so lean type
           augmentation is _id + createdAt only. Defensive skip if user entry missing.
- [x] 3.12 Update mobile app `ApiCaller.js` — FILE NOT IN THIS REPO (mobile codebase).
           Required changes documented here:
           • Remove: requestOtp_Post, verifyLogin_Post
           • Add: googleLogin_Post({ idToken, deviceType? }) → POST /api/auth/google
           • Add: getUsernameSuggestions_Get() → GET /api/user/username/suggestions
           • Add: setUsername_Patch({ username }) → PATCH /api/user/username
           • Add: getGameHistory_Get({ page, limit }) → GET /api/user/games/history
           • Update: wallet endpoint from /api/auth/fetchUserWallet → GET /api/user/wallet
           • Update: all money fields in responses are now strings (e.g. "₹12.34") — display as-is
           • Store JWT from login response; send as Authorization: Bearer <token> header
- [x] 3.13 Verify every user route response matches contract — DONE. 12/13 routes fully
           correct. 1 known exception (Razorpay order amount is raw integer — documented).
           1 bug found: POST /api/auth/google only rejects 'suspended', not 'inactive'.
           Fixed in 3.13-patch.

---

## PHASE 4 — Admin API (rebuild to new models)

- [x] 4.1  `POST /api/admin/auth/login` — bcrypt, 6h JWT + 6h cookie, status gate, role `admin`
- [x] 4.2  `GET /api/admin/users` — paginated list + enrichment
- [x] 4.3  `GET /api/admin/users/[userId]` — detail
- [x] 4.4  `PATCH /api/admin/users/[userId]/status`
- [x] 4.5  `POST /api/admin/users/[userId]/balance` — add/remove lockedBonus (`bonusAmount` field)
- [x] 4.6  `GET /api/admin/bankTransactions` — list (populate `bankAccountId`)
- [x] 4.7  `PATCH /api/admin/bankTransactions/[transactionId]/status` — GST/ACID ledger (preserve rules)
- [x] 4.8  `GET /api/admin/gatewayTransaction` — flattened gateway list (renamed from pmgTransactions to match GatewayTransaction model)
- [x] 4.9  `GET/POST /api/admin/poker` + `PUT/DELETE /api/admin/poker/[id]` — canonical taxonomy
- [x] 4.10 `GET/POST /api/admin/pokerModes` + `[id]` — inherit gameType from parent
- [x] 4.11 `GET/POST /api/admin/pokerDesks` + `[id]` — inherit from mode+poker
- [x] 4.12 `GET /api/admin/analytics/dashboard` — against new archive schema
- [x] 4.13 `GET /api/admin/analytics/games`
- [x] 4.14 `GET /api/admin/analytics/users/[userId]`
- [x] 4.15 `GET/PATCH /api/admin/config` — read/update AppConfig singleton (gstMultiplier,
           depositBonusRate). Admin-only. GST change must show warning in admin UI.

---

## PHASE 5 — Socket / Live Engine

- [x] 5.1  `src/server.ts` — rebuild as a THIN socket transport: receive event → call gameService → emit.
           No game logic in the server; it calls services/gameService (0.8b), which calls the engine.
           C→S events: `join` `{ deskId, seatNumber, buyInAmount }` (calls addUserToSeat), `action`, `leave`.
           S→C room broadcasts use redacted state (holeCards stripped). `game:start` additionally emits
           targeted `{ holeCards }` to each player's socket. `error` (targeted) for failed actions/joins.
           `DeskRuntimeState.userSockets` (userId→socketId) enables all targeted emits.
           **Convention reminder:** `handlePlayerAction` and `userLeavesSeat` both return
           `{ desk, needsShowdown }`. When `needsShowdown` is true, the socket handler MUST follow up
           with `showdown({ deskId })` to finalize the hand. Otherwise the hand sits in limbo.
- [x] 5.2  Turn loop + 60s auto-fold timer + 3-skip disconnect (orchestrated via gameService)
- [x] 5.3a Practice mode foundation
- [x] 5.3b Bot layer + matchmaking
- [x] 5.3c Practice sessions admin endpoint
- [x] 5.4  Reconnection + seat-status handling
- [x] 5.5  Verify a full hand plays through to showdown + archives correctly (username fix proven)
- [x] 5.6  **Tier-2 smoke test** (`scripts/tier2Smoke.ts`)

---

## PHASE 6 — Admin Frontend

Components first, then pages.

- [x] 6.1  Components: Sidebar, Header, SearchInput
- [x] 6.2  Dashboard widgets: UserStats, BankStats, GameStats, GameUsage, BankTransactionOverview, LatestPlayers, LeaderBoard
- [x] 6.3  LatestGameHistory, UserBankTransactionsHistory
- [x] 6.4  `auth/login` page + `app/page.tsx` redirect + `app/admin/overview/page.tsx`
- [x] 6.5  Pages: statistics, users, users/[userId]
- [x] 6.6  Pages: transactions, PGTransactions
- [x] 6.7  Pages: poker mgmt (`admin/page`), pokerMode/[pokerId]
- [x] 6.8  Pages: pokerDesk/[pokerModeId], pokerDesk/details/[pokerDeskId], gameList
- [x] 6.9  Currency rendered via `formatMoney`; status dropdowns use model enums only

---

## BUGS — Found During Frontend Testing

Full details in `docs/BUGS.md`. Backend bugs are fixed via Claude Code;
frontend bugs are for the frontend developer.

### Backend (server-side fixes needed)
- [x] B1 — Socket transport error after showdown; hand 2 never starts.
- [x] B2 — `EasyStrategy` (and likely `MediumStrategy`, `HardStrategy`) calls instead
           of checking post-flop.
- [x] B3 — Missing `desk:getSeats` socket event handler.

### Frontend (frontend developer to fix)
- [ ] B4 — Double slash in lobby URL: `/api//lobby/games`. Trailing slash in base URL
           constant concatenated with leading slash in path.
- [ ] B5 — Oscillating amounts display (0 ↔ actual values every render). Two parallel
           state sources conflicting — local `playerActions` tracker resetting
           independently from socket-driven desk state.

### Backend — second pass
- [x] B6 — Stale bot seats persist after practice session ends.
- [x] B7 — Bot strategy produces flat, uninteresting gameplay.

### Backend — third pass
- [x] B8 — B6 eviction races with frontend events; desk never closes after showdown.
           (Superseded — root cause: `$pull` by ObjectId is unreliable without persistent
           bot records. Re-implemented via dedicated `Bot` model in task 1.16.)

### Backend — fourth pass
- [x] B10 — B8 `$pull` fails silently — bots not stored in DB so no reliable way to
           identify bot seat userId values for `$pull`. Fixed via `Bot` model
           (task 1.16): `addBotToSeat` creates a `Bot` record; bots persist across
           hands and are evicted (via `evictBotsIfNoHumans`) only when no human
           seat remains, at which point `Bot.deleteMany({ deskId })` runs.

### Frontend (frontend developer to fix)
- [ ] B4 — Double slash in lobby URL.
- [ ] B5 — Oscillating amounts display.
- [ ] B9 — Frontend emits `practice (auto-restart)` immediately after `game:showdown`.
           Correct flow: wait for `desk:closed`, then `desks/best` + `practice` on new desk.

### Backend — fifth pass (pre-7.x audit, 2026-06-11)
- [x] B11 — [medium] Practice hands are archived in `PokerGameArchive` with no
           `mode`/`isPractice` discriminator. Admin dashboard leaderboard and
           per-user `analytics/users/[userId]` totals aggregate ALL archives,
           so bot `<name>_bot` players can appear as "top winners" and
           practice fake-chip swings (±PRACTICE_STARTING_CHIPS/hand) are summed
           and rendered as real ₹. Fix: add `mode` to `PokerGameArchive`
           (mirrors `desk.mode`, same pattern as existing `currency`/`gameType`
           copy in `showdown()` — Level 2, surgical), filter analytics
           aggregates to `mode: 'cash'`.
- [x] B12 — [medium] `POST /api/admin/pokerDesks` sets `isPractice` from the
           request body independently of the inherited `PokerMode.mode`
           (CONTRACTS.md:82 says `isPractice` is the sole practice gate, used
           by `addUserToSeat` to decide free chips vs wallet debit). An admin
           can create an `isPractice: true` desk under a `mode: 'cash'`
           PokerMode → free-chip seating on a desk labeled/archived as cash.
           Fix: derive `isPractice` from `pokerMode.mode === 'practice'`
           instead of trusting the body. Also fixes CONTRACTS.md drift
           (POST body entry omits `isPractice`).
- [x] B13 — [low] `src/server.ts:178` — bot turn-timer uses
           `runtime.botSeats.get(userId)!`. After `evictBotsIfNoHumans` clears
           `botSeats` and deletes the runtime, a pending 1.5s bot timer can
           fire with `userId` no longer in the map; the `!` masks `undefined`
           and the surrounding try/catch swallows the resulting error. Fix:
           explicit null-check + early return.
- [x] B14 — [low] `GET /api/admin/analytics/users/[userId]` returns 200 with
           aggregated (possibly empty) stats for ANY valid ObjectId, including
           bot synthetic ids — unlike `admin/users/[userId]` which 404s when no
           `User` exists. Fix: verify `User.findById(userId)` first, mirroring
           the users-detail route.
- [x] B15 — [low] Two error-code issues in `src/lib/api/errors.ts` /
           `src/app/api/lobby/desks/best/route.ts`: (1) missing `modeId` query
           param throws `MISSING_BANK_FIELD` (a bank-domain code) on a
           poker-lobby endpoint; (2) `RAZORPAY_NOT_CONFIGURED` has no entry in
           `statusForCode` and falls through to default 500 (functionally fine,
           but undocumented). Fix: dedicated code for the lobby case; either
           map `RAZORPAY_NOT_CONFIGURED` explicitly or document the default.

---

## PHASE 7 — Integration & Verification

This phase is where the full system gets exercised end-to-end. Tier 1 (engine+service)
was task 1.8; Tier 2 (backend HTTP/socket) was task 5.6; Tier 3 below is the real
mobile-app-to-backend pass — the final pre-launch gate.

- [ ] 7.1  **Tier-3 E2E: admin flow.** Admin login via the rebuilt login page → land on
           `/admin/overview` → navigate to each section (users, transactions, games, statistics)
           → manage poker/modes/desks → confirm data appears. Manual walk-through.
- [ ] 7.2  **Tier-3 E2E: user flow.** Mobile app Google sign-in → username onboarding (if new) →
           wallet → deposit via Razorpay → lobby → join desk → play hand → see history.
           Real mobile app against real backend.
- [ ] 7.3  **Tier-3 E2E: live gameplay.** Two real users at the same desk play a full hand to
           showdown; practice mode: one user vs bots, full hand to showdown. Both paths verify
           archive correctness.
- [ ] 7.4  Final type-check + build; confirm no frozen-core regressions
- [ ] 7.5  (Deferred) Vitest money-math suite — revisit before trusting live-mode money

---

## Open decisions / parking lot

- [ ] Blind/stake semantics documented in lobby (settled: SB=stake, BB=2×stake, ante=stake)
- [ ] `walletTransaction` collection name after model rename — confirm `wallettransactions`
- [x] Bot identity representation at runtime — DECIDED: synthetic `Types.ObjectId` generated
      in-process by `botService.addBotToSeat`; no DB user record, no wallet. Practice desks
      flag via `isPractice`; `addBotToSeat` sets `balanceAtTable = PRACTICE_STARTING_CHIPS`
      directly via atomic `$push`. See LOGS.md 2026-06-07.
- [ ] Deployment topology for next(3000) + socket(3001) — revisit before going live
- [ ] **Commission on leave** (Phase 3/4) — per-session percentage on NET PROFIT only, deducted in
      `userLeavesSeat`. Player buys 100, leaves with 162 → commission on the 62 profit. Buys 100,
      leaves ≤100 → no commission. Admin-configurable per-stake (add `commissionRate` to PokerMode).
      Audit trail via new `commissions` collection (probably). Management confirmed 2026-06-01.
- [x] **Mid-hand-leave chip handling** — DECIDED: Option A. Hand continues; committed bets (in
      `game.rounds[].actions`) stay in the pot; only `seat.balanceAtTable` (uncommitted stack) is
      returned to wallet immediately. Turn advances clockwise by seatNumber to next active player.
      Note: the Phase 1 code had the chip behavior correct but the turn-advancement wrong (array
      order instead of clockwise) — fixed as part of this decision. See LOGS.md 2026-06-04.
- [ ] **Future v2 — restore Stud, Razz, Five-Card Draw to `PokerGameType`.** Major-version work, NOT
      a phase of this rebuild. Design needed: (a) first-actor rules per game (card-based bring-in for
      Stud/Razz, blinds-or-antes for 5-Draw), (b) bring-in semantics, (c) per-street acting-order logic.
      `bType` field and `'antes'` engine branch are preserved as forward-compatible dead code so the
      re-introduction doesn't require schema-level migration. Re-enable in the `PokerGameType` union
      LAST, after engine support is proven by per-variant smoke tests. See LOGS.md 2026-06-01 for
      full reasoning and the 5-Card Draw blinds-vs-antes ambiguity that needs deciding then.

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