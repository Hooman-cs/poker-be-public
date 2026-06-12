# LOGS.md — Decision and milestone log

A narrative history of *why* the system is the way it is. Append-only.
Newest entries at the top.

Two kinds of entries:
- **PHASE** — written at phase boundaries, summarizing what happened.
- **EVENT** — written when a meaningful decision is made or a notable
  bug/lesson is found. Short. The point is durability, not exhaustiveness.

**Tags worth grepping:**
- `[INVARIANT]` — a rule downstream phases MUST respect. Violating one
  causes integration bugs by definition.
- `[OVERRIDE]` — a deliberate override of an earlier decision (with reason).
- `[LESSON]` — a discipline lesson worth not repeating.

This file complements CONTRACTS.md (the precise interface catalog) and
TASKS.md (the live task tracker). When in doubt about what a piece of code
is supposed to do, CONTRACTS.md is the answer. When in doubt about *why*
it was built that way, LOGS.md is.

---

## 2026-06-10 — TASK 6.9 — Currency rendering + status dropdown audit — PASS (no code changes)

[INVARIANT] All admin status controls were verified against actual model enums:
Poker (active/maintenance/disabled), PokerMode (active/disabled), PokerDesk
(active/disabled — 'closed' correctly excluded as engine-only), User
(active/inactive/suspended), BankTransaction (pending/completed/failed),
GatewayTransaction (created/pending/completed/failed). All match exactly.

[INVARIANT] No `formatMoney` helper exists or is needed. Per the existing
money invariant, every API response serializes money fields to formatted
strings at the API edge (CONTRACTS.md: amount/stake/minBuyIn/maxBuyIn/balance/
totalWinnings/lockedBonus/netChange/totalPot all typed `string`). Every
admin component built in 6.2–6.8 renders these strings directly with zero
client-side arithmetic on the display path. The only client-side money math
is input-side (ModeCreateForm stake/buy-ins, UserBalanceControl amount),
converting major units → minor units ×100 before POST — correct by design.

**PHASE 6 COMPLETE.** All tasks 6.1–6.9 verified PASS.

---

Created `DeskCreateForm` + `DeskRowActions` (status select restricted to active/disabled — 'closed' is engine-only and never offered) and three server pages: desk list (with create form + row actions), read-only desk detail (config + live status, optional back-link via `?modeId=`), and game list (static gameType filter tabs, paginated, winners derived from `players.filter(isWinner)`). TypeScript compiled cleanly.

---

Created `PokerCreateForm` + `PokerRowActions` (collapsible form / two-step delete / status edit for game types) and `ModeCreateForm` + `ModeRowActions` (same pattern, money inputs in major units ×100 before POST). Both server pages use `fetchAdmin` with parallel fetches where needed. TypeScript compiled cleanly.

---

Created `TransactionsFilters` (status + type selects, immediate push), `BankTransactionActions` (renders null unless pending; separate approve/reject loading state; PATCH on click; router.refresh on success), `PgTransactionsFilters` (status only), bank transactions page (table with type/status badges, actions column, URL pagination preserving filters), and PG transactions page (gateway tx table, capitalised gateway, truncated order IDs). TypeScript compiled cleanly.

---

Created `fetchAdmin` shared helper (cookie-forwarded, `cache: 'no-store'`, redirects on 401). Built three pages (statistics, users list, user detail) plus `UsersFilters`, `UserStatusControl`, and `UserBalanceControl` client components. User detail page uses `Promise.all` for three parallel fetches and embeds `LatestGameHistory` and `UserBankTransactionsHistory` widgets. TypeScript compiled cleanly.

---

Created four files. Login page posts to `/api/admin/auth/login`, stores httpOnly `token` cookie on success, redirects to `/admin/overview`. Admin layout wraps Sidebar + content column. Overview page fetches dashboard data server-side (cookie-forwarded, `revalidate=300`) and renders all 7 widgets. Also appended `NEXT_PUBLIC_BASE_URL` to `.env.local`.

[LESSON] Claude Code generated `position:fixed` on the Sidebar (`fixed left-0 top-0`), which pulled it out of the flex flow — the content column started at x=0, fully overlapping the sidebar. Always specify sidebar positioning explicitly in the prompt: `sticky top-0 h-screen flex-shrink-0` (stays in flex flow, pins to top on scroll). Never leave positioning unspecified for layout-critical components.

---

Extended `src/types/adminTypes.ts` with `PaginationInfo`, `UserGameEntry`, and `UserBankTransaction` — shapes verified against CONTRACTS.md 4.14 and 4.6. Created two server-component widgets with compact tables, badge helpers for type/status/result, ID truncation, duration formatting, and empty states. TypeScript compiled cleanly.

---

Created `src/types/adminTypes.ts` with `DashboardData` interface matching the dashboard API contract. Created 7 server-component widgets under `src/components/admin/widgets/` — all purely presentational, props-only, no fetch calls, no mock data. TypeScript compiled cleanly.

---

Created three shared admin UI components. Sidebar uses `usePathname` for active detection with combined `border-l-2 border-indigo-400 bg-white/[0.08]` active style and `border-l-2 border-transparent` inactive base — all items carry the `border-l-2` default so spacing is consistent. Header is a server component with `{ title, subtitle? }` props. SearchInput wraps a controlled input with an absolute-positioned `Search` icon from lucide-react. TypeScript compiled cleanly.

[LESSON] lucide-react was NOT in `package.json` despite the prompt stating it was already installed. Claude Code added it silently. Before writing any prompt that claims a package is already installed, grep `package.json` directly. One read prevents unintended dependency additions.

---

Created `scripts/wipeDb.ts`: calls `.deleteMany({})` on all 12 operational collections (User, Wallet, WalletTransaction, BankAccount, BankTransaction, GatewayTransaction, Poker, PokerMode, PokerDesk, PokerGameArchive, PracticeSession, Admin), prints deleted count per collection, prints next-step instructions. AppConfig intentionally excluded so admin-configurable rates survive a wipe. Updated `scripts/seedLobby.ts`: added a third PokerMode (`mode: 'practice'`, `stake: 10000`) and a PokerDesk (`isPractice: true`, `tableName: 'Practice Table 1'`, `minToStart: 3`, `maxSeats: 6`) after the two existing cash desks. TypeScript compiled cleanly.

---

## 2026-06-09 — TASK 5.6-patch — tier2Smoke.ts hole-card race + leaveViaSocket observer — PASS

Fixed two test-script bugs in `scripts/tier2Smoke.ts` (not server bugs). Bug A: sequential `socket.once` calls missed targeted `game:start` events already in flight — patched with `waitForHoleCards` helper using `socket.on` with payload-shape discrimination (`data.holeCards` present), pre-registered synchronously before any `await`. Bug B: `leaveViaSocket` awaited `player:left` on the leaver's own socket, which never receives it (server calls `socket.leave(deskId)` before the broadcast) — patched with `observerSocket` parameter; both between-hand call sites pass the first active non-leaver socket. Final run: all checks passed (HTTP, socket auth rejection, 5-hand lifecycle, hole-card delivery, money conservation, archive correctness). Phase 5 carry-forward items now fully closed.

---

Created idempotent seed script. Idempotency keyed on `Poker.description = "Lobby Seed — Texas Hold'em"` (not `gameType`, which has a unique index). Created one Poker + two PokerModes (Low Stakes stake=10000, High Stakes stake=50000) + one PokerDesk per mode. Second run confirmed idempotent. Two schema discoveries: `Poker` and `PokerMode` have no `name` field; PokerMode uses `description` for labels. `minToStart`/`minToContinue` schema floor is 3 (not 2 as originally spec'd in the task).

Frontend issue found during integration: `GET /api/lobby/games` returns `{ message, games: [...] }` but the user frontend was reading `response.pokerData` (old API key). Fix is frontend-only — change to `response.games`. Response shape documented in `docs/USER_API_CHANGES.md`.

---

## 2026-06-10 — BUG B8 — atomic $pull bot eviction — PASS

Replaced the per-bot `userLeavesSeat` loop in `handleNeedsShowdown` with a single `PokerDesk.findByIdAndUpdate({ $pull: { seats: { userId: { $in: botObjIds } } } }, { new: true })`. All bot seats removed atomically in one DB write — no lock needed, no per-bot race conditions. `runtime.botSeats.clear()` runs regardless of DB result. After the pull, if `updatedDesk.seats.length < updatedDesk.minToContinue`, the desk is marked closed, saved, `player:left` broadcast fires, `desk:closed` emitted, `deskRuntime.delete(deskId)` called, function returns early without calling `scheduleAutoStart`. TypeScript compiled cleanly; playOneHand and playLifecycle both passed.

[INVARIANT] Bot seat eviction in `handleNeedsShowdown` MUST use a single atomic `$pull` operation, not a per-bot `userLeavesSeat` loop. The per-bot loop is vulnerable to races from concurrent socket events arriving between `await` calls.

---

## 2026-06-10 — BUGS FOUND (third pass) — B8 B6-race + B9 frontend flow

B8: The B6 per-bot `userLeavesSeat` loop in `handleNeedsShowdown` races against the frontend's immediate `practice (auto-restart)` and `leave` events. These events arrive at the server between `await userLeavesSeat` calls, interfering with the eviction. All 5 catch blocks swallow failures silently. The desk never closes; bots remain seated; `desks/best` returns the same stale desk. Fix: replace the loop with a single atomic `PokerDesk.findByIdAndUpdate($pull)` removing all bot seats, then close desk directly if seats drop below `minToContinue`.

B9: Frontend emits `practice (auto-restart)` immediately after `game:showdown` on the same desk. `addUserToSeat` fails (human still seated), frontend panics and emits `leave` twice, disconnects. Correct flow: do nothing after `game:showdown` — wait for `desk:closed`, then call `desks/best` for a fresh desk and emit `practice`. Frontend developer fix.

---

## 2026-06-09 — BUGS B6+B7 — stale bot seats + AdaptiveStrategy — PASS

B6: Added bot eviction loop in `handleNeedsShowdown` (after `game:showdown` broadcast, before `scheduleAutoStart`). Iterates `runtime.botSeats`, calls `userLeavesSeat` for each, handles desk closure on final eviction. Practice desks are now single-use per session — desk closes gracefully after showdown, user gets a fresh desk from the pool on next `desks/best` call.

B7: Replaced `EasyStrategy`, `MediumStrategy`, `HardStrategy` with a single `AdaptiveStrategy`. Uses pre-flop hole card ranking table (pairs, broadways, suited connectors) and pokersolver post-flop hand evaluation. Decision matrix: raise on strength >= 7.5, call on >= 4.5, check when free, fold to bets on weak hands with 25% bluff-call. 12% global bluff probability. ±1 strength jitter for variance. `getBotStrategy` returns `new AdaptiveStrategy()` for all input values. Minor fix applied directly: `rankOrder` corrected from `'T'` to `'10'` to match `CardRank` type (tens were getting index -1 in pre-flop lookup). All Tier-1 smoke tests passed.

[INVARIANT] Bot strategies must use `'10'` (not `'T'`) in pre-flop rank lookup arrays. `CardRank` in the model uses `'10'` for ten. `pokersolver` post-flop evaluation uses `'T'` (passed via `toPS` conversion) — these are two different notations for two different consumers.

---

## 2026-06-09 — BUGS FOUND (second pass) — B6 stale bots + B7 flat strategy

B6: After `game:showdown`, bot seats persist in the desk document. Next user joining via `practice` event gets a desk full of ghost bots from the dead session. Old bot IDs are not in the new session’s `runtime.botSeats`, so they receive 60s human timers instead of bot routing. Fix: evict all bots from `runtime.botSeats` via `userLeavesSeat` inside `handleNeedsShowdown` after the showdown broadcast. Desk drops below `minToContinue` and closes. Next user gets a fresh desk from the 20-desk pool.

B7: Post-B2 fix, bots now check correctly but still never fold or raise. EasyStrategy is the only strategy being used in practice (frontend sends `strategy: 'easy'`). All three strategies produce flat, uninteresting games. Fix: replace all three strategies with a single `AdaptiveStrategy` using pre-flop hand ranking table + post-flop pokersolver evaluation + 10–15% bluff probability. `getBotStrategy` returns `new AdaptiveStrategy()` for all values.

Additional: bot winner username shows as `"unknown"` in `potResults` (bots have no User document). Frontend should substitute `"Bot N"` using seat number when `username === "unknown"`.

---

## 2026-06-09 — BUGS B1+B2+B3 — scheduleAutoStart / bot callAmount / desk:getSeats — PASS

B1: Wrapped entire `scheduleAutoStart` callback in top-level try/catch. Added broke-bot pre-check before `createGame`: iterates seats with `balanceAtTable === 0` that are in `botSeats`, calls `userLeavesSeat` for each, handles `needsShowdown` and closure correctly. On any error in the callback, emits `desk:closed` and cleans up `deskRuntime` gracefully.

B2: Root cause confirmed — `IPokerGame` has NO dedicated per-round bet field. `game.totalBet` and `player.totalBet` are both cumulative for the entire hand. Correct call amount must be derived from `game.rounds.at(-1).actions`. Added `calcCallAmount(game, player)` helper in `bots/index.ts` that mirrors the engine’s own `calculateCallAmount` function. Applied to all three strategies (Easy, Medium, Hard). Without a dedicated schema field, this derivation from round actions is the correct and only approach.

[INVARIANT] `IPokerGame` has no `currentRoundBet` or equivalent per-round field. Bot strategies (and any other code needing the current outstanding bet) MUST derive it from `game.rounds.at(-1).actions`. Never use `game.totalBet - player.totalBet` for this purpose — that is a cumulative value spanning all rounds.

B3: Added `desk:getSeats` C→S handler. Responds with targeted `desk:seats` event `{ deskId, seats: [{ seatNumber, userId, status }], maxSeats }`. No lock needed (read-only). All three Tier-1 smoke tests passed.

---

## 2026-06-09 — BUGS FOUND — Frontend integration testing (Phase 5 socket layer)

Five bugs found during first real frontend integration test against the live server. Full details in `docs/BUGS.md`. Backend bugs: (B1) socket transport error after showdown caused by unhandled error in `scheduleAutoStart` callback — suspected broke bot trying to post blind; (B2) all three bot strategies use cumulative `game.totalBet` for `callAmount` instead of the current-round field, causing bots to call ₹200 on every post-flop street when they should check; (B3) frontend emits `desk:getSeats` before seat selection but server has no handler for this event. Frontend bugs: (B4) double slash in lobby URL from base URL constant; (B5) oscillating action amounts display from two conflicting state sources. Backend bugs B1-B3 queued for Claude Code fix. Frontend bugs B4-B5 documented for frontend developer.

---

## 2026-06-07 — TASKS 1.14 + 1.15 — wipeGameData.ts + seedPracticeDesks.ts — DONE

Created `scripts/wipeGameData.ts`: partial wipe deleting Poker, PokerMode, PokerDesk, PokerGameArchive, PracticeSession only. Users, wallets, admin accounts, and AppConfig are preserved. Prints deleted count per collection and next-step instructions. Use this instead of `wipeDb.ts` when iterating on lobby/game data without disturbing user accounts.

Created `scripts/seedPracticeDesks.ts`: creates 20 practice desks under one PokerMode (mode: 'practice', stake: ₹100 SB). Idempotent via `PokerMode.description = 'practice-seed-v1'` marker. Upserts the Poker row to avoid unique-index collision with smoke test artifacts. All desks have `isPractice: true`, `minToStart: 3`, `maxSeats: 6`. Prints all 20 deskIds on completion for use in socket `practice` event during frontend testing.

---

## 2026-06-07 — PHASE 5 COMPLETE

All Phase 5 tasks done: socket server (5.1), turn timer + 3-skip (5.2), practice mode foundation including Level 1+2 unlocks (5.3a), bot layer + matchmaking + session tracking (5.3b), practice sessions admin endpoint (5.3c), reconnection + seat-status (5.4), Tier-1 smoke test verification (5.5), Tier-2 smoke test (5.6).

Tier-2 smoke test (tier2Smoke.ts) first run: HTTP endpoint checks passed, socket auth rejection passed, all 5 hand lifecycle phases executed. Two test-script bugs found during verification (not server bugs): (1) hole-card verification race — sequential `socket.once` misses events already fired; patched with `waitForHoleCards` helper using payload-shape discrimination. (2) `leaveViaSocket` waited on leaver’s socket which never receives `player:left`; patched with `observerSocket` parameter. Patch run pending at phase close — carry into Phase 6 start.

Utility tasks 1.12 (`wipeDb.ts`) and 1.13 (seedLobby practice desk) also pending one Claude Code run — carry into Phase 6 start.

---

## 2026-06-07 — TASK 5.6 — scripts/tier2Smoke.ts — PASS (patch pending final run)

Created `scripts/tier2Smoke.ts` — full lifecycle Tier-2 smoke test driving the actual HTTP + socket stack. Script seeds 6 users, mints JWTs directly via `signToken`, verifies `GET /api/lobby/games` and `GET /api/lobby/desks/best` return 200 with data, verifies bad-token rejection (`connect_error: INVALID_TOKEN`), then drives the same 5-phase lifecycle as `playLifecycle.ts` entirely through socket events: `join` → `action` (turn:start-driven) → `leave` → `game:showdown`, including mid-hand leave, force-close, and Hand-6 rejection. Verifies redacted broadcast shape (holeCards: []) on every `game:start` room broadcast, verifies targeted hole-card delivery per player, and checks archive username population + money conservation. TypeScript compiled cleanly.

First run: HTTP checks, socket auth rejection, and all 5 hand phases completed. Two test-script bugs found and patched: (1) hole-card verification race — sequential `socket.once` calls missed targeted `game:start` events that fired before the listener was registered; patched with `waitForHoleCards` helper (uses `socket.on` + payload-shape check on `data.holeCards`), pre-registered synchronously before any `await` across all 5 hands. (2) `leaveViaSocket` waited on the leaver’s own socket, which never receives `player:left` (server calls `socket.leave(deskId)` before the broadcast); patched by adding `observerSocket` parameter to `leaveViaSocket` and updating both between-hand call sites. Final patched run pending — carry into Phase 6 start.

---

## 2026-06-07 — PROCESS — Standing rule: TASKS.md + LOGS.md update on every task change

Standing rule confirmed: TASKS.md and LOGS.md must both be updated whenever a task is added, modified, removed, or split — at the same time the change is made, not after. No exceptions for utility scripts, patches, or sub-tasks. `scripts/seedLobby.ts` (task 1.11) was retroactively added to TASKS.md; it was omitted when the prompt was written.

---

## 2026-06-07 — TASK 5.5 — Tier-1 smoke test verification pass — PASS

All three smoke tests passed cleanly against the post-5.4 codebase: `playOneHand.ts`, `playThreeHands.ts`, `playLifecycle.ts`. No regressions from any Phase 5 work. Service layer + engine verified end-to-end.

---

## 2026-06-07 — TASK 5.4 — Reconnection + seat-status handling — PASS

Extended `disconnect` handler (now async) to fire-and-forget a `PokerDesk.findOneAndUpdate` setting `seats.$.status = 'disconnected'` for the affected desk+userId. Added reconnect path at the top of the `join` handler: if user is already seated, skips `addUserToSeat`, re-joins socket room, updates `userSockets`, resets seat status to `'active'` via `findOneAndUpdate`, reloads desk, broadcasts `player:joined`, re-emits hole cards targeted if game in progress, and restarts turn timer only if it's the reconnecting player's turn and no timer is currently running. Returns early before any normal join flow. TypeScript compiled cleanly.

---

## 2026-06-07 — TASK 5.3c — Practice sessions admin endpoint + isPractice desk creation — PASS

Created `GET /api/admin/practiceSessions` (paginated, admin-only; populates `userId` with `username + email`; `finalChips` serialized via `serializeMoney`, null if session still open). Added `isPractice = body.isPractice === true` to `POST /api/admin/pokerDesks` POST handler — defaults `false` if absent, no other handler changes. TypeScript compiled cleanly.

Note: `serializeDesk` in `pokerDesks/route.ts` does not currently expose `isPractice` in GET responses. If the admin UI needs to display or filter by practice flag, `serializeDesk` needs an additive update (Level 4, safe to do when admin UI is built in Phase 6).

---

## 2026-06-07 — TASK 5.3b — Bot layer + practice session tracking — PASS

Created `src/services/botService.ts` (`addBotToSeat`: synthetic ObjectId, no DB user, no wallet, acquires desk lock internally) and `src/lib/bots/index.ts` (three strategy implementations: Easy — check/call/fold, never raises; Medium — pot-odds-aware, raises at 0.75× pot on a pair; Hard — position-aware, tight early threshold 0.25, loose late threshold 0.35, full-pot raise with pair in late position). Extended `DeskRuntimeState` with `practiceSessions: Map<userId, sessionId>`. Added `closePracticeSession` helper called from `leave` handler and 3-skip eviction path to record `endedAt` and `finalChips`. Added `practice` socket event: seats human via `addUserToSeat`, auto-assigns bot seat numbers, calls `addBotToSeat` per bot, opens `PracticeSession` record. Modified `startTurnTimer` to route bot turns through a 1.5s delayed `handlePlayerAction` (reads full desk from DB for strategy input) instead of the 60s human timer. Cleanup from 5.3a deferred items also completed: ~1100 lines of commented-out dead code removed from `gameService.ts`, ~133 lines from `pokerMode.ts`, `PRACTICE_STARTING_STACK_MINOR` deleted from `constants.ts`. All Tier-1 smoke tests passed after cleanup and after full implementation.

Decision: practice history endpoint (originally `GET /api/user/games/practice-history`) changed to admin-only (`GET /api/admin/practiceSessions`). User-facing practice history deferred to future v2.

---

## 2026-06-07 — TASK 5.3a — Practice mode foundation — PASS

Added `isPractice: Boolean` to `PokerDesk` schema and `PRACTICE_STARTING_CHIPS = 100000` to `constants.ts`. Practice branches added to `addUserToSeat` (gated on `!desk.isPractice`: skips wallet check and deduction, always sets `balanceAtTable = PRACTICE_STARTING_CHIPS`) and `userLeavesSeat` (skips wallet refund on practice desks, returns `finalChips: number | null` — non-null for practice, null for cash). New `PracticeSession` model created with compound index `{ userId: 1, startedAt: -1 }`. All three Tier-1 smoke tests passed. TypeScript compiled cleanly.

Two cleanup items deferred to 5.3b: (1) `PRACTICE_STARTING_STACK_MINOR` already existed in `constants.ts` before this task — Claude Code added `PRACTICE_STARTING_CHIPS = 100000` alongside it as a duplicate (both equal 100000). `PRACTICE_STARTING_STACK_MINOR` should be removed and all references updated to `PRACTICE_STARTING_CHIPS`. (2) ~600 lines of commented-out old `gameService.ts` code remain at the bottom of the file — inert but should be deleted.

[INVARIANT] `desk.isPractice` is the ONLY permitted gate for practice-mode branching in `gameService.ts`. Never check `isCashMode(desk.mode)` for the seat/wallet branching in `addUserToSeat` or `userLeavesSeat` — those functions now use `!desk.isPractice` exclusively.

---

## 2026-06-07 — DECISION — Level 1+2 unlock for practice mode (task 5.3a)

Practice mode requires genuine changes to frozen files with documented justification. Changes approved:

**Level 1 — `src/models/pokerDesk.ts`:** Add `isPractice: { type: Boolean, default: false }` field. Justification: practice desks need to be distinguishable from cash desks at the DB level so that `addUserToSeat`, `userLeavesSeat`, and the socket server can all branch correctly without passing flags at call sites. A runtime-only flag would require threading an extra parameter through every gameService call.

**Level 1 — `src/config/constants.ts`:** Add `PRACTICE_STARTING_CHIPS = 100000` (in minor units = ₹1000.00). Justification: a single source of truth for the practice buy-in used by `addUserToSeat` and any future practice-related UI. One line addition.

**Level 2 — `src/services/gameService.ts`:** Two function modifications:
- `addUserToSeat`: if `desk.isPractice`, skip wallet balance check and wallet deduction; set `seat.balanceAtTable = PRACTICE_STARTING_CHIPS` directly.
- `userLeavesSeat`: if `desk.isPractice`, skip wallet refund; include `finalChips: seat.balanceAtTable` in the return value alongside the existing fields.

No changes to engine files. No changes to pot/showdown logic. Existing cash-mode paths are entirely unaffected — the `isPractice` branch is additive only.

[INVARIANT] `isPractice` is the sole gate for all practice-mode branching. Never check `isCashMode` or any other derived flag — `desk.isPractice` is the canonical field.

[INVARIANT] `PRACTICE_STARTING_CHIPS` from `src/config/constants.ts` is the only permitted source of the practice buy-in amount. Never hardcode 100000 or 1000 inline.

[INVARIANT] `userLeavesSeat` on a practice desk MUST return `finalChips` in its result object. The socket server uses this to close the `PracticeSession` record. If `finalChips` is missing, sessions will never be closed.

[INVARIANT] Tier-1 smoke tests (`scripts/playOneHand.ts`, `scripts/playThreeHands.ts`, `scripts/playLifecycle.ts`) MUST all pass after 5.3a before any further Phase 5 work begins.

---

## 2026-06-07 — TASK 5.2 — Turn timer + 3-skip eviction (src/server.ts) — PASS

Added `startTurnTimer(deskId, userId)` helper to `server.ts`. Emits targeted `turn:start { deadline }` then sets a 60s `setTimeout`. On expiry: skip counter incremented BEFORE the fold call (so the eviction check at >= 3 sees the updated count), `handlePlayerAction({ action: 'fold' })` called, `turn:timeout` room broadcast emitted. Two paths: eviction (skip >= 3 → `userLeavesSeat`, same closure/showdown handling as the `leave` handler) and normal (fold result broadcast, next player timer started). `InvalidStateError` from a racing timer is silently discarded. `turnTimerUserId` field added to `DeskRuntimeState` to enable conditional timer clearing in the `leave` handler. Added `PokerDesk.findById` read on failed action to restart timer for the correct player.

Bug found in verification: two paths were missing a `startTurnTimer` call after `player:left` — (1) voluntary `leave` when leaver held the turn timer, (2) 3-skip eviction path. Fixed in a patch pass. Guard used: `if (nextTurn && rt && !rt.turnTimer)` ensures timer is only started when cleared (leaver was current turn player), not restarted when another player's timer is already running.

[INVARIANT] After ANY `player:left` broadcast — voluntary leave or 3-skip eviction — the server MUST check `currentGame?.currentTurnPlayer` and call `startTurnTimer` if no timer is currently running. Failing to do this stalls the game silently.

---

## 2026-06-07 — TASK 5.1 — src/server.ts + src/types/socketTypes.ts — PASS

Created standalone Socket.io server on port 3001 and socket event payload types. Auth middleware reads JWT from `socket.handshake.auth.token`, attaches `userId`/`role` to `socket.data`. Six helpers implemented: `redactDesk` (strips holeCards via `.toObject()` before any room emit), `broadcastDeskState`, `targetedEmit`, `getOrCreateRuntime`, `scheduleAutoStart`, `handleNeedsShowdown`, `handleAllInRunout`. All three C→S events (`join`, `action`, `leave`) call the appropriate gameService function and handle `needsShowdown` and all-in runout. Auto-start threshold correctly uses `desk.minToContinue` for warm desks and `desk.minToStart` for cold. `disconnect` removes from `userSockets` only — no `userLeavesSeat` call. TypeScript compiled cleanly.

One design note for Phase 7: the targeted hole-card emit after `game:start` reuses the `game:start` event name with payload `{ holeCards }` rather than a distinct event. The mobile app receives `game:start` twice — once with `{ desk }` (room broadcast) and once with `{ holeCards }` (targeted). Client must distinguish by payload shape. Worth flagging in USER_API_CHANGES.md before Phase 7.

---

## 2026-06-07 — DECISION — Phase 5 socket protocol gaps resolved

Three gaps in the Phase 2 socket design were identified and resolved before task 5.1 begins.
(1) **Seating via socket `join` event:** Phase 3 has no REST sit-down endpoint; seating is handled by a new C→S `join` event `{ deskId, seatNumber, buyInAmount }` which calls `gameService.addUserToSeat`. The Phase 2 event table omitted this C→S event. (2) **Hole card privacy:** the Phase 2 "full state on every event" rule conflicts with card secrecy. Resolution: all room broadcasts use a redacted payload (holeCards stripped from every player). `game:start` additionally emits a targeted `{ holeCards }` to each seated player's socket via the `userSockets` map. (3) **Error event:** a targeted `error` S→C event `{ code, message }` handles failed actions and failed joins without crashing the connection. `DeskRuntimeState` gains a `userSockets: Map<string, string>` field (userId → socketId) to support all targeted emits.

[INVARIANT] Room broadcasts NEVER include hole cards. `holeCards` is stripped from all player entries before any `io.to(deskId).emit(...)` call. Targeted hole-card delivery is the only permitted path.

[INVARIANT] `DeskRuntimeState.userSockets` is the sole source of truth for userId→socketId mapping. Updated on `join` (add) and on socket `disconnect` (remove). Never derived on-the-fly.

[INVARIANT] The C→S `join` event is the seating mechanism for the socket layer. There is no REST endpoint for sitting at a desk — if one is added in a future phase, the socket `join` handler must guard against double-seating via the existing `AlreadySeatedError` from `addUserToSeat`.

---


Created AppConfig singleton read/update endpoint. GET returns findOne lean with hardcoded defaults if null. PATCH uses `'key' in body` for field presence detection (cleaner than !== undefined — catches explicit nulls), validates manually before findOneAndUpdate (pre-save hooks don’t fire on findOneAndUpdate), upsert: true to create on first write. Empty body returns current config without writing. `serializeConfig` helper deduplicates GET and PATCH response. Plain numbers throughout — no serializeMoney. Phase 4 complete: all 15 tasks verified.

---

## 2026-06-05 — TASK 4.14 — GET /api/admin/analytics/users/[userId] — PASS

Created per-user analytics endpoint. ObjectId validated before dbConnect. Three parallel queries: double-match aggregate ($match → $unwind → $match → $group) for lifetime stats, countDocuments for pagination total, and paginated find sorted by completedAt desc. Stats null when no games exist. winRate computed as percentage string. Per-game player record found via players.find(); isWinner and netChange use optional chaining with ?? 0 fallback. 32 requirements verified line-by-line.

---

## 2026-06-05 — TASK 4.13 — GET /api/admin/analytics/games — PASS

Created paginated PokerGameArchive list. Filters: deskId, pokerModeId, gameType (validated against full 5-value enum), from/to (completedAt range, silently ignored if date string is invalid). Promise.all for count + find. Per-game response includes durationSeconds (Math.round formula), and per-player netChange (endingStack - startingStack) serialized via serializeMoney — negative for net losers. All 17 requirements verified line-by-line against the generated source.

---

## 2026-06-05 — TASK 4.12 — GET /api/admin/analytics/dashboard — PASS

Created the admin dashboard analytics endpoint. All 11 queries run concurrently via 5 outer Promise.all groups. User stats (5 countDocuments), bank transaction stats (3 countDocuments), game stats (2 countDocuments + 1 aggregate), recent users (top 5 by createdAt), and a leaderboard (PokerGameArchive $unwind + $group aggregation, sorted by net winnings). Minor deviation: the `gamesPlayed` field was omitted from the leaderboard aggregate and response — not a functional issue since per-game counts are available from 4.13.

---

## 2026-06-05 — TASK 4.11 — GET/POST /api/admin/pokerDesks + PUT/DELETE /api/admin/pokerDesks/[id] — PASS

Created two route files for full PokerDesk CRUD. POST inherits all money and game config (gameType, bType, stake, minBuyIn, maxBuyIn, currency, mode) from the parent PokerMode, with cross-field validation (maxPlayerCount >= minToStart, minToContinue <= minToStart) done before dbConnect for cleaner errors. PUT always loads the current doc to compute effective merged values for the same cross-field checks since pre-save hooks don’t run with findByIdAndUpdate; status ‘closed’ is engine-only and excluded from admin-settable values. DELETE guards against seated players and in-progress games. One minor note: PUT doesn’t sync maxSeats when maxPlayerCount is updated — not a functional bug since the lobby query (3.10) uses maxPlayerCount only.

---

## 2026-06-05 — TASK 4.10 — GET/POST /api/admin/pokerModes + PUT/DELETE /api/admin/pokerModes/[id] — PASS

Created two route files for full PokerMode CRUD. POST inherits gameType from the parent Poker document (via pokerId lookup) and explicitly derives and passes bType — mandatory per the Phase 1 invariant that the required-bType validator fires before the auto-set pre-save hook. PUT loads the current document whenever any money field is present, using it both for currency context (parseAmount) and cross-field min/max validation when only one of the two is updated. DELETE uses `PokerDesk.exists({ pokerModeId: id })` for cascade protection, which also confirmed the PokerDesk foreign key field is `pokerModeId`.

---

## 2026-06-05 — TASK 4.9 — GET/POST /api/admin/poker + PUT/DELETE /api/admin/poker/[id] — PASS

Created two route files providing full CRUD for the Poker taxonomy. GET returns all entries (max 2 ever) sorted by gameType with no pagination. POST validates gameType against the v1 enum, creates the document, and catches MongoServerError 11000 (duplicate unique index) for a clean 400 response. PUT updates only description/objective/status — gameType is silently ignored, preserving the unique identifier PokerModes reference. DELETE runs a cascade check via `PokerMode.exists({ pokerId: id })` before hard-deleting; confirmed that the PokerMode foreign key field is `pokerId`.

---

## 2026-06-05 — TASK 4.8 — GET /api/admin/gatewayTransaction — PASS

Created the paginated gateway transaction list endpoint. Filters: status, gateway, userId (all optional, silently ignored if invalid). Uses `Promise.all` for count + find. Claude Code improved on the spec by adding `.select('-gatewaySignature')` at the query level rather than just omitting the field from the mapping — the signature is never fetched from the DB, which is the correct defence-in-depth approach for a verification secret.

---

## 2026-06-05 — TASK 4.6 — GET /api/admin/bankTransactions — PASS

Created paginated bank transaction list with `.populate('bankAccountId').lean()`. Filters: status, type, userId (all silently ignored if invalid). Populated bank account extracted into a nested `bankAccount` object; null if the account was deleted. Minor note: countDocuments and find run sequentially rather than via `Promise.all` — acceptable for this low-frequency admin endpoint.

---

## 2026-06-05 — TASK 4.5 — POST /api/admin/users/[userId]/balance — PASS

Created admin lockedBonus adjustment endpoint. Body: `{ bonusAmount: number }` (positive adds, negative removes; manual validation, not parseAmount). Uses a Mongo session wrapping `Wallet.$inc` and `WalletTransaction.create`. Claude Code improved on the spec by moving the floor check inside the session rather than before it — prevents the race condition where two concurrent removals both pass an external check but together drive the balance negative. `try/finally` guarantees `session.endSession()`.

---

## 2026-06-05 — TASK 4.4 — PATCH /api/admin/users/[userId]/status — PASS

Created admin user status update endpoint. Validates ObjectId before `dbConnect()`. Body `status` validated against the enum; invalid values return 400 INVALID_STATE. Uses `findByIdAndUpdate` with `{ new: true, runValidators: true }` so Mongoose enum validation fires at the DB level. Returns the updated user fields. Used `AuthError('NOT_FOUND')` correctly (not ServiceError).

---

## 2026-06-05 — TASK 4.2 — GET /api/admin/users — PASS

Created paginated user list with wallet balance enrichment. Filters: search (username/email regex, escaped), status (optional). Wallet join uses a single `Wallet.find({ userId: { $in: [...] } })` then a `Map` for O(1) per-user lookup — same pattern as Phase 3.9 lobby. `.lean()` on both queries. User input is regex-escaped before passing to MongoDB.

---

## 2026-06-05 — TASK 4.7 — PATCH /api/admin/bankTransactions/[transactionId]/status — PASS

Created the bank transaction approve/reject endpoint. Four-case 2×2 matrix (deposit×completed, deposit×failed, withdraw×completed, withdraw×failed) with GST split on deposit approvals and balance deduction on withdrawal approvals. All money writes are in a Mongo session; the double-processing guard fires before any session opens; withdrawal balance check runs inside the session to prevent concurrent over-debit. Implementation also added `bankTransactionId` as an audit field on WalletTransaction records — TypeScript compiled clean, meaning the schema supports it.

---

## 2026-06-05 — TASK 4.3 — GET /api/admin/users/[userId] — PASS

Created admin user detail endpoint. Returns full user profile + wallet (serialized balances) + bank accounts list, fetched via three parallel `.lean()` queries (`User.findById`, `Wallet.findOne`, `BankAccount.find`). Validates ObjectId before `dbConnect()` to save a round-trip on garbage input. Claude Code included `authProviders`, `lastLogin`, and `deviceType` in the user object (additional fields beyond the spec) — fine for an admin view, since admins benefit from seeing which providers are linked and when the user last logged in. Game history and bank transaction history are NOT included — those live in 4.6 and 4.14 respectively. One implementation issue surfaced (ServiceError used instead of AuthError) — captured in the LESSON entry that follows.

---

## 2026-06-05 — LESSON — Admin routes should throw AuthError for not-found checks, not ServiceError

Phase 4.3 used `ServiceError('NOT_FOUND', ...)` for the "user not found" check. Both AuthError and ServiceError route through `statusForCode` and produce a 404, so this is functionally correct. However, ServiceError requires importing from `@/services/gameService`, creating an unnecessary coupling between an admin user-detail route and the game service. Admin routes that need a NOT_FOUND response should throw `new AuthError('NOT_FOUND', ...)` instead — AuthError is already imported from `@/lib/api/errors` in every route.

[INVARIANT] Admin routes use `AuthError('NOT_FOUND', ...)` for their own not-found checks (user not found, transaction not found, etc.). `ServiceError` is for errors propagated FROM the game service, not for route-level guard checks.

---

## 2026-06-05 — TASK 4.1 — POST /api/admin/auth/login — PASS

Created `src/app/api/admin/auth/login/route.ts`. Email lookup + bcrypt + status gate + lastLogin update + 6h JWT in httpOnly cookie `token`. During implementation, `ADMIN_NOT_ACTIVE` was found to have been placed in `AUTH_CODES` (→ 401) rather than the switch case. Corrected to 403 — when an admin is authenticated (valid JWT) but deactivated, 403 Forbidden is the correct semantic (401 means "not authenticated"). `requireAdmin` also throws this code, so its behaviour changes from 401 to 403 on inactive-admin revocation. `CONTRACTS.md` requireAdmin entry updated to document per-code statuses. No downstream phase depends on this code yet.

[INVARIANT] `ADMIN_NOT_ACTIVE` → HTTP 403. Valid JWT + disabled account = Forbidden, not Unauthorized. Do not move it back to AUTH_CODES.

---

## 2026-06-05 — EVENT — LOGS.md ownership transferred to Claude Desktop

Previously Claude Code maintained LOGS.md. Transferred to Claude Desktop because most entries capture design decisions made in the conversation layer, not implementation discoveries. Claude Code still surfaces discoveries via HANDOFF.md open questions; Claude Desktop writes the LOGS.md entry after verifying. Claude Code no longer writes to LOGS.md.

[INVARIANT] Claude Code reads LOGS.md but does not edit it. Claude Desktop is the sole author.

---

## 2026-06-05 — LESSON — `.lean<T>()` required for Mongoose `timestamps: true` fields in TypeScript

When querying a model that uses `timestamps: true`, Mongoose adds `createdAt` and `updatedAt` at runtime but these fields are absent from the declared TypeScript interface. Accessing them on a regular query result produces a TS error. Fix: use `.lean<ModelInterface & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date }>()` to get a plain object with the correct type. Found in Phase 3.4 (`walletTransaction` query).

[INVARIANT] Any route querying a `timestamps: true` model and accessing `createdAt`/`updatedAt` must use `.lean<T>()` with an augmented type. Never cast to `any` as a workaround.

---

## 2026-06-05 — DECISION — Switched token verification from google-auth-library to Firebase Admin SDK

Frontend uses Firebase for Google Sign-In and sends Firebase ID tokens (`user.getIdToken()`). These are issued by `securetoken.google.com/{project}` and cannot be verified by `google-auth-library`'s `OAuth2Client` which expects tokens from `accounts.google.com`. Switched `googleVerify.ts` to `firebase-admin` `auth().verifyIdToken()`. The `uid` field from the decoded Firebase token is stored as `authProviders.providerId` — this is Firebase's own UID for the user, not the Google OAuth `sub` claim. Since no users exist in production yet, no migration needed.

[INVARIANT] `authProviders.providerId` for Google-authenticated users stores the Firebase UID (`decoded.uid`), not the Google OAuth `sub` claim. These are different values. Do not mix them.

[INVARIANT] The frontend must send `await user.getIdToken()` as the `idToken` field — not `user.uid`, `user.refreshToken`, or any other Firebase property. Firebase ID tokens are JWTs beginning with `eyJ`; anything else will fail decoding before verification.

---

## 2026-06-05 — BUG — POST /api/auth/google allows 'inactive' users to log in

Phase 3.13 verification found that the auth route only checks `status === 'suspended'` and rejects with 403. The LOGS.md invariant (2026-06-05) states both `'inactive'` and `'suspended'` must be rejected. The Phase 3.1 HANDOFF raised this as an open question; the answer was given in conversation but never applied to the code. Fixed in 3.13-patch: condition changed to `status !== 'active'`.

[INVARIANT] Only `status === 'active'` users receive a JWT. Any other status (`'inactive'`, `'suspended'`) is rejected with 403. The check must be `status !== 'active'`, not `status === 'suspended'`.

---

## 2026-06-05 — TASK 3.13 — Contract verification pass — PASS (1 bug found, fixed)

Read all 14 user-facing route files against USER_API_CHANGES.md. All routes clean except one bug (inactive login, see above). No OTP routes anywhere under src/app/api/. The Razorpay order `amount` raw integer is a documented exception per CONTRACTS.md invariant.

---

## 2026-06-05 — TASK 3.11 — GET /api/user/games/history — PASS

Built `src/app/api/lobby/desks/best/route.ts`. Validates `modeId` with `isValid()` before `findById` (prevents CastError 500). Uses `$expr: { $lt: [{ $size: '$seats' }, '$maxPlayerCount'] }` to find desks with open seats. Sorted `{ seats: -1 }` (fullest non-full desk first). Returns `{ desk: null }` with HTTP 200 when no desk available — valid state, not an error. Money fields from the PokerMode document (not the desk), as PokerDesk's denormalized stake fields could theoretically diverge.

---

## 2026-06-05 — TASK 3.9 — GET /api/lobby/games — PASS

Built `src/app/api/lobby/games/route.ts`. Three sequential `.lean()` queries (Poker → PokerMode → PokerDesk) filtered to `status: 'active'` at each level. Results assembled via Maps keyed by `_id.toString()` for O(1) lookup during nesting. All money fields serialized; `bigBlind` computed as `stake × 2` inline. No phantom fields — all response fields verified against model interfaces.

---

## 2026-06-05 — TASK 3.8b — AppConfig model + verify route instantBonus — PASS

Created `src/models/appConfig.ts` as a singleton document. Fields: `gstMultiplier` (default 1.28, min 1) and `depositBonusRate` (default 1.0, range 0–1). Updated Razorpay verify route: loads config with hardcoded fallbacks so the route functions without a config document. Wallet `$inc` now increments both `balance` (creditAmount) and `instantBonus` (bonusAmount = gstAmount × depositBonusRate) in the same Mongo transaction. WalletTransaction amount sub-document updated to include the bonus. CONTRACTS.md stale invariants corrected.

---

## 2026-06-05 — TASK 3.8 patch — HMAC timingSafeEqual — PASS

Replaced `===` string comparison with `crypto.timingSafeEqual` in the Razorpay verify route. Note: a malformed signature with wrong byte length causes timingSafeEqual to throw TypeError (caught as 500 rather than 400) — acceptable since real Razorpay never sends that.

---

## 2026-06-05 — TASK 3.8 — POST /api/payments/razorpay/verify — PASS

Built `src/app/api/payments/razorpay/verify/route.ts`. HMAC-SHA256 verification runs before any DB read. GST split uses `GST_MULTIPLIER` from `constants.ts` (1.28 — 28% on base, correct Indian online gaming rate; task spec of 18% was wrong). All three writes (wallet `$inc`, `WalletTransaction.create`, `GatewayTransaction` status update) execute in one Mongo session. Double-credit guard rejects if `status !== 'created'`. New error codes: `INVALID_PAYMENT_SIGNATURE` (400), `PAYMENT_ALREADY_PROCESSED` (400), `FORBIDDEN` (403). `instantBonus` credit intentionally deferred to 3.8b (AppConfig).

[INVARIANT] GST_MULTIPLIER = 1.28 is the correct rate for Indian online gaming (28% on base value). The task spec of 18% was incorrect. Always use the constant from `constants.ts`, never hardcode a rate.

---

## 2026-06-05 — TASK 3.7 — POST /api/payments/razorpay/order — PASS

Built `src/app/api/payments/razorpay/order/route.ts`. Creates a Razorpay order via the SDK then records a `GatewayTransaction` with `status: 'created'` and the returned `gatewayOrderId`. Module-level Razorpay instance (initialized once). Response returns `{ orderId, amount, currency, keyId }` where `amount` is a raw minor-unit integer — deliberate exception to the outbound-formatted-string convention because the Razorpay checkout SDK is a machine consumer that requires an integer.

[INVARIANT] Razorpay order response `amount` is a raw integer (paise), NOT a formatted string. This is the only endpoint permitted to return a raw money integer outbound. All other money fields remain formatted strings.

---

## 2026-06-05 — TASK 3.6 — GET + POST /api/user/banks/transactions — PASS

Built `src/app/api/user/banks/transactions/route.ts`. GET returns paginated bank transactions (newest-first, limit capped at 50) with `amount` serialized. POST accepts multipart formData for both deposit and withdraw types. Deposit validates image presence, checks file size against `MAX_FILE_SIZE`, creates the `UPLOAD_DIR` directory if absent, and saves the file with a timestamp-prefixed filename. Withdraw checks that wallet balance covers the requested amount but does NOT deduct — the transaction is created as `status: 'pending'` for admin approval in Phase 4. `bankAccountId` ownership and active status verified before creating either type. New error codes: `INVALID_BANK_ACCOUNT` (404), `MISSING_IMAGE` (400), `INSUFFICIENT_BALANCE` (400).

---

## 2026-06-05 — TASK 3.5 — GET + POST /api/user/banks — PASS

Built `src/app/api/user/banks/route.ts`. GET returns all bank accounts for the user sorted newest-first. POST validates required fields, checks the 5-account limit at the route level (giving a clean `BANK_LIMIT_REACHED` 400), sets `isDefault: true` for the first account, then delegates to `BankAccount.create`. The model's pre-save hook also enforces the limit but surfaces as an untyped 500 without the route-level check — both layers retained deliberately. New error codes: `BANK_LIMIT_REACHED` (400), `MISSING_BANK_FIELD` (400).

---

## 2026-06-05 — TASK 3.4 — GET /api/user/wallet/transactions — PASS

Built `src/app/api/user/wallet/transactions/route.ts`. Paginated (page/limit, limit capped at 50), sorted newest-first. All seven amount sub-fields serialized: `cashAmount`, `instantBonus`, `lockedBonus`, `gst`, `tds`, `otherDeductions`, `total`. TypeScript issue: `createdAt` from `timestamps: true` is absent from the declared interface — resolved with `.lean<ITransaction & { _id: Types.ObjectId; createdAt: Date }>()`. This pattern is now the standard for any route accessing timestamp fields.

---

## 2026-06-05 — TASK 3.3 — GET /api/user/wallet — PASS

Built `src/app/api/user/wallet/route.ts`. Returns all three balance fields serialized via `serializeMoney`. Field names confirmed against schema: `balance`, `instantBonus`, `lockedBonus`, `currency` — all present, all schema-defaulted to 0. No fallback values needed. Clean first pass.

---

## 2026-06-05 — TASK 3.2 — GET /api/user/username/suggestions + PATCH /api/user/username — PASS

Built two routes in `src/app/api/user/username/`. GET loops `generateGamerName()` with case-insensitive `User.exists` checks, collecting at least 3 available suggestions (max 60 attempts). PATCH validates, checks `usernameLocked` (409), does case-insensitive uniqueness check excluding the current user, saves with `usernameLocked: true`. User input in PATCH is regex-escaped before the MongoDB query — `generateGamerName` output does not need escaping (always alphanumeric). New error codes: `USERNAME_LOCKED` (409), `USERNAME_TAKEN` (409), `MISSING_USERNAME` (400).

---

## 2026-06-05 — EVENT — Phase 3.1 schema discoveries: three field/type corrections

Three assumptions in the task instructions turned out to be wrong when Claude Code read the actual schemas:

1. **`authProviders.providerId` not `providerUserId`.** The User model stores the Google user ID as `providerId`. Any future auth routes must use this field name.
2. **WalletTransaction type `'bonus'` not `'signupBonus'`.** The `TransactionType` enum has no `'signupBonus'` value. Valid types are `'deposit' | 'withdraw' | 'deskIn' | 'deskWithdraw' | 'bonus' | 'pgDeposit'`. Signup bonus is recorded as `type: 'bonus', remark: 'signupBonus'`.
3. **`'inactive'` also rejected at login.** `UserStatus` is `'active' | 'inactive' | 'suspended'`. Only `'active'` users receive a JWT — `'inactive'` and `'suspended'` both return 403. This is consistent with `requireAdmin` which also rejects any non-`'active'` status.

[INVARIANT] `authProviders.providerId` is the correct field name for the Google user ID on the User model. Do not use `providerUserId`.

[INVARIANT] Signup bonus wallet transaction: `{ type: 'bonus', remark: 'signupBonus' }`. There is no `'signupBonus'` enum value.

[INVARIANT] Only `status === 'active'` users receive a JWT at login. `'inactive'` and `'suspended'` are both rejected with 403.

---

## 2026-06-04 — EVENT — Level 2 unlock: turn-pointer clockwise fix + Option A chip-handling decision

**Level 2 unlock — `gameService.ts`, `userLeavesSeat` only.**

**Bug fixed:** when the leaving player was `currentTurnPlayer`, the code advanced the turn with `game.players.find(p => p.status === 'active')`. This searches by array-insertion order, not seat order, so the next actor depends on who joined first — not who sits next clockwise. Fixed by sorting `desk.seats` by `seatNumber`, finding the leaver's index, then scanning forward (wrapping around) for the first seat whose player has `status === 'active'`.

**Option A confirmed (committed bets stay in pot):** `refundAmount = seat.balanceAtTable` is the uncommitted stack only — chips the player has at the table but NOT yet committed to the current betting round. Committed bets live in `game.rounds[].actions` and stay in the pot regardless of whether the player leaves mid-hand. This is the explicit design choice; do not change `refundAmount` to include committed bets.

[INVARIANT] Turn advancement in `userLeavesSeat` walks `desk.seats` sorted by `seatNumber` clockwise from the leaver's position. Never use array-find-first as a substitute for clockwise walk.

[INVARIANT] Committed bets stay in pot on mid-hand leave; only `seat.balanceAtTable` (uncommitted stack) is refunded. This is intentional — the pot belongs to the remaining active players.

---

## 2026-06-01 — DECISION — Desk lifecycle: cold → warm → closed state machine

Implemented a three-state lifecycle for poker desks:

**Cold** (firstGameStartedAt === null): desk has never had a hand. The
`createGame` gate uses the admin-configured `desk.minPlayerCount` (e.g. 4).
This is the "we need N players before cards can be dealt" cold-start rule.

**Warm** (firstGameStartedAt !== null): desk has had at least one hand. The
`createGame` gate relaxes to `WARM_GAME_MIN_PLAYERS` (3 — the schema floor).
This lets the game continue naturally as players leave, down to 3.

**Closed** (desk.status === 'closed'): desk has been force-closed because
the seated player count dropped below 3 (schema minimum). All remaining
seated players are "forced to leave" — their chips return to their wallets
with a `deskWithdraw` audit trail. The desk does not accept new hands or
new seats. An admin (or future feature) can re-open it.

**Transitions:**
- cold → warm: first `createGame` succeeds (sets `firstGameStartedAt`).
- warm → closed: seated count drops below 3 (either after showdown completes
  or between hands when a player leaves voluntarily).
- **No reverse transitions.** A closed desk stays closed. A warm desk does
  not return to cold (no idle-reset in this version — deferred to v2).

**Where the checks run:**
- `createGame`: rejects if desk.status === 'closed'; uses cold/warm gate.
- `addUserToSeat`: rejects if desk.status === 'closed'.
- `showdown` (post-hand): after archive creation, checks seats.length < 3
  → calls forceCloseDesk.
- `userLeavesSeat` (between-hand): if no currentGame AND desk is warm AND
  seats.length < 3 → calls forceCloseDesk.

**Mid-hand leave behavior:** when a player leaves during a hand, the hand
continues (the leaver is auto-folded). If this drops active count to 1,
single-survivor showdown triggers. After the hand completes, the post-
showdown check handles closure if remaining seats < 3.

**No grace period (simplified from initial discussion).** When count drops
below 3, closure is immediate — no 5-minute wait, no pending-closure state.
Simplifies the state machine significantly. Grace period deferred to v2 if
product requires it.

[INVARIANT] The schema floor of 3 is the engine's hard limit. Below 3,
heads-up acting-order rules would be needed (which the engine doesn't
implement). The desk lifecycle enforces this: warm desks close rather than
attempting to play with 2 players.

[INVARIANT] `forceCloseDesk` is the single function that handles closure.
It returns chips, clears seats, sets status. Called from two sites (post-
showdown and between-hand leave). Must be called within an existing
withDeskLock scope — does NOT acquire the lock itself.

**Schema changes (Level 3, pokerDesk.ts):**
- `firstGameStartedAt: Date | null` (default null).
- `'closed'` added to DeskStatus enum.

**Service changes (Level 2, gameService.ts):**
- `WARM_GAME_MIN_PLAYERS = 3` constant.
- `forceCloseDesk(desk)` helper.
- `createGame`: closed-desk rejection + cold/warm gate + set firstGameStartedAt.
- `addUserToSeat`: closed-desk rejection.
- `showdown`: post-hand closure check.
- `userLeavesSeat`: between-hand closure check.

---

## 2026-06-01 — PHASE 1 CLOSED

All Phase 1 tasks complete (1.1 through 1.10, with 1.7b and 1.9b inserted). Frozen core verified end-to-end:

- `playOneHand.ts` — 9/9 checks. 3-player Hold'em, money conservation, archive correctness.
- `playThreeHands.ts` — 14/14 checks. Button rotation across consecutive hands.
- `playLifecycle.ts` — all checks. Full lifecycle: cold-start → warm play → mid-hand leave → warm-floor play → force-closure → reject-after-close.

**Six frozen-core bugs found and fixed in Phase 1:**
- 3 from Phase 0 audit (already documented).
- Spread on Mongoose subdoc → NaN in player update (gameService).
- Round-closure counted folded players' bets (gameEngine).
- Post-flop first-actor used seat-arrival order instead of button-relative (gameEngine).

**Phase 1 features delivered:**
- Button rotation (buttonSeatNumber field; rotation in createGame; SB/BB/UTG derivation in engine).
- PokerGameType narrowed to Hold'em + Omaha (Stud/Razz/5-Draw → FUTURE_V2.md).
- Two-threshold model: minToStart + minToContinue (schema floor 3).
- Cold/warm desk state via firstGameStartedAt.
- Force-closure on warm-game count below minToContinue; 'closed' status; forceCloseDesk helper.

**Doc state at phase close:**
- TASKS.md — Phase 1 all done; Phase 2 untouched.
- KEEP.md — 5-level system, Phase 1 outputs categorized at Levels 4/5.
- CONTRACTS.md — every callable in Phases 0+1 has full entry.
- LOGS.md — complete decision history.
- USER_API_CHANGES.md — auth + money-format-on-wire.
- ARCHITECTURE.md — folder structure + conventions.
- FUTURE_V2.md — deferred items with source pointers.
- CLAUDE.md — updated this turn for chat handoff.

**Phase 2 starts in a new chat** (conversation length forcing the switch). Next-chat-me reads CLAUDE.md, TASKS.md, then any Phase-2-relevant section.

[INVARIANT] All three Tier-1 smoke tests must continue to pass for any future Level 2 change.

---

## 2026-06-01 — EVENT — Task 1.10 prep: minPlayerCount renamed, two-threshold model, closure implemented

- `desk.minPlayerCount` renamed to `desk.minToStart` across schema, service, engine. New sibling field `desk.minToContinue` (schema default 3, floor 3). Cold-start gate uses `minToStart`; warm-game gate uses `minToContinue`. Pre-save validator enforces `minToContinue <= minToStart`.
- `'closed'` value in `DeskStatus` enum. `firstGameStartedAt` field for cold/warm discriminator.
- `forceCloseDesk(desk)` helper: returns all seated players' chips to wallets via `'deskWithdraw'` audit rows, sets `desk.status = 'closed'`, clears seats. Called from `showdown` and `userLeavesSeat` when count drops below `minToContinue`.
- v1 closes immediately (no grace period). The grace-period pattern from the PDF is captured in FUTURE_V2.md for later.
- Mid-hand collapse below `minToContinue` deferred (existing single-survivor `<= 1` handles the worst case; FUTURE_V2.md tracks the gap).
- Archive directory: `SPEC.md` and `REBUILD_PLAN_V2.md` no longer relevant — should be deleted from repo (user is removing).

[INVARIANT] `minToStart` is admin-configurable; `minToContinue` defaults to 3 and admin can match it to `minToStart` if they want strict-pause semantics. Pre-save guarantees `minToContinue <= minToStart`.

[INVARIANT] Closed desks reject `createGame` and `addUserToSeat`. `userLeavesSeat` still works (to drain any seats left after force-close, defensive).

---

## 2026-06-01 — EVENT — Three-hand smoke test passes 14/14 — button rotation verified end-to-end

`scripts/playThreeHands.ts` passes all 14 checks. The test plays the same
role-based action pattern three times on the same desk and verifies:
- Button advances seat 1 → 2 → 3 across consecutive hands.
- SB role moves through all three players (full clockwise rotation).
- Each hand produces a distinct archive with exactly one winner.
- Cumulative money conservation holds across all three hands.

Role-based plan execution worked first try — `buildRoleMap` reads
currentTurnPlayer (set to UTG by createGame) and the engine's `role`
field on each player to resolve UTG/SB/BB at the start of each hand.

Rotation observed in the test output:
- Hand 1: UTG=Alice, SB=Bob, BB=Carol
- Hand 2: UTG=Bob, SB=Carol, BB=Alice
- Hand 3: UTG=Carol, SB=Alice, BB=Bob

[INVARIANT] Button rotation behavior is verified at the engine + service
+ persistence layer. Any future change to `createGame`'s button-advancement
logic, `initializeGameState`'s SB/BB derivation, or `advanceRound`'s
post-flop first-actor selection MUST keep `playThreeHands.ts` passing.

---

## 2026-06-01 — EVENT — Task 1.9b: post-flop first-actor made button-relative

While planning the multi-hand smoke test, noticed that `getFirstActivePlayer`
returns the first active player by seat-arrival order — which only happens
to be correct when seat 1 = SB. With button rotation, after the first hand
SB moves to seat 2, then seat 3, etc., and array-index-0 is no longer the
right post-flop first-actor.

**This was a latent bug.** The single-hand smoke test passed for the wrong
reason: hand 1's button = seat 1 means SB = Bob (seat 2), and post-flop
when Alice folded the engine's "first active by arrival order" happened
to skip Alice and land on Bob — which was *coincidentally* the SB. The
test never exercised the case where the SB hadn't folded.

**Fix shipped:**
- `getFirstActivePlayer(seats, players, buttonSeatNumber)` — now walks
  seats clockwise from SB position, returning the first active player.
  Three params instead of one.
- `advanceRound(currentRoundName, players, communityCards, seats, buttonSeatNumber)` —
  two new parameters, passed to `getFirstActivePlayer`.
- `gameService.handlePlayerAction` and `gameService.advanceGameRound` updated
  to pass `desk.seats` and `desk.buttonSeatNumber ?? 1` at every call site.
- `playOneHand.ts` plan updated to reflect the corrected post-flop order
  (Bob, the new SB, acts first post-flop; not Alice).

[INVARIANT] Post-flop first-actor is button-relative, not array-relative.
The function takes `seats` + `buttonSeatNumber` explicitly so no caller
can accidentally use the old "first by arrival order" semantics.

**Lesson for the test methodology:** the single-hand smoke test should have
caught this if it had asserted "engine's currentTurnPlayer matches the
expected SB position post-flop." It didn't — it only checked that the
plan's expected actor matched the engine's actor. When the plan was wrong
in the same direction as the bug, the test passed. **Going forward, smoke
tests should derive expected actors from first principles (button + seat
order) rather than mirroring whatever the engine produces.**

---

## 2026-06-01 — EVENT — Task 1.9 complete: button rotation + game-type narrowing landed

Changes shipped:
- `poker.ts` — `PokerGameType` narrowed to `"Texas Hold'em" | 'Omaha'`; enum on schema matches.
- `pokerMode.ts` — schema enum narrowed; `ANTES_GAMES` retained as `string[]` (forward-compatible dead code).
- `pokerDesk.ts` — `buttonSeatNumber: number | null` field added; gameType enum narrowed; `minPlayerCount` min bumped from 2 to 3 (heads-up not supported per the rotation design).
- `gameEngine.ts` — `initializeGameState` takes `buttonSeatNumber` parameter; SB/BB/UTG derived from clockwise advance over seat numbers; antes branch preserved as forward-compatible dead code; `HOLE_CARDS_BY_GAME` trimmed to just Omaha (Stud entry removed).
- `gameService.ts` — `createGame` computes next button (first hand = lowest eligible seat; subsequent = next clockwise) and persists to `desk.buttonSeatNumber`.
- `handEvaluator.ts` — `switch (gameType as string)` cast preserves Stud / Razz / 5-Draw dead-code branches without TypeScript errors.
- `playOneHand.ts` — action plan updated for new rotation (Alice = UTG, Bob = SB, Carol = BB in seat-1-button case).

Tier-1 smoke test passes 9/9 with the new logic. Money conservation holds.
Carol wins by single-survivor short-circuit. Archive is well-formed.

[INVARIANT] The narrowed `PokerGameType` is enforced at both the TypeScript
union level AND the Mongoose enum level. Re-introducing a removed game type
requires editing BOTH places, not just one.

[INVARIANT] `gameType as string` casts in `handEvaluator.ts` are deliberate.
They unlock the dead-code Stud/Razz/5-Draw branches for v2 restoration
without TypeScript yelling. Don't "fix" them.

Next: task 1.10 — the four additional smoke tests (4-player, 6-player,
multi-hand, leave-effects).

---

## 2026-06-01 — DECISION — Narrow PokerGameType to Hold'em + Omaha; implement button rotation for blinds games

While planning the multi-hand smoke test (verifying that blinds rotate
across hands), an audit of the engine surfaced two coupled issues:

1. **No button rotation exists.** SB is hardcoded to `players[0]`, BB to
   `players[1]`, UTG to `players[2]`. Same players have the same blinds
   forever. The engine has no `buttonPosition` field anywhere.
2. **The engine flattens five game-types into two rotation rules.** Even
   if we add button rotation for blinds games (Hold'em, Omaha), the
   antes games (Stud, Razz, Five-Card Draw) have fundamentally different
   first-actor logic — card-based (lowest/highest up-card brings in,
   best showing acts later) rather than position-based. The current
   engine uses `players[0]` for antes too, which would produce playable
   but mechanically incorrect Stud/Razz/5-Draw games.

**Decisions:**

- **Narrow `PokerGameType`** to `"Texas Hold'em" | 'Omaha'` for this
  rebuild. The other three game types come back in a future major
  version of the application (a planned v2-level expansion, NOT a
  later phase of this rebuild). Removing them at the type level prevents
  the bug surface where an admin creates a Razz game type that plays
  with Hold'em-style rules.

- **Implement button rotation now** as a Level 2 unlock to `gameEngine.ts`
  and `gameService.ts`, plus a Level 3 schema field on `pokerDesk.ts`.
  Hold'em and Omaha share identical rotation rules (button + blinds
  position-relative), so one implementation covers both.

- **Keep `bType` field and the `'antes'` engine branch in place** as
  forward-compatible dead code. Removing them is more work and would
  have to be re-added when the other three games return. The branch
  becomes unreachable code that future readers understand from the
  surrounding comments and from this log entry.

**Scope of the implementation (task 1.9 in TASKS.md):**
- Add `buttonPosition` field to PokerDesk (or to embedded currentGame —
  to be decided in the design turn).
- `initializeGameState` accepts the button position; derives SB/BB/UTG
  from it instead of using hardcoded indices.
- `createGame` advances the button between hands (skips empty seats
  on rotation; heads-up special case where button = SB).
- New smoke tests: 4-player single hand, 6-player single hand,
  multi-hand sequence proving blinds rotated.

**Acceptance:** the multi-hand smoke test shows different players
holding the SB role across consecutive hands. 4-player and 6-player
single-hand tests both pass without regression.

[INVARIANT] Button position is the canonical reference. SB, BB, and
UTG are all derived from it. The legacy `players[0] = SB` convention
is removed and must not be reintroduced.

[INVARIANT] For the duration of this rebuild, only Hold'em and Omaha
are valid `PokerGameType` values. Adding a new variant requires both
a type union edit (Level 3) AND engine support for the variant's
first-actor rules (Level 2).

**Five-Card Draw ambiguity logged for the future:** In casino play,
5-Card Draw is conventionally a *blinds* game, not antes. The current
engine puts it under `ANTES_GAMES` for reasons that aren't documented —
probably inherited from the original codebase. When 5-Card Draw comes
back in v2, the first design question is: blinds or antes? This is
not a load-bearing decision today (we're removing it), but worth
noting so the future re-introduction doesn't blindly copy the current
(possibly wrong) placement.

[PARKING LOT] Restoring Stud, Razz, Five-Card Draw — major-version
work, NOT a phase of this rebuild. When undertaken, design needed:
(a) first-actor rules per game (card-based for Stud/Razz, blinds
or antes for 5-Draw), (b) bring-in semantics for Stud/Razz,
(c) per-street acting-order logic. Re-enable in PokerGameType union
last, after engine support is proven by per-variant smoke tests.

---

## 2026-06-01 — DECISION — KEEP.md restructured into 5 levels of "frozen-ness"

Previously KEEP.md had one coarse "Foundation Keep" bucket — every file
had identical "off-limits, ask first" status. In practice some files are
categorically more dangerous to touch than others (changing money helpers
in `constants.ts` ripples everywhere; adding a field to `walletTransaction`
is mundane). The single bucket made the discipline harder than necessary.

New structure: 5 levels, with explicit unlock semantics per level.

- **Level 1 — Architectural Bedrock** (constants, user, wallet, jwt). Touching
  requires explicit cross-project re-justification.
- **Level 2 — Core Logic** (engine + service). Surgical fixes allowed with
  documented reason + Tier-1 smoke test pass.
- **Level 3 — Data Models** (non-bedrock schemas). Additive changes are normal;
  breaking changes need a migration plan.
- **Level 4 — Boundary Helpers** (auth guards, API helpers, types, middleware).
  Normal review. Most edits are additive — new error codes, new helpers.
- **Level 5 — Operational Scripts** (CLI tools). Free to edit; no runtime
  dependents.

App shell and Next.js root config are explicitly NOT leveled — they're
plumbing, not domain. `useSocket.ts` is held aside until Phase 5 (re-evaluated
when the socket layer is rebuilt).

[INVARIANT] A file's level answers "what does it take to make a change here?",
not "how important is it?" All five levels are important; they differ in
process cost. The Phase 1 engine fixes (which followed this discipline before
the labels existed — documented reason in LOGS.md, smoke test proved
correctness) are the working model for Level 2 unlocks.

[INVARIANT] Promotion of a file UP a level (e.g. Level 3 → Level 2) is itself
a deliberate event. If a Level 3 model starts carrying logic the engine
depends on, that's a signal to promote it. Don't leave files under-protected.

---

## 2026-06-01 — PHASE 1 complete

All 9 Phase 1 tasks done (1.1 through 1.8). Tier-1 smoke test passes all
9 verification checks end-to-end: archive shape, usernames non-empty,
single winner Carol, money conservation (₹15000 wallets + ₹15000 seats =
₹30000 total preserved through 12 steps), pot sums match, desk state
clean post-showdown.

**Two real frozen-core bugs found and fixed during Phase 1** (both in code
nominally frozen at 0.18):
1. `gameService.handlePlayerAction` — passed Mongoose subdocument to the
   pure engine, which spreads it (`{ ...player }`) and gets Mongoose
   internals instead of data fields. Fixed by constructing a plain
   `IGamePlayer` object at the boundary.
2. `gameEngine.determineRoundProgression` — round-closure check counted
   folded players' historical bets in the "are all bets equal" calculation,
   so any flop with a fold-after-check sequence could never close. Fixed
   by filtering `round.actions` to only count contributions from players
   still required to match (active + all-in).

Both bugs slipped through Phase 0's audit because the audit ran the engine
through straight-line happy paths only — no mixed check/raise/fold flop,
no Mongoose-doc service handoff. Tier-1 caught both within a few iterations.
This is exactly the value the smoke test was added for.

**Phase 1 outputs promoted to KEEP.md (Foundation Keep, 2026-06-01 section):**
- `src/types/pokerModelTypes.ts`
- `src/lib/auth/requireUser.ts`
- `src/lib/auth/requireAdmin.ts`
- `src/lib/api/money.ts`
- `src/lib/api/errors.ts`
- `src/middleware.ts`
- `scripts/createAdmin.ts`
- `scripts/changeAdminPassword.ts`
- `scripts/playOneHand.ts`

**Engine + service `gameEngine.ts` and `gameService.ts` are now at their
post-fix revisions** (the versions that pass Tier-1). The Foundation Keep
entries for both files refer to those revisions, not the as-of-0.18 versions.

[INVARIANT] Tier-1 smoke test must continue to pass for any future change
to the frozen core. The Phase 5 task 5.6 (Tier-2 HTTP/socket test) will
build on this foundation; Phase 7 Tier-3 closes the loop with real mobile app.

[INVARIANT] Two boundary disciplines emerged from Phase 1 debugging and are
recorded in CONTRACTS.md and the inline comments:
1. Service↔engine boundary: every value passed into engine functions must
   be a plain object, not a Mongoose document or subdocument.
2. Round-closure logic considers only players still required to match
   (active + all-in). Folded players' historical bets are excluded.

Phase 2 (Application Design) begins next — much of it already settled
through Phase 0 + 1 decisions; the rest is folder/naming/edge-case
finalization before Phase 3 (User API) starts coding routes.

---

## 2026-06-01 — EVENT — Tier-1 smoke test found a SECOND frozen-core bug: round-closure ignores fold semantics

While debugging the smoke test past the previous toObject() fix, found a real
bug in `gameEngine.determineRoundProgression`. The round-closure check builds
a per-player total of bets from `round.actions` and concludes "round closed"
only if all unique totals are equal. Two problems:

1. **Folded players' actions are still counted.** Alice checks (amount 0)
   then folds (amount 0). Her total is 0. Later Bob/Carol bet 600 each. The
   round can never close because `uniqueBets = {0, 600}` — Alice's stuck 0
   keeps it from being a single value.
2. The check uses `round.actions` for ALL action-takers, including ones who
   are no longer required to match (folded). Folded players don't owe
   anything; their per-round contribution is irrelevant to "is the round
   closed."

**Symptom:** In the 3-handed smoke test, after Bob calls Carol's flop raise
and Alice has already folded, the engine thinks the flop is still open and
asks Carol to act again — which is wrong (Carol already raised; Bob has
matched; round should close and advance to turn).

**Fix:** filter `round.actions` to only include actions from players who are
still active (or all-in) when computing closure totals. Folded players are
excluded. One change in `determineRoundProgression`.

[INVARIANT] Round closure considers only players who are still required to
match — active or all-in. Folded players' historical bets in the round do
not participate in the "are all totals equal" check.

**The bigger lesson (reinforcing):** Phase 0's audit ran the engine through
straight-line happy paths. Folds-during-betting weren't exercised. Tier-1
smoke test caught the gap on its second meaningful try. This is the SECOND
frozen-core bug found by Tier-1; the first was the toObject() spread issue.
At this rate, Tier-1 has earned its place in the codebase several times over.

---

## 2026-06-01 — FINDING — Engine has no BB option (BB posting counts as the BB's pre-flop action)

While debugging the Tier-1 smoke test, discovered that `determineRoundProgression`
treats the BB's blind-posting as their pre-flop action. Once all live players
have matching totalBets, the round closes — the big blind does NOT get a
separate "check/raise option" after callers match.

Concretely (3-handed Hold'em, blinds 1/2):
- Pre-flop opens with UTG (Carol). Carol calls ₹2.
- SB (Alice) calls ₹2 (adding ₹1 to her ₹1 SB).
- Bob (BB) already has ₹2 in. All three totalBets = ₹2, unique bets = {200}.
- `determineRoundProgression` returns `nextRound` immediately — Bob never
  gets to act.

This is acceptable behavior for the smoke test (and possibly for the product),
but it does differ from strict poker rules where the BB gets a check-or-raise
option. Two angles:

1. **Code-correctness:** `determineRoundProgression` is logically consistent.
   `actionPlayerIds` includes everyone who appears in `round.actions`, and
   `'big-blind'` actions are inserted into `round.actions` by `initializeGameState`.
   So Bob "has acted" from the round-progression view.

2. **Poker-strict correctness:** strict rules say the BB acts last pre-flop
   and may raise even if everyone calls. This engine doesn't model that.

**Action items / decision needed:**
- Phase 7 Tier-3 testing should consciously decide whether this behavior is
  acceptable for launch.
- If we want BB option, fix is non-trivial: need to track "BB has option to act"
  as a separate flag, or exclude blind-postings from `actionPlayerIds`. Possibly
  a Phase 8 polish item.
- For now, the smoke test's action plan is adjusted to match the engine's
  actual behavior (no Bob action pre-flop).

[INVARIANT] The Tier-1 smoke test plays the hand the engine wants to play,
not poker-strict rules. Tier 3 verification may surface this difference as
a real product concern.

---

## 2026-06-01 — EVENT — Tier-1 smoke test found a real bug in frozen-core (5th audit miss)

Phase 1 task 1.8 (Tier-1 smoke test) caught a real bug in `gameService.ts`,
which was supposedly frozen at end of Phase 0. The bug:

```typescript
// gameService.ts line ~740 (BEFORE)
const result = processPlayerAction(
  player,                    // <-- Mongoose subdocument
  seat.balanceAtTable,
  ...
);
```

The engine internally does `let updatedPlayer = { ...player }`. Spreading a
Mongoose subdocument does NOT produce a plain object with the data fields —
it produces the subdocument's internal Mongoose properties (`$__`, `$isNew`,
etc.) without the fields like `balanceAtTable` and `totalBet`. The engine
then computes `updatedPlayer.balanceAtTable - finalAmount = undefined - n = NaN`,
and Mongoose rightly refuses to save NaN to a Number-typed field.

The bug only manifests when a real Mongoose document reaches the engine.
Phase 0 engine tests (and the audit walkthroughs) used plain object literals
that spread correctly. The integration handoff between service and engine
was the gap.

**Fix:** one-line patch in `gameService.handlePlayerAction`:
```typescript
const result = processPlayerAction(
  player.toObject(),         // <-- plain object, engine's pure-data contract preserved
  ...
);
```

[INVARIANT] The service is the ONLY boundary between Mongoose docs and the
pure engine. Every doc/subdoc passed into engine functions must be a plain
object (`.toObject()`). The engine's signatures say `IGamePlayer`, etc. —
plain interfaces — and the service must honor that contract literally.

**Audit completed:** I checked every other engine call site in gameService
(`initializeGameState`, `determineRoundProgression`, `engineAdvanceRound`,
`calculatePots`) for the same pattern. None of them spread Mongoose subdocs;
they all use property access or explicit field-by-field construction, both
of which work correctly on subdocs. So this was the ONLY instance.

**The bigger lesson:** this is the 5th bug found in "frozen" core (4 caught
in the Phase 0 audit, 1 caught here). The Phase 0 audit lesson said "audit
cross-function handoffs after writing multi-function files" — and this is
exactly such a handoff that the audit missed. Frozen does NOT mean perfect;
it means "stable enough to build on top of." The Tier-1 smoke test exists
precisely to find these handoff bugs, and it did its job on its first
successful run.

**Honest process note:** the path to finding this bug required four iterations
of error messages because each iteration revealed only one missing field at
a time. A full required-field audit at the start of writing the script
would have collapsed those four iterations into one. The discipline:
**for every Model.create() call I write, grep required: on that model and
verify each field is in my call.** ~3 seconds per check, would have prevented
the entire bType / gameType / tableName / bType-again loop.

**Subtle Mongoose footnote:** validation runs BEFORE pre-save hooks. The
PokerMode pre-save hook auto-sets `bType` from `gameType`, but the required
validator fires first and rejects the doc before the hook ever runs. So
even though the model "auto-sets" bType, callers must pass it anyway. This
is documented inline in the smoke test seed comments.

---

## 2026-06-01 — LESSON — Eight bugs in playOneHand.ts from skipping the re-read discipline

Wrote `scripts/playOneHand.ts` (Tier-1 smoke test, ~360 lines) in one sitting
without re-reading the actual model files I was writing against. The user's
TypeScript caught four bugs immediately on first run:

1. Wrong module path (`@/models/pokerModes` vs `pokerMode`)
2. Wrong field name (`userName` vs `username` — a rule I MYSELF documented in
   USER_API_CHANGES.md)
3. Invented service function name (`userJoinsSeat` vs `addUserToSeat`)
4. Wrong archive player field (`netResult` vs `isWinner`)

Four more would have triggered at runtime:

5. PokerMode has no `smallBlind`/`bigBlind` — uses `stake` (BB derived as `stake * 2`)
6. PokerMode has no `name` field
7. PokerDesk has no `deskName` field
8. PokerGameType is the literal string `"Texas Hold'em"`, not `"texas-holdem"`

Plus a structural error: I treated seating and buy-in as two separate operations
(`userJoinsSeat` then `addUserBalanceAtTable`), but `addUserToSeat` takes both
seatNumber and buyInAmount in one call. `addUserBalanceAtTable` is for mid-session
top-ups, a different concept.

[LESSON] The "re-read actual schema/code before writing against it" discipline
established in Phase 0 turn 1 was violated. It's not enough to consult CONTRACTS.md
or rely on memory of "we built this last week" — every new file that imports
from a model or service must be preceded by a grep/view of the actual import
targets. CONTRACTS.md is for fast orientation; source is the truth.

The bugs were caught cheaply (TypeScript + the user's eye), but if the script
had been mostly type-correct with one or two semantic mistakes, they might
have slipped to runtime where the failure mode is murky ("the script does
something wrong but I'm not sure what").

Concrete habit to retain: when writing any file that calls more than 2-3
imported functions, view each callee's signature first. Cost is ~10 seconds
per check; gain is escaping the "8 bugs at once" episode this entry documents.

---

## 2026-06-01 — EVENT — Admin password reset path: separate `changeAdminPassword.ts` script

Phase 1 task 1.7b: added `scripts/changeAdminPassword.ts` as a companion to
the seed script. Looks up an admin by email, confirms identity, prompts for
a new password, saves through the model so bcrypt hashing happens in the
pre-save hook.

**Decision: separate script rather than `--force` on createAdmin.** The seed
script's name promises "create"; if it also deleted/replaced records it
would lie about what it does, and "names that lie cause bugs" is a real
class of failure. The cost of a second file (~170 lines, nearly identical
prompt plumbing) is small; the cost of a multi-purpose admin-mutation tool
that's easy to misuse is larger.

[INVARIANT] Admin password updates ALWAYS go through `admin.save()` after
mutating the password field. Never `findOneAndUpdate` for password — that
skips the pre-save hook and stores plaintext. The script enforces this; any
future admin-edit endpoint must do the same.

[INVARIANT] Neither script provides admin-by-`_id` lookup. Both use email,
which is the unique identity field. If multiple admins ever exist and the
operator typos an email, they get a "not found" error, not the wrong
account — by design.

**Why no recovery endpoint instead of a script:** an admin password reset
endpoint is sensitive — it must require some other auth factor or it's a
takeover vector. Doing it via shell-level access enforces "you must be on
the server" as the authentication, which is appropriate for an admin set
this small. Revisit if/when admins grow beyond a handful.

---

## 2026-06-01 — EVENT — Middleware rewritten; admin landing is `/admin/overview`

Phase 1 task 1.6: `src/middleware.ts` rewritten cleanly. Same auth-gate
behavior, much smaller and clearer. Three substantive changes:

1. **Post-login landing changed to `/admin/overview`** (was `/admin`).
   The intent is a general-purpose summary surface — small windows into
   users, transactions, games, statistics — so the admin gets situational
   awareness on arrival and drills down from there. Deliberately NOT a
   deep page like `/admin/statistics` or `/admin/users`.

2. **Dead `/api/socket` matcher and CORS branch removed.** Sockets run on
   port 3001 via the standalone Socket.io server; Next.js middleware never
   sees those requests. The branch had been there since an earlier abandoned
   attempt at routing sockets through Next.js routes.

3. **All `console.log` statements removed.** Including the verification-failure
   log — expired tokens are normal traffic for any 6-hour-session app, and
   logging them is operational noise. Real auth debugging belongs in a
   proper logger, not middleware.

[INVARIANT] Middleware is the CHEAP auth gate. It only checks "is there a
structurally-valid JWT with userId + role claims." It does NOT verify
`role === 'admin'` strictly, does NOT check the admin's DB status, and
does NOT perform any business logic. The strict gate lives in route-level
`requireAdmin`, which can afford the DB lookup.

[INVARIANT] Phase 6 must create `src/app/admin/overview/page.tsx` (the
landing surface). Until that page exists, the middleware redirect points
to a 404. Recorded so Phase 6 doesn't forget it owes this page.

---

## 2026-06-01 — EVENT — Drift on style rule (divider comments) caught mid-Phase 1

User reminded me that the `// ====...` section-divider comment pattern was
explicitly rejected back in Phase 0 ("stop using these — token waste, no
information value"). I'd reintroduced them in three Phase 1 files
(`pokerModelTypes.ts`, `money.ts`, `errors.ts`) totaling 26 divider lines.

Stripped them in place — section labels (the actual `// Section name` headers
underneath the bars) preserved, only the dashed lines removed.

[LESSON] Style rules from earlier phases are still in effect, even when the
work moves on to new files. The drift wasn't deliberate — it was a default
formatting habit re-asserting itself when the rule wasn't actively in working
memory. The defense is mechanical, not effort-based: when starting a new file,
explicitly recall the style constraints. A reasonable habit to adopt: a
quick mental "what style rules am I working under" check at file start.

This is the kind of small thing the log exists to remember. A rule I forgot
once is a rule I'll forget again unless it's somewhere I'll re-read.

---

## 2026-06-01 — EVENT — Money format on the wire: outbound formatted strings, inbound integers (Option 1)

Phase 1 task 1.4: `src/lib/api/money.ts` written. The boundary between
"integer minor units" (DB/service/engine) and "human-readable money"
(mobile app / admin UI) lives here.

**The decision: outbound money is a formatted display string, inbound
money is an integer in minor units.** Wallet `balance: "₹12.34"` going out;
deposit `amount: 1234` coming in.

The conversation walked through three options:
- Option 1 (string-only outbound): server formats, frontend renders text.
- Option 2 (carry both number AND string): bloat + two sources of truth.
- Option 3 (integer-only outbound): frontend formats itself.

Initial recommendation was Option 3, on the basis that frontends "might
need to do math" later. The user's clarification — **the mobile app never
performs math on money, by architectural policy; if math is needed, it
asks the backend** — flipped the analysis cleanly. Under that constraint,
Option 1's main weakness (frontend re-introducing float bugs via parsing)
disappears entirely, and Option 1's strengths (server is the sole formatter,
audit-friendly, one source of truth) become decisive.

[INVARIANT] Outbound money fields across ALL user-facing endpoints are
formatted display strings. The mobile app never receives raw integer money
amounts and never performs arithmetic on money. If a UI feature needs
computed money (slider ranges, percentages, projected balances), the
backend exposes an endpoint returning the precomputed result.

[INVARIANT] Inbound money values pass through `parseAmount` at the API
edge — strict integer validation, no string coercion, no negatives.
Model float-guards are last-line defense; this is first-line. The asymmetry
(inbound integer, outbound string) is principled: inbound is what the
system records, outbound is what humans look at.

**Contract impact:** USER_API_CHANGES.md updated to reflect the new
outbound shape. Every money field across wallet, banks, payments, lobby,
game-history responses is now `string`. `ApiCaller.js` (mobile app) must
display these as-is without parsing or computing.

**Practice mode footnote:** practice stacks are real integers in real
wallets but are NOT real money. Routes serving practice-mode amounts must
either omit the currency symbol via an alternative response shape, or
clearly indicate "practice" in the surrounding context, so users don't
confuse chips with rupees. The formatter doesn't know the difference —
that discrimination is the route's job. Will be revisited in Phase 3 when
the lobby/practice endpoints are built.

---

## 2026-06-01 — EVENT — Admin auth guard (`requireAdmin`) written; chose DB check on every request

Phase 1 task 1.3: `src/lib/auth/requireAdmin.ts` written. Cookie-based guard
for admin routes, same `AuthError` shape as `requireUser`, six failure codes.
See CONTRACTS.md for the full entry.

**Deliberate choice: DB check on every request (Option A from the discussion).**
The guard calls `Admin.findById(userId)` and rejects if `status !== 'active'`.
Cost is ~1ms per admin request (one indexed read on a tiny collection).
Benefit is immediate revocation when an admin is disabled — they can't
finish using their 6-hour token after being suspended.

The alternative (Option B — trust the token, check status only at login) was
rejected because:
- Admin set is tiny (single-digit), so the cost is genuinely negligible.
- Revoking a disabled admin's session immediately is a real security value.
- The bookkeeping is simpler: status changes take effect immediately, no
  "wait for token expiry" subtlety to document.

[INVARIANT] Token validity is not session validity for admins. Code that
asserts "this admin can act" must go through `requireAdmin`, not check the
JWT alone.

**Same-shape but separate `AuthError` class.** `requireAdmin` and `requireUser`
both declare their own `AuthError`. Promoted to a shared module when
`src/lib/api/errors.ts` is written in task 1.5. For now, two declarations
with identical shape; response mapper should target the `code` field rather
than `instanceof` to be future-proof.

---

## 2026-06-01 — EVENT — User auth guard (`requireUser`) written; stateless tokens, no revocation

Phase 1 task 1.2: `src/lib/auth/requireUser.ts` written. Bearer-token guard
for user-facing routes, throws typed `AuthError` on failure (six codes, all
mapping to 401). See CONTRACTS.md for the full entry.

[INVARIANT] Any JWT issued for user routes MUST include `role: 'user'`
explicitly. `signToken`'s payload type makes role optional, so the
forthcoming `POST /api/auth/google` (task 3.1) is at risk of forgetting it.
Reminder added inline on the 3.1 task.

**Deliberate non-feature: token revocation.** The guard does pure stateless
JWT verification — no store lookup, no IP/device tracking, no revocation
list. A stolen user token remains valid until natural expiry (7 days). If
the product later needs "log out everywhere" or "revoke on suspicious
activity," that's a real feature requiring a token store and is *not*
something to bolt onto this guard. Recorded here so the limitation isn't a
surprise later.

**Deliberate non-feature: rate limiting.** Auth failures don't trigger
throttling at this layer. If brute-force protection is needed later, it
belongs at a middleware or reverse-proxy layer, not in the guard.

---

## 2026-05-29 — PHASE 0 complete

**Built**
- Money: integer minor units (paise/cents) + `currency` tagging on every money-bearing model. `toMinor` / `toMajor` / `formatMoney` helpers in `constants.ts` are the single conversion point.
- Models: wallet, walletTransaction (renamed from Transaction), bankTransaction, gatewayTransaction, bankAccount (verified-keep), pokerMode, pokerGameArchive, pokerDesk (schema-only — methods removed), poker, user (Google authProviders), admin.
- Engine: potCalculator (integer math, sanitizeMath removed), handEvaluator (integer split math), gameEngine (advanceRound helper added, buildArchiveData takes username map).
- Service: `src/services/gameService.ts` — orchestration layer. Per-desk async mutex, Mongo transactions wrap cash-mode wallet writes, separate seat/lifecycle/showdown sections.
- Auth: switched from OTP (India-only) to Google. New `POST /api/auth/google` endpoint planned for Phase 3.
- Username flow: auto-generated on first login, user may change it ONCE during onboarding, then permanently locked (`usernameLocked` flag).
- Concurrency: `async-mutex` per-desk in-memory lock. First dependency installed at point of use.
- Bookkeeping: `KEEP.md`, `CONTRACTS.md`, `LOGS.md` files introduced. `TASKS.md` is the live tracker; `USER_API_CHANGES.md` documents the OTP→Google contract shift.

**Surprises / corrections**
- The slimmed pokerDesk needed a service layer to absorb the methods we removed. We hadn't fully planned for that at the start of Phase 0; we added it as task 0.8b mid-stream. Lesson: when removing a layer, plan where its responsibilities go BEFORE removing it.
- Turn 1 of gameService.ts was written against a wrong assumption about how `desk.mode` is stored (we'd written it as a denormalized string on the desk, but I coded as if it were a populated PokerMode reference). Caught during Turn 2. [LESSON] Always re-read the actual schema file before writing code that consumes it — memory of "what we designed" is not a substitute.
- Audit of the completed gameService.ts found four real bugs (practice-mode buy-in trust, turn-pointer stall on leave, missing showdown trigger on leave, dead imports). All were function-to-function "integration" bugs — each function correct in isolation, incorrect at the handoff. [LESSON] Re-read with cross-function eyes after writing; integration bugs live at handoffs, not inside functions.

**Carried into Phase 1**
- `pokerModelTypes.ts` rebuild — the new clean shared DTO/response types.
- Auth guards (user Bearer, admin cookie).
- Money formatting helper at the API edge.
- Standard response/error helpers (which will consume the service's typed-error → HTTP-status mapping in CONTRACTS.md).
- `middleware.ts` clean in place.
- `scripts/createAdmin.ts` CLI seed — needed before the admin panel can be logged into post-DB-wipe.

**Parking-lot adds (carried forward)**
- `GOOGLE_CLIENT_ID` env var + `google-auth-library` npm install needed at task 3.1.
- Mutex map grows unboundedly with desk count — bounded in practice but worth revisiting if desks are ever ephemeral.
- `desk.seats as unknown as ISeat[]` type cast is ugly — Phase 1's pokerModelTypes should provide a clean helper.
- `handDescription` in archive is empty string — wire pokersolver's description through when prettier broadcasts are wanted.
- Deployment topology for ports 3000 (admin) + 3001 (socket) — revisit before launch.

---

## 2026-05-29 — EVENT — `userLeavesSeat` return shape changed to `{ desk, needsShowdown }`

[INVARIANT] Any future caller of `userLeavesSeat` MUST destructure the return
and follow up with `showdown({ deskId })` if `needsShowdown === true`.
Otherwise the hand sits in limbo.

Why: when a leave drops the table to ≤1 active/all-in player, the hand
should resolve immediately to that player. Original implementation marked the
leaver folded but had no way to signal the survivor's win. Bug surfaced
during the gameService audit; fix added the boolean return.

Documented in CONTRACTS.md (gameService.userLeavesSeat) and in TASKS.md
Phase 5 task 5.1 (where the socket handler will consume it).

---

## 2026-05-29 — EVENT — gameService audit found four bugs

Audit of completed `gameService.ts` (after Turn 3) surfaced four real bugs:

1. **Practice-mode buy-in trust.** The function accepted whatever `buyInAmount` the caller passed in practice mode. A misbehaving or malicious caller could grant themselves an arbitrary practice stack. Fixed by overriding with `PRACTICE_STARTING_STACK_MINOR` unconditionally.
2. **Turn-pointer stall on leave.** `userLeavesSeat` marked the leaver folded but didn't advance `currentTurnPlayer`. If the leaver was the acting player, the game stalled — every subsequent `handlePlayerAction` rejected as "not your turn." Fixed by advancing to next active.
3. **Missing showdown trigger on leave.** A leave that collapsed the table didn't end the hand. Fixed by adding `needsShowdown` to the return shape.
4. **Dead imports.** `calculateCallAmount` and `PokerMode` imported but unused.

[LESSON] Three of four were "integration" bugs — each function correct alone,
incorrect together. The discipline is: after writing a multi-function file,
re-read with the question "what does each function hand to the next, and is
the next happy with it?" This is a different cognitive activity from writing,
and catches a different class of bug.

[LESSON] User-requested audit ("just double check the file") caught bugs I
hadn't caught while writing. Translates to a working principle: ask for
audit at meaningful checkpoints; trust the author less than the reviewer.

---

## 2026-05-29 — EVENT — Per-desk mutex for concurrency (`async-mutex`)

Decided: every desk-mutating service function runs inside `withDeskLock(deskId, fn)`,
backed by an in-memory `Map<deskId, Mutex>`.

Why: the original assumption that "poker is turn-based, so concurrency isn't
a real problem" is mostly right but has gaps — double-clicks, retries,
auto-fold timers firing alongside the action they'd replace, bots colliding
with join/leave operations. All produce concurrent mutations to the same
desk doc with stale views of state. A per-desk mutex eliminates this entire
class.

Chose this over optimistic locking (Mongoose `__v` + retry) because it's
simpler at the call site and our deployment is single-process (port 3001
game server). The trade-off: doesn't span processes. [INVARIANT] If we ever
shard the game server across processes, this lock must move to a distributed
lock (Redis, MongoDB advisory) or desks must be pinned to specific processes
by consistent hashing.

Cost: one dep (`async-mutex`, ~6KB, zero transitive deps). First dep installed
at point of use per the discipline rule.

---

## 2026-05-29 — EVENT — Auth flipped: OTP removed, Google added

[OVERRIDE] Earlier we had treated the user API contract as fully locked.
Boss directive (US + India launch) requires Google login since OTP is
India-only. The auth section of the contract is now superseded by
USER_API_CHANGES.md. Non-auth endpoints in the original contract remain
locked.

Architectural choice: `authProviders: [{ provider, providerId, email, linkedAt }]`
array on User (Option 2), not flat `googleId` field (Option 1). Reasoning:
boss explicitly plans to add more providers (Apple, Facebook) in a future
release. Option 2 means adding a provider later is one enum value + one
endpoint — no model migration. The marginal complexity now buys us a
migration-free future.

[INVARIANT] To re-add OTP later (mobile or Google-OTP) — add a provider
value to `authProviders` + one verify endpoint. DO NOT revive `otp.ts` or
the old OTP routes. The whole point of the authProviders structure is
that auth extensions don't change the user model.

Deps needed at Phase 3 task 3.1: `google-auth-library` (npm) +
`GOOGLE_CLIENT_ID` env (Google Cloud OAuth client).

---

## 2026-05-29 — EVENT — Username flow: set-once-at-registration

Decision: on first login, a unique username is auto-generated. The user
may change it ONCE during onboarding. After confirmation, `usernameLocked`
is set true and the username is permanent.

Why: poker is competitive and social. Leaderboards and game-history make
"who is this player" meaningful, so usernames should be unique handles
(not arbitrary display names). But mid-life renames would be confusing for
historical records, so we lock it at registration.

[INVARIANT] Username uniqueness is enforced case-insensitively. "Shadow"
and "shadow" are the same name.

Endpoints: `GET /api/user/username/suggestions` and `PATCH /api/user/username`
in Phase 3. The PATCH endpoint rejects if `usernameLocked === true`.

---

## 2026-05-29 — EVENT — Service layer architecture

Decision: pokerDesk model becomes schema-only (no methods). All
orchestration moves to `src/services/gameService.ts`. The engine remains
pure functions taking and returning plain data.

Why: the original pokerDesk methods conflated three concerns — game logic,
DB persistence, and external side effects (wallet writes). That coupling
was the root cause of multiple bugs in the original codebase (showdown
crash on empty username, wallet/seat consistency issues, etc.). Separating
them into engine (logic) + service (orchestration) + model (schema) puts
each concern in exactly one place.

[INVARIANT] No model has methods. All behavior is in the service.
The engine never touches mongoose. The service is the only layer that
writes documents OR moves money.

Cost: added a layer. Pay-off: testable engine, clean re-use across routes
and the socket server, audit-able money flow.

---

## 2026-05-29 — EVENT — Money is integer minor units + currency tagging

Decision: every money field in every model stores integer minor units
(paise for INR, cents for USD). Every money-bearing model has a `currency`
field. Display-time conversion only — never store decimals.

Why: floating-point arithmetic accumulates rounding errors. The original
code patched this with a `sanitizeMath` helper that rounded after every
operation, which worked but was fragile. Integer math is exact by
definition; the bug class disappears.

[INVARIANT] All money values in the DB are integers ≥ 0. All money math
in code is integer math. Conversion happens exactly twice — once at the
API edge (request `12.34` → `1234` via `toMinor`), once at the API edge
on the way out (`1234` → `12.34` / `"₹12.34"` via `toMajor` / `formatMoney`).
NEVER convert inside the engine, the service, or the model layer.

Affected files: every model with a money field has a `pre('save')`
float-guard hook that rejects non-integer values. This is belt-and-suspenders.

---

## 2026-05-29 — EVENT — Phase 0 file/bucket discipline established

After realizing `bankAccount.ts` had been silently absent from our
three-bucket categorization (modify / delete-and-rebuild / keep), we added
KEEP.md as the explicit third-bucket tracker. The discipline rule:

[INVARIANT] Every file in `src/` (and supporting config) is in exactly
ONE bucket: TASKS.md (modify or rebuild) or KEEP.md (verified-keep or
foundation-keep). If a file is in neither, flag it immediately — that's
the "silently forgotten" failure mode.

Frozen-core files (Phase 0 outputs) are promoted to KEEP.md's Foundation
Keep section at task 0.18, the moment they freeze.

[LESSON] When categorizing or planning, enumerate exhaustively. "Everything
not mentioned is X" is the friend of silent mistakes. The extra ten
seconds to list every file pays for itself the first time something
would have slipped.

---

## 2026-06-11 — DECISION / INVARIANT — Bot model (task 1.16): persistent bot seats + bot usernames

New `Bot` model (`deskId`, `botId`, `seatNumber`, `strategy`, `botName`)
becomes the source of truth for bot identity at a desk, replacing in-memory
`runtime.botSeats` for persistence/eviction decisions. Fixes two issues:

1. **B8/B10 — practice desk closed after one hand.** `handleNeedsShowdown`
   was `$pull`ing every bot seat after every showdown, so a desk seeded with
   1 human + bots always dropped below `minToContinue` and force-closed.
   Bots now persist across hands. Eviction happens only when no human seat
   remains at the desk (server.ts `leave` handler and the 3-skip eviction
   path) — at that point bots are `$pull`ed, their `Bot` records deleted,
   and the desk force-closes via the existing `minToContinue` check.

2. **Bot players archived as `'unknown'`.** No `User` document exists for a
   bot's synthetic ObjectId, so `gameService.showdown()`'s
   `usernameByUserId` map (built via `User.find`) never covered bots.
   `showdown()` now also queries `Bot.find({ deskId })` and merges
   `botId.toString() -> botName` into that map before `buildArchiveData`.
   Bot names are `generateGamerName() + '_bot'`, generated once at seat time
   in `addBotToSeat`.

[INVARIANT] Bot identity/usernames are resolved via the `Bot` model, not
`User`. Any future code building a userId->username map for a desk
(archives, leaderboards, live broadcasts) must merge both `User.find`
(humans) and `Bot.find({ deskId })` (bots, via `botName`) — bot ObjectIds
will never appear in the `User` collection.

[INVARIANT] A practice desk with bot seats and zero human seats must not
remain open. Bot eviction + desk force-close happens at the moment the last
human leaves (voluntary leave or 3-skip eviction), not after every hand.

**Level 2 unlock — `gameService.showdown()`:** additive only — one extra
`Bot.find({ deskId })` query and a `Map` merge before `buildArchiveData` is
called. No pot/money/turn-progression logic changed. Tier-1 smoke tests
(`playOneHand`, `playThreeHands`, `playLifecycle`) involve no bots and must
still pass unchanged — run as regression check per Level 2 discipline.

---

## 2026-06-11 — DECISION / INVARIANT — task 1.17: PokerGameArchive.mode (B11), pokerDesks isPractice derivation (B12), B13–B15

1. **B11.** `PokerGameArchive` gains a required `mode: 'cash' | 'practice'`
   field, copied from `desk.mode` in `gameService.showdown()` — the same
   one-line pattern as the existing `currency`/`gameType` copy into
   `archivePayload`.

   [INVARIANT] Any analytics aggregate over `PokerGameArchive` that reports
   money figures (totals, leaderboards, per-user net change, games-played
   counts feeding those figures) MUST filter `{ mode: 'cash' }`. Practice
   archives contain bot players (`<name>_bot`, see task 1.16) and fake-chip
   swings — not real money, not real users.

   Pre-1.17 archives lack this field and won't match `mode: 'cash'` (Mongo
   doesn't apply schema defaults to `.lean()` reads of pre-existing docs
   missing the field). Acceptable: the DB gets wiped/reseeded
   (`scripts/wipeDb.ts`) before Phase 7 E2E, so no historical-data gap in
   practice.

2. **B12.** `POST /api/admin/pokerDesks` no longer reads `isPractice` from
   the request body — it's derived as `pokerMode.mode === 'practice'`,
   joining the existing inherited-field group (gameType/stake/currency/
   mode/etc. — see the route's "inherited from parent PokerMode" comment).

   [INVARIANT] `isPractice` is always inherited from the parent `PokerMode`
   at desk-creation time and is immutable thereafter (`PUT` already
   silently ignores it). There is exactly one place practice-ness is
   decided: `PokerMode.mode`. No second toggle, ever.

3. **B13.** `src/server.ts` — the bot-turn-timer's
   `runtime.botSeats.get(userId)!.strategy` non-null assertion replaced with
   an explicit `if (!botConfig) return;` guard.

4. **B14.** `GET /api/admin/analytics/users/[userId]` now 404s
   (`AuthError('NOT_FOUND', ...)`) if no `User` document exists for the id,
   matching `admin/users/[userId]`'s behavior. Previously returned 200 with
   empty/fabricated stats for any valid ObjectId, including bot ids.

5. **B15.** `lobby/desks/best`'s missing-`modeId` case now throws
   `MISSING_MODE_ID` (400) instead of the bank-domain `MISSING_BANK_FIELD`.
   `RAZORPAY_NOT_CONFIGURED` gets an explicit `case` in `statusForCode`
   (→ 500, documented as intentional server-misconfiguration response)
   instead of silently falling through `default`.

**Level 2 unlock — `gameService.showdown()`:** additive only, one line
(`mode: desk.mode` in `archivePayload`), identical shape to the
currency/gameType copy already present. Tier-1 smoke tests must pass —
they exercise `showdown()` and would fail if archive creation broke, even
though they don't assert on `mode` specifically.

---

## 2026-06-11 — BUG / DECISION / INVARIANT — task 1.19: createGame eligibility threshold (cold vs warm)

**Bug found during practice-mode testing:** `gameService.createGame` and
`engine.initializeGameState` both gated per-hand eligibility on
`balanceAtTable >= desk.minBuyIn`. For practice desks, `minBuyIn` is seeded
equal to `PRACTICE_STARTING_CHIPS` — so any player who lost even one chip in
hand 1 became ineligible for hand 2. `createGame` then threw
`InvalidStateError('Not enough eligible players...')`, which
`scheduleAutoStart`'s catch swallows silently for any message not containing
`'closed'` — hand 2 never started, with zero error surfaced anywhere.

**Root cause (general, not practice-specific):** `minBuyIn` is a *sit-down*
gate ("can you afford this stake"), not a *per-hand continuation* gate.
Chips fluctuate hand-to-hand by design — reusing `minBuyIn` as a
continuation check is wrong for cash desks too, it just happened to be
immediately fatal for practice because `minBuyIn === startingStack`.

**Fix:** `createGame` now computes a single `eligibilityThreshold`:
- Cold desk (`firstGameStartedAt === null`, first hand ever): `desk.minBuyIn`
  — unchanged, this is the sit-down gate.
- Warm desk (subsequent hands): `minChipsToContinue = bType === 'blinds' ?
  stake * 2 : stake` — the cost of the largest forced bet this hand could
  require. `minBuyIn` is NOT consulted again after the first hand.

This threshold is reused for: the `eligibleCount` precheck, the
button-rotation `eligibleByNumber` list, and the value passed into
`engine.initializeGameState` (parameter renamed `minBuyIn` →
`eligibilityThreshold`; internal filter logic unchanged, just a renamed/
re-purposed parameter — the engine stays agnostic to cold/warm, the caller
decides).

[INVARIANT] `desk.minBuyIn` gates ONLY the first hand a desk ever plays
(`firstGameStartedAt === null`). Every subsequent `createGame` call gates
eligibility on `minChipsToContinue` (= BB for blinds, ante for antes-mode),
never on `minBuyIn`. Player-COUNT gates (`minToStart` / `minToContinue`) are
unchanged and orthogonal to this chip-amount gate.

**Known follow-up (not fixed here):** a player whose `balanceAtTable` drops
below `minChipsToContinue` remains seated but is excluded from
`initializeGameState`'s `players` array indefinitely (same as today's
behavior, just a lower bar — strictly an improvement, not a regression).
"All-in for less than the blind" / auto-removal of such players is a
separate design question, deferred.

**Also fixed (Level 4, `server.ts`):** `scheduleAutoStart`'s catch now logs
any `InvalidStateError` whose message doesn't contain `'closed'` to stderr
(previously fully silent) — this class of "hand silently never starts" bug
must be visible in server logs going forward.

**Level 2 unlock — `gameService.createGame` + `engine.initializeGameState`:**
surgical — one new local variable (`eligibilityThreshold`) computed from
existing desk fields, substituted into the three places that previously read
`desk.minBuyIn`/`minBuyIn` for per-hand eligibility. No change to button
rotation, blind-posting, or archive logic. Tier-1 smoke tests
(`playOneHand`, `playThreeHands`, `playLifecycle`) must pass — these are cash
desks where, on a cold desk, `eligibilityThreshold === minBuyIn` (identical
to pre-change behavior) and on warm desks all seeded balances stay far above
`2 * stake`, so results should be byte-identical to before.

---

## 2026-06-11 -- DECISION / INVARIANT -- task 1.20: statistics route raw-minor-units exception

New `GET /api/admin/analytics/statistics` (Level 4) returns
`dailyDepositVolume: { date: string; amount: number }[]` as RAW INTEGER MINOR
UNITS, not via `serializeMoney`. This is a deliberate, narrow exception to the
usual "never return raw money" rule -- same precedent as
`POST /api/payments/razorpay/order`'s `amount` field (CONTRACTS.md). Reason:
the admin frontend feeds this array directly into a Chart.js dataset, which
needs numeric Y-values; formatting each point as a currency string would force
the chart layer to re-parse it. The route's `totals.depositVolume30d` (a
single scalar, not a chart series) IS serialized via `serializeMoney` as normal.

[INVARIANT] `dailyDepositVolume[].amount` is the ONLY field on this route
returned as a raw integer; every other money-shaped output
(`totals.depositVolume30d`) goes through `serializeMoney`. Do not "fix" the
raw array to be consistent -- it is correct as integers for charting.

---