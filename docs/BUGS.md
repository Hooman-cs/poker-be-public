# Bugs

Bugs found during development and frontend testing.
Linked to LOGS.md entries on resolution.

## Status Key
- [ ] Open
- [~] In Progress  
- [x] Resolved

---

## CRITICAL

### B1 — Socket transport error after showdown — hand 2 never starts
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** Server (`src/server.ts` / `src/services/gameService.ts`)
**Status:** [x] Resolved (2026-06-09)

Hand 1 completes (`game:showdown` received, desk still `status: active`).
Approximately 3 seconds later the socket disconnects with `reason: transport error`.
The 3-second auto-start timer never completes — hand 2 is never created.

The disconnect happens immediately after the post-showdown `scheduleAutoStart`
window. Suspected cause: an unhandled error thrown inside the `scheduleAutoStart`
`setTimeout` callback after showdown (possibly `createGame` throwing because a
broke bot tries to post a blind, or an uncaught promise rejection crashing the
server process). Check the server terminal for stack traces at the time of disconnect.

**To reproduce:** start a 6-player practice game (1 human + 5 easy bots), let the
hand play to showdown, wait for transport error.

**Fix direction:**
1. Wrap the entire `scheduleAutoStart` callback in a top-level try/catch that
   logs errors and emits `desk:closed` on failure instead of crashing.
2. Before calling `createGame`, remove any bot seats with `balanceAtTable === 0`
   via `userLeavesSeat`. If remaining players drop below `minToContinue`, close
   the desk gracefully instead of throwing.

---

## BACKEND

### B2 — EasyStrategy calls instead of checking on post-flop streets
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** `src/lib/bots/index.ts` — `EasyStrategy.selectAction`
**Status:** [x] Resolved (2026-06-09)

All easy bots call ₹200 (20000 paise) on every post-flop street even when no
one has bet. They should check. The bug is in how `callAmount` is calculated —
it uses a cumulative field that does not reset between rounds (likely
`game.totalBet - player.totalBet`) instead of the current round's bet amount.

With 5 bots each calling ₹200 on 3 post-flop streets = ₹600 wasted per bot per
hand. Starting stack is ₹1000 so bots near go broke after one hand, which
triggers B1.

**Fix direction:** In `EasyStrategy.selectAction` (and review `MediumStrategy`
and `HardStrategy` for the same issue), use the correct field for the current
round's outstanding bet. The engine likely exposes `game.currentRoundBet` or
`game.roundBet` that resets to 0 after each `advanceGameRound`. Read
`IPokerGame` in `src/models/pokerDesk.ts` to find the exact field name, then
use `callAmount = currentRoundBet - player.currentRoundBet` (or equivalent).

### B3 — Missing `desk:getSeats` server event handler
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** `src/server.ts`
**Status:** [x] Resolved (2026-06-09)

The frontend emits `desk:getSeats { deskId }` before a player picks a seat, to
show which seats are occupied and which are available. The server has no handler
for this event — it is silently ignored.

**Fix direction:** Add a `desk:getSeats` handler in `server.ts`:
```ts
socket.on('desk:getSeats', async ({ deskId }: { deskId: string }) => {
  const desk = await PokerDesk.findById(deskId).lean();
  if (!desk) {
    targetedEmit('', socket.data.userId, 'error', {
      code: 'DESK_NOT_FOUND', message: 'Desk not found',
    });
    return;
  }
  socket.emit('desk:seats', {
    deskId,
    seats: desk.seats.map((s) => ({
      seatNumber: s.seatNumber,
      userId: s.userId.toString(),
      status: s.status,
    })),
    maxSeats: desk.maxSeats,
  });
});
```
New S→C event: `desk:seats` — targeted to the requesting socket only.
No auth issue — the user is already authenticated via the socket handshake.

---

## FRONTEND

### B4 — Double slash in lobby URL
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** User frontend (`ApiCaller.js` or base URL constant)
**Status:** [ ] Open

Request is sent to `http://192.168.1.5:3000/api//lobby/games` (double slash).
Should be `http://192.168.1.5:3000/api/lobby/games`.

**Fix direction:** Check the base URL constant — it likely has a trailing slash
(`http://192.168.1.5:3000/api/`) being concatenated with a path that also
starts with a slash (`/lobby/games`). Remove one of them.

### B5 — Oscillating amounts display (0 ↔ actual values flickering)
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** User frontend — PokerDesk component state management
**Status:** [ ] Open

Every player action amount is logged twice per event — once with actual values
and once with zeros, alternating throughout the entire hand. The server data is
correct; this is a frontend state management conflict.

**Likely cause:** The component maintains two parallel state sources — a local
`playerActions` tracker that resets to `{}` on re-render, and the socket-driven
desk state. These two state updates fire independently, causing two renders per
event: one with the fresh socket data and one with the reset local state.

**Fix direction:** Derive action amounts directly and exclusively from
`desk.currentGame.players[n].totalBet` (server state). Remove or consolidate
any local action tracker that resets independently.

### B6 — Stale bot seats persist after practice session ends
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** `src/server.ts` — `handleNeedsShowdown`
**Status:** [x] Resolved (2026-06-09)

After `game:showdown`, bots remain seated in the desk document. The next time
`GET /api/lobby/desks/best` is called, the desk is returned with existing bot
seats. When a new user emits `practice`, the server finds no available seats
for new bots (all taken by old bots from the dead session). The old bots are
not in the new session’s `runtime.botSeats`, so they’re treated as human
players (60s timers), stalling the game.

**Fix direction:** In `handleNeedsShowdown` (in `server.ts`), after broadcasting
`game:showdown`, evict all bot seats from `runtime.botSeats` via `userLeavesSeat`
before calling `scheduleAutoStart`. With bots gone, player count drops below
`minToContinue` and the desk closes gracefully. The next user gets a fresh desk
from the pool. This makes each practice desk single-use per session — correct
behavior with 20 desks in the pool.

### B7 — Bot strategy produces uninteresting games
**Found:** Phase 5 frontend testing (2026-06-09)
**Layer:** `src/lib/bots/index.ts`
**Status:** [x] Resolved (2026-06-09)

All three strategies produce flat gameplay: bots either always check (post-B2)
or always call. No folding of weak hands, no raising of strong hands. Practice
games are unrepresentative of real poker.

**Fix direction:** Replace all three strategies with a single `AdaptiveStrategy`
that evaluates actual hand strength:
- Pre-flop: hole card ranking table (pairs, broadways, suited connectors, junk)
- Post-flop: pokersolver hand evaluation (already in project)
- Decision: fold weak hands to bets, check when free, call decent hands, raise
  strong hands, 10–15% random bluff probability
- Randomness in decision thresholds so bots feel unpredictable
`getBotStrategy` returns `new AdaptiveStrategy()` for all input values.
Frontend removes the strategy picker; server ignores the `strategy` field value.

### B8 — B6 bot eviction races with frontend events; desk never closes after showdown
**Found:** Phase 5 frontend testing (2026-06-10)
**Layer:** `src/server.ts` — `handleNeedsShowdown` B6 block
**Status:** [x] Resolved (2026-06-10)

The per-bot `userLeavesSeat` loop in the B6 block races against the frontend's
immediate `practice (auto-restart)` and `leave` events, which arrive at the
server between the `await userLeavesSeat` calls. All 5 bot evictions are
silently caught by the `catch {}` block. The desk never closes; bots remain
seated; `desks/best` returns the same stale desk on the next connection.
**Fix direction:** Replace the per-bot loop with a single atomic
`PokerDesk.findByIdAndUpdate($pull)` that removes all bot seats in one DB
operation (no lock needed — atomic write). Then check remaining seat count
against `minToContinue` and close the desk directly if below threshold:
```ts
const botObjIds = [...runtime.botSeats.keys()].map(id => new Types.ObjectId(id));
const updatedDesk = await PokerDesk.findByIdAndUpdate(
  deskId,
  { $pull: { seats: { userId: { $in: botObjIds } } } },
  { new: true },
);
runtime.botSeats.clear();
if (updatedDesk && updatedDesk.seats.length < updatedDesk.minToContinue) {
  updatedDesk.status = 'closed';
  await updatedDesk.save();
  broadcastDeskState(deskId, 'player:left', updatedDesk);
  io.to(deskId).emit('desk:closed', {});
  deskRuntime.delete(deskId);
  return;
}
if (updatedDesk) broadcastDeskState(deskId, 'player:left', updatedDesk);
```

### B9 — Frontend emits `practice` immediately after `game:showdown` (wrong flow)
**Found:** Phase 5 frontend testing (2026-06-10)
**Layer:** User frontend
**Status:** [ ] Open

After `game:showdown`, the frontend immediately emits `practice (auto-restart)`
on the same desk. This causes `addUserToSeat` to fail (human still seated),
followed by double `leave` emits and a disconnect. B8's racing events are a
direct consequence of this frontend behaviour.

**Correct flow (frontend):** After `game:showdown`, do nothing — just display
the results. Wait for `desk:closed` (arrives 1–2 seconds later after B8 fix
closes the desk). On `desk:closed`, navigate back to lobby, call `desks/best`
for a fresh desk, then emit `practice` on the new deskId.
