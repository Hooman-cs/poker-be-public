# HANDOFF.md — Claude Code execution results

This file is written by Claude Code only.
Claude Desktop reads it. Neither Claude Desktop nor the user writes here.
Each task overwrites the previous entry.

---

## wipeDb.ts + seedLobby.ts practice desk — PASS

### What was done
Created `scripts/wipeDb.ts`: calls `.deleteMany({})` on all 12 operational collections (User, Wallet, WalletTransaction, BankAccount, BankTransaction, GatewayTransaction, Poker, PokerMode, PokerDesk, PokerGameArchive, PracticeSession, Admin), prints deleted count per collection, and prints the follow-up commands. AppConfig is intentionally excluded. Updated `scripts/seedLobby.ts`: added a third PokerMode (`mode: 'practice'`) and a PokerDesk (`isPractice: true`, `tableName: 'Practice Table 1'`) after deskB, and updated the idempotency printout to show mode type and flag practice desks.

### Files changed
- `scripts/wipeDb.ts` (created)
- `scripts/seedLobby.ts` (modified — practice mode + desk creation; idempotency printout)

### New files — suggested docs/KEEP.md level
- `scripts/wipeDb.ts` — Level 5 (operational script, free to edit)

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean (no output)

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 1/2 files touched)

### Open questions for Claude Desktop
None.

---

## Phase 5.6-patch — Fix tier2Smoke.ts hole-card race + leaveViaSocket observer — PASS

### What was done
Fixed two bugs in `scripts/tier2Smoke.ts`. Bug A: added `waitForHoleCards` helper using `socket.on` (persistent, payload-shape-checked) so hole-card promises are pre-registered synchronously before any `await`, eliminating the race where sequential `socket.once` calls missed events already in flight. Applied to `playHandViaSocket` (via `preHoleCardPs` parameter), Hand 3 inline block, and the between-H3/H4 and H4/H5 blocks where hole-card promises are registered before the leave. Bug B: added `observerSocket` parameter to `leaveViaSocket`; both between-hand call sites now pass `actArr[0][1]` as observer so `player:left` is awaited on a socket that stays in the room.

### Files changed
- `scripts/tier2Smoke.ts` (modified — `waitForHoleCards` helper, `playHandViaSocket` signature, Hand 3 inline, H3→H4 and H4→H5 blocks, `leaveViaSocket` signature)

### New files — suggested docs/KEEP.md level
None.

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean (no output)

npx tsx --env-file=.env.local scripts/tier2Smoke.ts:
```
Seeding...
  poker=6a1d66878f7355e44c4f40ee mode=6a269b25edd111f65f85038f desk=6a269b25edd111f65f850395 users=6

Verifying HTTP endpoints...
  ok:   GET /api/lobby/games → 200 (got 200)
  ok:   GET /api/lobby/games → response.games is non-empty array
  ok:   GET /api/lobby/desks/best → 200 (got 200)
  ok:   GET /api/lobby/desks/best → desk is not null

Verifying socket auth rejection...
  ok:   bad-token → connect_error INVALID_TOKEN (got 'INVALID_TOKEN')

Seating first 4 players (cold-start)...
  tier2_alice -> seat 1
  tier2_bob -> seat 2
  tier2_carol -> seat 3
  tier2_dave -> seat 4
  ok:   desk.minToStart === 4 (got 4)
  ok:   desk.minToContinue === 3 (got 3)
  ok:   firstGameStartedAt null before hand 1

--- Hand 1 (4 players, cold→warm) ---
  ok:   Hand 1 (4 players, cold→warm): room broadcast has redacted holeCards
  ok:   Hand 1 (4 players, cold→warm): 039b received 2 targeted hole cards
  ok:   Hand 1 (4 players, cold→warm): 03a3 received 2 targeted hole cards
  ok:   Hand 1 (4 players, cold→warm): 03a7 received 2 targeted hole cards
  ok:   Hand 1 (4 players, cold→warm): 03ab received 2 targeted hole cards
  -> showdown complete
  ok:   firstGameStartedAt set after hand 1
  ok:   desk.status === 'active' after hand 1 (got 'active')
  ok:   4 seats after hand 1 (got 4)

Seating 2 more (warm desk)...
  tier2_eve -> seat 5
  tier2_frank -> seat 6
  ok:   6 seats after additions (got 6)

--- Hand 2 (6 players) ---
  ok:   Hand 2 (6 players): room broadcast has redacted holeCards
  ok:   Hand 2 (6 players): 039b received 2 targeted hole cards
  ok:   Hand 2 (6 players): 03a3 received 2 targeted hole cards
  ok:   Hand 2 (6 players): 03a7 received 2 targeted hole cards
  ok:   Hand 2 (6 players): 03ab received 2 targeted hole cards
  ok:   Hand 2 (6 players): 03b0 received 2 targeted hole cards
  ok:   Hand 2 (6 players): 03b6 received 2 targeted hole cards
  -> showdown complete

--- Hand 3 (6 players, mid-hand leave) ---
  ok:   Hand 3: room broadcast has redacted holeCards
  ok:   Hand 3: 039b received 2 targeted hole cards
  ok:   Hand 3: 03a3 received 2 targeted hole cards
  ok:   Hand 3: 03a7 received 2 targeted hole cards
  ok:   Hand 3: 03ab received 2 targeted hole cards
  ok:   Hand 3: 03b0 received 2 targeted hole cards
  ok:   Hand 3: 03b6 received 2 targeted hole cards
  mid-hand leave: tier2_eve
  tier2_eve left (via socket)
  -> showdown complete
  ok:   5 seats after hand 3 mid-leave (got 5)
  ok:   desk still active after hand 3 (got 'active')
  tier2_frank left (via socket)
  ok:   4 seats before hand 4 (got 4)
  ok:   desk still active with 4 seats (>= minToContinue)

--- Hand 4 (4 players, warm — below minToStart but above minToContinue) ---
  ok:   Hand 4 ...: room broadcast has redacted holeCards
  ok:   Hand 4 ...: 039b received 2 targeted hole cards
  ok:   Hand 4 ...: 03a3 received 2 targeted hole cards
  ok:   Hand 4 ...: 03a7 received 2 targeted hole cards
  ok:   Hand 4 ...: 03ab received 2 targeted hole cards
  -> showdown complete
  tier2_dave left (via socket)
  ok:   3 seats before hand 5 (got 3)
  ok:   desk active at exactly minToContinue=3

--- Hand 5 (3 players, at warm floor) ---
  ok:   Hand 5 (3 players, at warm floor): room broadcast has redacted holeCards
  ok:   Hand 5 (3 players, at warm floor): 039b received 2 targeted hole cards
  ok:   Hand 5 (3 players, at warm floor): 03a3 received 2 targeted hole cards
  ok:   Hand 5 (3 players, at warm floor): 03a7 received 2 targeted hole cards
  -> showdown complete

Leave that triggers force-close...
  tier2_carol left — desk:closed received
  ok:   desk.status === 'closed' after drop below minToContinue (got 'closed')
  ok:   seats cleared after force-close (got 0)

Hand 6 attempt — should reject...
  rejected: Desk is closed — no new players can be seated
  ok:   join on closed desk returned error event

Money conservation...
  ok:   total money preserved: wallets(300000) + seats(0) = 300000 (expected 300000)
  ok:   5 archives created across hands 1-5 (got 5)
  ok:   all archived players have non-empty username

Cleaning up...

=== SUMMARY ===
all checks passed.
```

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 1/2 files touched)

### Open questions for Claude Desktop
None.

---

## Phase 5.6 — Tier-2 smoke test (scripts/tier2Smoke.ts) — PASS

### What was done
Created `scripts/tier2Smoke.ts`: full end-to-end smoke test via HTTP + Socket.io (no gameService imports). Mirrors `playLifecycle.ts` phase structure (5 hands, mid-hand leave, force-close, Hand 6 reject). Additional checks: HTTP lobby endpoints, socket auth rejection, redacted room broadcasts, targeted hole-card delivery. Updated `docs/CONTRACTS.md` with the new entry.

### Files changed
- `scripts/tier2Smoke.ts` (created)
- `docs/CONTRACTS.md` (modified — added tier2Smoke entry)

### New files — suggested docs/KEEP.md level
- `scripts/tier2Smoke.ts` — Level 5 (operational script, free to edit)

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean (no output)

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Script not run (requires npm run dev on ports 3000 + 3001)

### Open questions for Claude Desktop
1. **Hand 3 `player:left` listener**: the mid-hand leave emits `leave` from the leaver's socket, then waits for `player:left` on `firstSock` (first socket in activeSockets). If `firstSock` was already in the room before the leave, it receives the broadcast. This is correct — but if firstSock is the same as the leaver, it would deadlock. The leaver is always picked as the last non-UTG socket (`reverse().find(...)`), so firstSock and the leaver are never the same. Worth verifying on first run.
2. **Between-hand leave race**: `h4StartP` and `h5StartP` are pre-registered on the first active socket before the leave is emitted. If the 3 s auto-start fires before the leave completes (very unlikely locally), the pre-registered promise catches `game:start` correctly. This should not be an issue in practice.

---

## Phase 5.5 — Tier-1 smoke test verification pass — PASS

### What was done
Ran all three Tier-1 smoke tests against current codebase (post-5.4). All passed with no failures.

### Files changed
None.

### New files — suggested docs/KEEP.md level
None.

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsx --env-file=.env.local scripts/playOneHand.ts → all checks passed
npx tsx --env-file=.env.local scripts/playThreeHands.ts → all checks passed
npx tsx --env-file=.env.local scripts/playLifecycle.ts → all checks passed

### Checks
- [ ] TypeScript compiled cleanly (not required — no code changes)
- [x] Tier-1 smoke tests passed

### Open questions for Claude Desktop
None.

---

## Phase 5.4 — Reconnection + seat-status handling — PASS

### What was done
Two targeted edits to `src/server.ts`. (1) `disconnect` handler made async; now also fires a DB update setting `seats.$.status = 'disconnected'` for the affected user, fire-and-forget with silent catch. (2) `join` handler gains a reconnect check at the top: if the user is already seated (checked via `PokerDesk.findById` before `addUserToSeat`), the handler skips seat creation, resets status to `'active'`, reloads the desk, broadcasts `player:joined`, re-emits hole cards if a game is in progress, and conditionally restarts the turn timer only if it's the reconnecting player's turn and no timer is already running.

### Files changed
- `src/server.ts` (modified — disconnect handler extended; join handler reconnect path added)

### New files — suggested docs/KEEP.md level
None.

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean (no output)

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 1/2 files touched)

### Open questions for Claude Desktop
None.

---

## Phase 5.3c — Practice sessions admin endpoint + isPractice desk creation — PASS

### What was done
Created `GET /api/admin/practiceSessions` — paginated list of all PracticeSession records with populated user info and `finalChips` serialized via `serializeMoney`. Added `isPractice` to the `POST /api/admin/pokerDesks` handler: body field is parsed as `body.isPractice === true` (defaults `false` if absent) and passed to `PokerDesk.create()`. No other changes to the pokerDesks handler or `serializeDesk`.

### Files changed
- `src/app/api/admin/practiceSessions/route.ts` (created)
- `src/app/api/admin/pokerDesks/route.ts` (modified — `isPractice` added to POST only)
- `docs/CONTRACTS.md` (modified — two new entries added)

### New files — suggested docs/KEEP.md level
- `src/app/api/admin/practiceSessions/route.ts` — Level 4 (admin API route, normal review)

### USER_API_CHANGES.md impact
None — admin-only endpoints, no user-facing API touched.

### Commands run and output
npx tsc --noEmit → clean (no output)

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 1/2 files touched)

### Open questions for Claude Desktop
1. `serializeDesk` in pokerDesks/route.ts does not currently expose `isPractice` in GET/POST responses. If the admin UI needs to display or filter by `isPractice`, `serializeDesk` should be updated (additive change to the GET response, no breaking change).

---

## Phase 5.3b — Bot layer + practice session tracking — PASS

### What was done
Part 1 (cleanup): deleted `PRACTICE_STARTING_STACK_MINOR` from constants.ts, removed its import from gameService.ts, truncated ~1100 lines of commented-out dead code from gameService.ts (lines 1271–2375), and truncated ~133 lines of dead code from pokerMode.ts (lines 138–270). Smoke tests confirmed clean after cleanup. Parts 2–3: created `botService.addBotToSeat` and `lib/bots/index.ts` with three strategy implementations (Easy/Medium/Hard). Part 4: extended `DeskRuntimeState` with `practiceSessions`, added `closePracticeSession` helper, added bot routing in `startTurnTimer` (1.5s think delay), wired session close into `leave` handler and 3-skip eviction, and added the `practice` socket event handler.

### Files changed
- `src/config/constants.ts` (modified — deleted `PRACTICE_STARTING_STACK_MINOR`)
- `src/services/gameService.ts` (modified — removed dead import, truncated dead code block; Level 2)
- `src/models/pokerMode.ts` (modified — truncated dead code block; Level 3)
- `src/services/botService.ts` (created)
- `src/lib/bots/index.ts` (created)
- `src/server.ts` (modified — `practiceSessions`, `closePracticeSession`, bot routing, `practice` event)
- `docs/CONTRACTS.md` (modified — added `addBotToSeat` and `BotStrategy` entries)

### New files — suggested docs/KEEP.md level
- `src/services/botService.ts` — Level 4 (boundary helper; callers must not call inside withDeskLock)
- `src/lib/bots/index.ts` — Level 4 (boundary helper; strategy implementations are intentionally swappable)

### USER_API_CHANGES.md impact
None — all changes are server-side socket layer and practice-mode internals.

### Commands run and output

**After Part 1 cleanup:**
npx tsc --noEmit → clean
npx tsx --env-file=.env.local scripts/playOneHand.ts → all checks passed
npx tsx --env-file=.env.local scripts/playThreeHands.ts → all checks passed
npx tsx --env-file=.env.local scripts/playLifecycle.ts → all checks passed

**After Parts 2–4 complete:**
npx tsc --noEmit → clean
npx tsx --env-file=.env.local scripts/playOneHand.ts → all checks passed
npx tsx --env-file=.env.local scripts/playThreeHands.ts → all checks passed
npx tsx --env-file=.env.local scripts/playLifecycle.ts → all checks passed

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [x] Tier-1 smoke tests passed (Level 2 file touched in Part 1)

### Open questions for Claude Desktop
None.

---

## seedLobby.ts — Lobby seed script — PASS

### What was done
Created `scripts/seedLobby.ts`. Idempotency is keyed on `Poker.description = "Lobby Seed — Texas Hold'em"` (not gameType) so smoke-test leftover rows don't trigger a false exit. The Poker row is upserted via `findOneAndUpdate` to survive the unique `gameType` index constraint. Two PokerModes and two PokerDesks were created successfully and are confirmed in DB.

### Files changed
- `scripts/seedLobby.ts` (created)

### New files — suggested docs/KEEP.md level
- `scripts/seedLobby.ts` — Level 5 (operational script, free to edit)

### Schema discrepancies vs task spec
- **No `name` field on Poker or PokerMode.** `Poker.description` was used as the human label ("Lobby Seed — Texas Hold'em"). PokerModes are identified by stake value in output.
- **`minToStart`/`minToContinue` = 2 rejected by schema** (floor is 3 per validator). Used 3 instead. If the lobby requires 2-player tables, the schema minimum must be lowered first (Level 3 model change).

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean
npx tsx --env-file=.env.local scripts/seedLobby.ts (first run):
  Poker: 6a1d66878f7355e44c4f40ee
  PokerMode 'Low Stakes'  (stake=10000): 6a2652d822bef13df35ee4c3
  PokerMode 'High Stakes' (stake=50000): 6a2652d922bef13df35ee4c5
  PokerDesk Low  Stakes / Table 1: 6a2652d922bef13df35ee4c9
  PokerDesk High Stakes / Table 1: 6a2652d922bef13df35ee4cb
npx tsx --env-file=.env.local scripts/seedLobby.ts (second run — idempotency):
  Lobby seed already exists — printing IDs and exiting.
  Poker: 6a1d66878f7355e44c4f40ee
  PokerMode (stake=10000): 6a2652d822bef13df35ee4c3
    PokerDesk 'Table 1': 6a2652d922bef13df35ee4c9
  PokerMode (stake=50000): 6a2652d922bef13df35ee4c5
    PokerDesk 'Table 1': 6a2652d922bef13df35ee4cb

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 1/2 file touched)

### Open questions for Claude Desktop
1. Neither `Poker` nor `PokerMode` has a `name` field. If a display name is needed in the lobby API response, the model needs a `name` field added (Level 3 additive change). Currently PokerMode is only identifiable by stake value.
2. Task spec said `minToStart=2, minToContinue=2` — the schema floor is 3. Confirm whether 3 is acceptable for the lobby desks, or whether the schema minimum needs changing.

---

## Phase 5.3a — Practice mode foundation — PASS

### What was done
Added `PRACTICE_STARTING_CHIPS = 100000` to constants, `isPractice: Boolean` to `PokerDesk` schema + interface, and created `PracticeSession` model. Updated `addUserToSeat` to gate on `desk.isPractice` (replacing `isCashMode(deskMode)`) and use `PRACTICE_STARTING_CHIPS`. Updated `userLeavesSeat` with the same gate change and added `finalChips: number | null` to `UserLeavesSeatResult` — practice path captures `seat.balanceAtTable` before removal; cash path returns null.

### Files changed
- `src/config/constants.ts` (modified — added `PRACTICE_STARTING_CHIPS`)
- `src/models/pokerDesk.ts` (modified — added `isPractice` to interface + schema)
- `src/models/practiceSession.ts` (created)
- `src/services/gameService.ts` (modified — gate change + `finalChips` in both seat functions)
- `docs/CONTRACTS.md` (modified — updated addUserToSeat + userLeavesSeat entries; added PracticeSession entry)

### New files — suggested docs/KEEP.md level
- `src/models/practiceSession.ts` — Level 3 (Mongoose data model, additive changes OK)

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → clean (no output)
npx tsx --env-file=.env.local scripts/playOneHand.ts → all checks passed
npx tsx --env-file=.env.local scripts/playThreeHands.ts → all checks passed
npx tsx --env-file=.env.local scripts/playLifecycle.ts → all checks passed

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [x] Tier-1 smoke tests passed

### Open questions for Claude Desktop
None.

---

## Phase 5.2-patch — Fix missing startTurnTimer after player:left — PASS

### What was done
Added the missing `startTurnTimer` call in two locations in `src/server.ts`. Both insertions follow the same pattern: after `broadcastDeskState('player:left', ...)` and before the `desk.status === 'closed'` check. The `!rt.turnTimer` guard ensures the timer is only started when the leaver held the turn (timer was cleared on leave), not when another player's timer is already running.

### Files changed
- `src/server.ts` (modified — two 4-line blocks added)

### New files — suggested docs/KEEP.md level
None.

### USER_API_CHANGES.md impact
None.

### Commands run and output
npx tsc --noEmit → no output (clean)

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [ ] Tier-1 smoke tests (not required — no Level 2 file touched)

### Open questions for Claude Desktop
None.
