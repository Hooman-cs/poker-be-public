# INSTRUCTIONS.md — Claude Code Standing Instructions

Read this file COMPLETELY before starting any task.
Two sections: PERMANENT (never changes) and CURRENT TASK (set by Claude Desktop).

---

## PERMANENT INSTRUCTIONS

### Your role
You are the execution layer. You implement, run, and report.
You do NOT make design decisions — those happen in Claude Desktop.
If you hit a real design question mid-task, stop, write it to docs/HANDOFF.md, and wait.

### File ownership
You maintain: `docs/CONTRACTS.md`.
Claude Desktop maintains: `docs/LOGS.md`, `docs/KEEP.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`.
You write to: `docs/HANDOFF.md` (execution results only).
You read but do NOT edit: `docs/KEEP.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `docs/LOGS.md`.

### Maintaining docs/CONTRACTS.md
Update in the SAME turn as any code that creates or changes a callable's signature.
Never leave a changed signature undocumented.

Every entry format:

```markdown
## [module.functionName]

**SIGNATURE**
```ts
functionName(param: Type): ReturnType
```

**INPUT** — param descriptions, units if money (always minor units).
**OUTPUT** — return shape. Units if money.
**ERRORS THROWN** — ErrorClass (CODE) — when it fires.
**SIDE EFFECTS** — DB writes, wallet debits, mutex, etc. "None" if pure.
**INVARIANTS** — [INVARIANT] binding rules callers must respect.
```

When to update: new function, signature change, deletion, new error code.
When NOT to update: internal refactor with no signature change, comment-only edits.

### Before writing any code
1. Read the relevant `docs/CONTRACTS.md` entry for every function you will call.
2. Run `grep "required:" <model-file>` on every schema you will seed or create.
3. Read only the specific section of a file you need — not the whole file.
4. Check `docs/KEEP.md` for the file's freeze level before touching it.

### The freeze levels (from docs/KEEP.md)
- **Level 1** (constants, user, wallet, jwt): Do not touch. Flag and stop.
- **Level 2** (engine, service): Surgical fixes only. docs/LOGS.md entry required first.
  After any Level 2 change, run ALL THREE Tier-1 smoke tests.
- **Level 3** (other models): Additive changes OK. Breaking changes need migration note.
- **Level 4** (auth guards, API helpers, types): Normal edit. Don't break callers.
- **Level 5** (scripts): Free to edit.

### Code conventions (always)
- `@/` imports only. No relative paths. No barrel files.
- Money = integer minor units inside the system. Outbound = formatted string via `serializeMoney`.
- Routes are thin — auth check, parse, call service/helper, respond. No business logic inline.
- Always `await dbConnect()` before any DB operation.
- Never use `// ===` divider comments.
- One file at a time. Finish and verify before starting the next.
- One top-level try/catch per route; end catch with `return errorResponse(err)`.

### Service/engine boundary (critical)
Never pass a Mongoose subdoc into engine functions. Construct a plain object:
```typescript
const plainPlayer: IGamePlayer = {
  userId: player.userId,
  balanceAtTable: player.balanceAtTable,
  status: player.status,
  totalBet: player.totalBet,
  holeCards: player.holeCards,
  role: player.role,
};
```
This was a real Phase 1 bug. Do not reintroduce it.

### Tier-1 smoke tests — run after ANY Level 2 change
```bash
npx tsx --env-file=.env.local scripts/playOneHand.ts
npx tsx --env-file=.env.local scripts/playThreeHands.ts
npx tsx --env-file=.env.local scripts/playLifecycle.ts
```
All three must pass. If any fail, do NOT move on — write the failure to docs/HANDOFF.md.

### Token efficiency
- Read specific file sections, not whole files, unless the task requires it.
- Use `sed -n 'START,ENDp' file.ts` for targeted reads.
- Do not re-read files already in context unless they changed.
- Do not explain what you are about to do — just do it.
- Write results to docs/HANDOFF.md concisely — no long summaries inline.

### After completing any task
Write to `docs/HANDOFF.md` using the template at the bottom of this file.
Do not ask whether to write — always do it.

---

## CURRENT TASK

<!-- Claude Desktop updates this section before each task. -->
<!-- Clear this section when a phase is complete. -->

**Phase 5, Task 5.1 — `src/server.ts` + `src/types/socketTypes.ts`**

### Files to read first
- `docs/ARCHITECTURE.md` — full Phase 5 socket design section (events, DeskRuntimeState shape, edge-case catalog, bot subsystem design)
- `docs/LOGS.md` — grep `[INVARIANT]` entries for Phase 5
- `docs/CONTRACTS.md` — all gameService entries: `addUserToSeat`, `userLeavesSeat`, `handlePlayerAction`, `showdown`, `advanceGameRound`, `createGame`
- `src/utils/jwt.ts` — verify signature (used for socket auth middleware)
- `src/lib/api/errors.ts` — ServiceError subclass names (for mapping thrown errors to `error` event codes)

### Files to create
- `src/types/socketTypes.ts` — socket event payload types (NEW)
- `src/server.ts` — standalone Socket.io server (NEW)

### Implementation logic

**`src/types/socketTypes.ts`**
Define payload interfaces for every event in the protocol table:
- C→S: `JoinPayload`, `ActionPayload`, `LeavePayload`
- S→C: `PlayerJoinedPayload`, `PlayerLeftPayload`, `GameStartPayload`, `GameActionPayload`, `GameRoundAdvancePayload`, `GameShowdownPayload`, `DeskClosedPayload`, `TurnStartPayload`, `ErrorPayload`
- `HoleCardsPayload` — targeted after `game:start`: `{ holeCards: ICard[] }`
- `RedactedGamePlayer` — player shape with `holeCards: []` always

**`src/server.ts`**

1. **Setup**: standalone HTTP + Socket.io server on `process.env.SOCKET_PORT ?? 3001`. Import `gameService` functions directly. Import `verifyToken` from `@/utils/jwt`.

2. **Auth middleware** (`io.use`): read JWT from `socket.handshake.auth.token`. Verify via `verifyToken`. Reject with `MISSING_AUTH` / `INVALID_TOKEN` if absent or invalid. Attach `socket.data.userId` and `socket.data.role` from the decoded payload.

3. **`DeskRuntimeState` + `deskRuntime` map**: define the full interface (userSockets, botSeats, skipCounts, turnTimer, autoStartTimer). `const deskRuntime = new Map<string, DeskRuntimeState>()`.

4. **Helper — `getOrCreateRuntime(deskId)`**: returns existing runtime or creates a fresh one with empty maps and null timers.

5. **Helper — `broadcastDeskState(deskId, event, desk, extraPayload?)`**: strips `holeCards` from all players in `desk.currentGame?.players` before emitting to the room. Merges `extraPayload` into the broadcast if provided.

6. **Helper — `targetedEmit(deskId, userId, event, payload)`**: resolves socketId via `runtime.userSockets.get(userId)`, emits only to that socket.

7. **Helper — `scheduleAutoStart(deskId, delayMs = 3000)`**: clears existing `autoStartTimer`, sets a new 3s `setTimeout` that calls `createGame({ deskId })`. On success: emits `game:start` (redacted broadcast + targeted hole cards). On `InvalidStateError` (desk closed, already in progress): emits `desk:closed` if the error indicates closure, otherwise discards silently.

8. **Helper — `handleNeedsShowdown(deskId)`**: calls `showdown({ deskId })`. On success: emits `game:showdown` to room with `potResults`. Then schedules auto-start if `desk.status !== 'closed'`.

9. **Helper — `handleAllInRunout(deskId)`**: if after any action `activePlayers === 0 && allInPlayers >= 2`, loop `advanceGameRound` until `progression === 'showdown'`, then call `handleNeedsShowdown`.

10. **`join` handler** (`socket.on('join', async (payload) => { ... })`):
    - Validate `deskId`, `seatNumber`, `buyInAmount` present
    - Call `addUserToSeat({ deskId, userId, seatNumber, buyInAmount })`
    - `socket.join(deskId)`
    - `runtime.userSockets.set(userId, socket.id)`
    - `broadcastDeskState(deskId, 'player:joined', updatedDesk)`
    - Check auto-start threshold: if `desk.seats.length >= desk.minToStart` (cold) or `>= WARM_GAME_MIN_PLAYERS` (warm), call `scheduleAutoStart(deskId)`
    - On error: `targetedEmit` the `error` event with the ServiceError code

11. **`action` handler** (`socket.on('action', async (payload) => { ... })`):
    - Validate `deskId`, `action`, optional `amount`
    - Call `handlePlayerAction({ deskId, userId, action, amount })`
    - If `needsShowdown`: call `handleNeedsShowdown(deskId)`; return
    - If `progression === 'nextRound'`: emit `game:roundAdvance` (redacted broadcast)
    - Else: emit `game:action` (redacted broadcast)
    - After action, check all-in runout condition and call `handleAllInRunout` if met
    - Emit targeted `turn:start` to the new `currentTurnPlayer`
    - On error: `targetedEmit` the `error` event

12. **`leave` handler** (`socket.on('leave', async (payload) => { ... })`):
    - Call `userLeavesSeat({ deskId, userId })`
    - `socket.leave(deskId)`
    - `runtime.userSockets.delete(userId)`
    - If `needsShowdown`: call `handleNeedsShowdown(deskId)`; return
    - `broadcastDeskState(deskId, 'player:left', updatedDesk)`
    - If `updatedDesk.status === 'closed'`: emit `desk:closed`; clean up `deskRuntime` entry
    - On error: `targetedEmit` the `error` event

13. **`disconnect` handler**: remove from `userSockets` for any desks the socket was registered in. Do NOT call `userLeavesSeat` (3-skip handles eviction in 5.2).

### Resolved decisions (do not re-derive)
- Seating is socket-only via `join` event — no REST endpoint exists
- Broadcasts are redacted (holeCards stripped); targeted hole-card emit follows `game:start`
- `error` is a targeted S→C event `{ code: string, message: string }`
- `DeskRuntimeState.userSockets` is the sole userId→socketId map; keep it updated on join, leave, disconnect
- `turnTimer` and `skipCounts` fields exist in the struct but are unused until task 5.2 — initialize to `null` / empty Map

### Constraints
- NO game logic in server.ts — every decision is a gameService call
- NO `withDeskLock` calls from server.ts — the service functions already acquire the lock internally
- NO relative imports — `@/` alias only
- `server.ts` is NOT a Next.js route — it is a standalone Node process; use `http.createServer` + `new Server(httpServer)`
- Do NOT touch any Level 1 or Level 2 files
- `src/hooks/useSocket.ts` is NOT modified — client-side hook, deferred to Phase 6

---

## docs/HANDOFF.md write template

```markdown
## [Task name] — [PASS / FAIL / NEEDS DECISION]

### What was done
[2-3 sentences max]

### Files changed
- path/to/file.ts (created / modified / deleted)

### New files — suggested docs/KEEP.md level
- `src/path/to/file.ts` — Level N (reason)

### USER_API_CHANGES.md impact
[None] OR [describe the change]

### Commands run and output
[command]
[output]

### Checks
- [x] TypeScript compiled cleanly (npx tsc --noEmit)
- [x] Tier-1 smoke tests passed (only if Level 2 was touched)

### Open questions for Claude Desktop
1. [question — only if genuinely blocked]
```
