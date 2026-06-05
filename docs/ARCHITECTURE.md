# ARCHITECTURE.md — File Structure & Conventions

The durable record of where code lives and the conventions every new file
follows. Locked at start of Phase 1; changes require the same deliberate
process as a KEEP.md edit (discuss first, document the change).

---

## Design principles

These are the principles every "where does this file go?" question is
answered against. When the question is hard, return here.

**1. Group by what something IS, not what it's ABOUT.** Routes go with routes,
types with types, helpers with helpers. The cross-cutting concern (this file
is "about" a user) lives in the filename, not the path.

**2. Colocate things that change together. Separate things that change
independently.** A route and its inline DTO type can sit together; a route
and an unrelated utility need not.

**3. Depth is a cost.** Default to flat. Nest only when there's a genuine
subgroup with three or more files.

**4. Names should be predictable.** If two reasonable people are asked "where
is X?" they should answer the same place. If they don't, the structure failed.

---

## The full tree

```
src/
├── app/                              # Next.js App Router (URL-driven)
│   ├── api/
│   │   ├── auth/
│   │   │   └── google/route.ts       # POST — Google ID token verify (Phase 3.1)
│   │   ├── user/
│   │   │   ├── username/
│   │   │   │   ├── route.ts          # PATCH — set username once (Phase 3.2)
│   │   │   │   └── suggestions/route.ts  # GET — available name suggestions
│   │   │   ├── wallet/
│   │   │   │   ├── route.ts          # GET — balances
│   │   │   │   └── transactions/route.ts # GET — paginated history
│   │   │   ├── banks/
│   │   │   │   ├── route.ts          # GET / POST — list / add
│   │   │   │   └── transactions/route.ts # GET / POST — history / create
│   │   │   └── games/
│   │   │       └── history/route.ts  # GET — user's archived hands
│   │   ├── payments/
│   │   │   └── razorpay/
│   │   │       ├── order/route.ts    # POST — create gateway order
│   │   │       └── verify/route.ts   # POST — HMAC verify + credit wallet
│   │   ├── lobby/
│   │   │   ├── games/route.ts        # GET — active games + live stats
│   │   │   └── desks/
│   │   │       └── best/route.ts     # GET — matchmaking
│   │   └── admin/                    # All admin endpoints (Phase 4)
│   │       ├── auth/
│   │       │   └── login/route.ts        # POST — bcrypt + 6h JWT cookie
│   │       ├── users/
│   │       │   ├── route.ts              # GET — paginated list
│   │       │   └── [userId]/
│   │       │       ├── route.ts          # GET — detail
│   │       │       ├── status/route.ts   # PATCH — status update
│   │       │       └── balance/route.ts  # POST — add/remove lockedBonus
│   │       ├── bankTransactions/
│   │       │   ├── route.ts              # GET — list (populate bankAccountId)
│   │       │   └── [transactionId]/
│   │       │       └── status/route.ts   # PATCH — approve/reject (GST/ACID rules)
│   │       ├── pmgTransactions/
│   │       │   └── route.ts              # GET — flattened gateway list
│   │       ├── poker/
│   │       │   ├── route.ts              # GET / POST
│   │       │   └── [id]/route.ts         # PUT / DELETE
│   │       ├── pokerModes/
│   │       │   ├── route.ts              # GET / POST
│   │       │   └── [id]/route.ts         # GET / PUT / DELETE
│   │       ├── pokerDesks/
│   │       │   ├── route.ts              # GET / POST
│   │       │   └── [id]/route.ts         # GET / PUT / DELETE
│   │       └── analytics/
│   │           ├── dashboard/route.ts    # GET — aggregated stats
│   │           ├── games/route.ts        # GET — game list
│   │           └── users/
│   │               └── [userId]/route.ts # GET — per-user stats
│   │
│   ├── admin/                        # Admin pages (rebuild — Phase 6)
│   ├── auth/                         # Admin login page (rebuild)
│   ├── layout.tsx                    # FROZEN — root layout
│   ├── globals.css                   # FROZEN — Tailwind base
│   └── page.tsx                      # Root landing/redirect (rebuild)
│
├── config/
│   ├── constants.ts                  # FROZEN — money, timing, currency, constants
│   └── dbConnect.ts                  # FROZEN — Mongo connection with HMR cache
│
├── models/                           # FROZEN (all 12 files)
├── engine/                           # FROZEN (3 files)
├── services/
│   └── gameService.ts                # FROZEN
│   # Future services (walletService, userService, paymentService) live here
│   # if and when we find ourselves duplicating logic across routes.
│
├── lib/                              # NEW — app-specific cross-cutting code
│   ├── auth/
│   │   ├── requireUser.ts            # Phase 1.2 — Bearer token verifier
│   │   ├── requireAdmin.ts           # Phase 1.3 — cookie + role==='admin' check
│   │   └── googleVerify.ts           # Phase 3.1 — wraps google-auth-library
│   └── api/
│       ├── response.ts               # Phase 1.5 — { message, data } success helpers
│       ├── errors.ts                 # Phase 1.5 — ServiceError → HTTP status mapping
│       └── serializeMoney.ts         # Phase 1.4 — minor units → response shape
│
├── types/                            # NEW — shared, derived, transport-shaped types
│   ├── pokerModelTypes.ts            # Phase 1.1 — DTOs derived from model interfaces
│   ├── apiTypes.ts                   # Phase 3+ — request/response shapes (if needed)
│   └── socketTypes.ts                # Phase 5 — socket event payload shapes
│
├── utils/                            # FROZEN — tiny, generic, dependency-light
│   ├── jwt.ts                        # token sign/verify
│   └── helpers.ts                    # generateGamerName
│
├── hooks/                            # FROZEN
│   └── useSocket.ts
│
├── components/                       # Rebuild — admin frontend (Phase 6)
│
├── middleware.ts                     # Modify in place (Phase 1.6)
└── server.ts                         # Rebuild — standalone socket server (Phase 5)

scripts/                              # NEW — operational, repo root not src/
└── createAdmin.ts                    # Phase 1.7 — CLI admin seed

docs/
├── user_api_contracts.pdf            # User contract reference (non-auth sections binding)
├── ARCHITECTURE.md                   # This file
└── archive/
    ├── SPEC.md                       # Historical intent — NOT binding
    └── REBUILD_PLAN_V2.md            # Historical process — NOT binding
```

---

## Directory reasoning (the non-obvious choices)

### `src/lib/` vs `src/utils/`

These look interchangeable but they're not.

`src/utils/` is for **tiny, generic, dependency-light** helpers. `generateGamerName`
is the right fit — pure function, no business knowledge, no app dependencies.
The two files in `utils/` together are under 100 lines.

`src/lib/` is for **app-specific cross-cutting code**. The auth guards encode
our auth conventions (where the token comes from, what shape the payload has).
The response helpers encode our API conventions. The Google verify encodes
our auth-provider integration. These are not generic — they only make sense in
this app — but they're called by many routes, so they're not feature code either.

The rule: if it could be lifted out and used in any project, it's `utils/`.
If it only makes sense in *this* project but cross-cuts many features, it's `lib/`.

### `src/types/` separate from `src/lib/`

Types are pure declarations — no runtime, no logic, importable everywhere.
Keeping them in their own directory makes "is this import free or does it cost
something?" obvious. It also prevents circular-dependency landmines: types can
import from anywhere; lib functions import types but never the reverse.

### `src/services/` top-level (not under lib/)

Services are the business-logic-heaviest code in the system. They orchestrate
between routes/sockets and the models/engine/wallet. They deserve top-level
visibility because their importance is structural — they're a *layer*, not a
helper. `gameService.ts` is already the right model for what services look like.

### `scripts/` at the repo root, not `src/scripts/`

Scripts are operational — they run from the developer's shell, not as part of
the Next.js app. Putting them under `src/` would mean Next.js scans them as
part of the build. Repo-root is the standard convention.

---

## Conventions

### Files

- **TypeScript files** are camelCase: `requireUser.ts`, `serializeMoney.ts`.
- **React component files** are PascalCase if they default-export a component:
  `Sidebar.tsx`, `UserStats.tsx`.
- **Route files** are always `route.ts` (Next.js App Router requirement).
- **One file per substantial export.** Small grouped helpers can share a file
  (e.g. multiple typed errors in one `errors.ts`).

### Imports

- **Always use the `@/` alias.** Never relative paths like `../../../models/user`.
  Relative paths break on file move and obscure the dependency graph.
- **Never via barrels.** No `index.ts` re-exports. Always import from the actual
  file path: `import { requireUser } from '@/lib/auth/requireUser'`, not
  `from '@/lib/auth'`. Barrels look tidy but hide where things come from, cause
  bundler issues, and make refactors harder.
- **Group imports**: third-party → `@/models/...` → `@/engine/...` →
  `@/services/...` → `@/lib/...` → `@/types/...` → `@/utils/...`. Blank lines
  between groups.

### Routes

- **REST + resource folders.** Collections at `/resource`, items at `/resource/[id]`,
  sub-actions at `/resource/[id]/action`. HTTP verbs map to method handlers.
- **Routes are thin.** A route's job: auth check → input parse/validate → call
  service → shape response. Business logic lives in the service layer.
- **Routes own their request/response shapes.** Inline DTO types are fine for
  route-specific shapes. Promote to `src/types/` only when shared across multiple
  routes.

### Service-layer use

- Routes import service functions from `@/services/...`.
- Services throw typed `ServiceError` subclasses. Routes translate via
  `lib/api/errors.ts` to HTTP status codes — never re-implement the mapping inline.
- New service functions get a `CONTRACTS.md` entry in the same commit.

### Tests

- When tests are added (post-launch per the deferred decision), they live in a
  parallel `tests/` directory mirroring `src/`. NOT colocated with source files.
  Reason: tests for `gameService.ts` will be substantial; mixing them in
  `src/services/` would clutter navigation.

### Comments

- Comment WHY, not WHAT. The code shows what.
- Multi-section files use plain English headers, not ASCII-art dividers.
- Explanatory comments on non-obvious logic are encouraged (this is a working
  preference, not just style).

---

## What's NOT in this structure

A few directories that appear in many projects but we deliberately don't have:

**No `controllers/`.** In App Router, `route.ts` IS the controller. A
forwarding `controllers/` layer would be ceremony without value.

**No `validators/`.** Input validation is the route's job, inline. If we
adopt a schema library (Zod is the likely choice when Phase 3 starts), the
schema lives in the same route file or alongside it — not in a separate
"validators" directory.

**No `dto/`.** Route-specific DTOs are inline. Shared DTOs are in `src/types/`.
A separate `dto/` would just duplicate the question of "is it shared?"

**No `middleware/` directory.** Next.js exposes exactly one `src/middleware.ts`.
That's the only middleware, modified in place.

---

## Adding new code: the decision tree

Before creating a new file, walk this once:

1. **Is it a route handler?** → `src/app/api/...` per URL path.
2. **Is it a React component?** → `src/components/...`.
3. **Is it a service (orchestration / wallet writes / multi-step business flow)?**
   → `src/services/{name}Service.ts`.
4. **Is it cross-cutting app-specific code (auth, response shaping, formatters)?**
   → `src/lib/{group}/{name}.ts`.
5. **Is it a tiny generic helper?** → `src/utils/{name}.ts`.
6. **Is it a shared type with no runtime?** → `src/types/{name}.ts`.
7. **Is it operational (run from a shell, not part of the app)?** → `scripts/{name}.ts`.

If none of these fits cleanly, stop and discuss before creating it. A file
without a bucket is a smell.

---

## Bot subsystem (practice mode — Phase 5)

Design decisions locked in Phase 2:

**Identity.** Bots have synthetic `Types.ObjectId` values generated at runtime. No DB records,
no wallets. Practice mode skips all wallet operations (`isCashMode === false`), so a bot only
needs an ID to be seated via `addUserToSeat`.

**Interface.** Bots feed actions through the same `gameService.handlePlayerAction` path as real
players. The socket server calls `handlePlayerAction({ deskId, userId: botId, action, amount })`
on a bot's turn — the service layer has no knowledge of whether the actor is human or bot.

**Strategies.** Three pluggable implementations, each satisfying a `BotStrategy` interface with
a single `selectAction(gameState): { action, amount }` function:
- `easy` — folds weak hands, checks/calls otherwise, never raises
- `medium` — pot-odds-aware calling; raises on strong hands
- `hard` — position-aware; semi-bluffs; re-raises

The socket server resolves which strategy applies from the desk's practice difficulty setting.

**Ephemeral state.** Bot seat registry (which seats are bots, which strategy each uses) lives in
a `Map<deskId, BotSeat[]>` in the socket server process. Never persisted — on restart, practice
desks are abandoned.

**File location.** `src/lib/bots/` — pure strategy logic with no side effects. The in-memory
registry and turn driver live in `src/server.ts` (Phase 5).

---

## Live gameplay / socket design (Phase 5)

Design decisions locked in Phase 2:

**Event naming.** `namespace:verb` throughout. Server emits to all desk members unless noted.

| Event | Direction | Meaning |
|---|---|---|
| `player:joined` | S → C | A user sat down; includes updated desk state |
| `player:left` | S → C | A user left; includes updated desk state |
| `game:start` | S → C | New hand started; each recipient gets their own hole cards |
| `game:action` | S → C | A player acted; includes updated game state |
| `game:roundAdvance` | S → C | New community cards dealt; includes updated game state |
| `game:showdown` | S → C | Hand complete; pot results + winner breakdown |
| `desk:closed` | S → C | Desk force-closed; all players removed |
| `turn:start` | S → C (targeted) | It is this player's turn; includes 60s deadline |
| `turn:timeout` | S → C | Timer expired; player was auto-folded |
| `action` | C → S | Player submits an action `{ deskId, action, amount? }` |
| `leave` | C → S | Player requests to leave the desk |

**State broadcast.** Full desk state on every event. Desk documents are small; full-state
broadcasts are simpler and eliminate client drift from missed delta patches.

**Turn timer.** 60s, server-side `setTimeout` per turn. On expiry: auto-fold via
`handlePlayerAction({ action: 'fold' })`. Timer cancelled immediately on valid incoming action.
Configurable timer duration is deferred to FUTURE_V2.

**3-skip disconnect rule.** Per-player consecutive-auto-fold counter in the ephemeral server
state (same `Map` structure as the bot registry, keyed by `deskId`). Three consecutive
auto-folds (idle or disconnected) → `userLeavesSeat`. Counter resets on any voluntary action.

**Auto-start.** Server-driven only — no `startGame` client event. Two triggers:
1. After `player:joined`: if eligible seat count reaches the cold/warm gate threshold,
   wait 3s then call `createGame`.
2. After `game:showdown`: if the desk is still active, wait 3s then call `createGame`.
The 3s delay gives clients time to display results before the next hand begins.

**Ephemeral server state shape** (lives in `src/server.ts`, never persisted):
```ts
interface DeskRuntimeState {
  botSeats: Map<string, { strategy: 'easy' | 'medium' | 'hard' }>; // botUserId → config
  skipCounts: Map<string, number>;  // userId → consecutive auto-folds
  turnTimer: ReturnType<typeof setTimeout> | null;
  autoStartTimer: ReturnType<typeof setTimeout> | null;
}
const deskRuntime = new Map<string, DeskRuntimeState>(); // deskId → state
```

---

## Admin panel scope & screens (Phase 6)

Design decisions locked in Phase 2:

**Navigation model.** Sidebar with single active-link highlight. Poker management
drills down: Poker list → Modes (per poker) → Desks (per mode) → Desk detail.
Each level is a separate page; breadcrumb implied by the URL structure.

**Screen inventory** (maps to Phase 6 tasks):

| Screen / URL | Phase 6 task |
|---|---|
| `/auth/login` | 6.4 |
| `/admin/overview` | 6.4 — post-login landing; summary panels linking to sections |
| `/admin/statistics` | 6.5 |
| `/admin/users` | 6.5 |
| `/admin/users/[userId]` | 6.5 — embeds LatestGameHistory + UserBankTransactionsHistory |
| `/admin/transactions` | 6.6 |
| `/admin/pgTransactions` | 6.6 |
| `/admin/poker` | 6.7 |
| `/admin/pokerMode/[pokerId]` | 6.7 |
| `/admin/pokerDesk/[pokerModeId]` | 6.8 |
| `/admin/pokerDesk/details/[pokerDeskId]` | 6.8 |
| `/admin/gameList` | 6.8 |

**Embedded components.** `LatestGameHistory` and `UserBankTransactionsHistory` are
components embedded in the user detail page — not standalone screens.

---

## Edge-case catalog (Phase 5 implementation guide)

These are resolved design decisions, not open questions. Phase 5 must handle each.

**1. Timer/action race.**
Player sends `action` event at the same moment the server-side `setTimeout` fires.
Both paths call `handlePlayerAction` — the per-desk mutex serialises them; whichever
acquires the lock first wins. The loser gets `InvalidStateError('It is not your turn')`
and is silently discarded. The timer `clearTimeout` call must happen *inside* the lock
(after the action is applied) so the timer cannot fire between "action received" and
"lock acquired".

**2. Disconnect handling.**
Socket `disconnect` does NOT call `userLeavesSeat` immediately. The player's turn timer
continues normally; if it expires they are auto-folded. After three consecutive auto-folds
the 3-skip rule kicks in and forces a leave. On reconnect within the same hand: re-add
the socket to the desk room and emit current desk state — no seat change needed.

**3. All-in run-out after a mid-hand leave.**
`userLeavesSeat` sets `needsShowdown` only when `remaining ≤ 1`. But if a leave produces
`active === 0` with `allIn ≥ 2`, no one can bet — the board must run out automatically.
The socket server must check after every `userLeavesSeat` call:
```
if (!needsShowdown && activePlayers === 0 && allInPlayers >= 2) → loop advanceGameRound until showdown
```
Same check applies after every `handlePlayerAction` that results in `continue` or `nextRound`.

**4. Auto-start timer race.**
Two events could each schedule an `autoStartTimer` for the same desk (e.g. a player joins
during the 3s post-showdown window). Always `clearTimeout(existing)` before setting a new
one. Additionally, `createGame` throws `InvalidStateError` if the desk is closed or a game
is already in progress — catch and discard gracefully; do not crash the server.

**5. `needsShowdown` from `userLeavesSeat`.**
The socket handler for `leave` must check the returned `needsShowdown` flag and call
`showdown({ deskId })` immediately if true — same as the handler for `action`.
This is easy to forget because `leave` feels like a cleanup path, not a game-progression path.

**6. All-in on blind post.**
A player with exactly `stake` chips posts the big blind and goes all-in. The engine handles
this — `potCalculator` produces the correct side pot. The socket server has nothing special
to do; just follow the normal `needsShowdown` / run-out logic.

**7. Double-join on reconnect.**
`addUserToSeat` throws `AlreadySeatedError` if the user is already seated. The socket
server must check desk state on reconnect and *not* call `addUserToSeat` again if the
user already has a seat — just re-join the socket room and emit current state.

**8. Player leaves between hands (during auto-start window).**
`userLeavesSeat` between-hands may trigger `forceCloseDesk` if count drops below
`minToContinue`. When the `autoStartTimer` fires, `createGame` throws
`InvalidStateError('Desk is closed')`. Catch, emit `desk:closed` to remaining sockets,
clear the runtime state entry.

---

## When this file changes

Updating `ARCHITECTURE.md` is a deliberate act — not a casual addition. The
process:

1. Propose the change (new directory, new convention, structural shift).
2. Discuss the reasoning and trade-offs.
3. Update this file + log the decision in `LOGS.md`.
4. If the change requires moving existing files, that's a real task and goes
   in `TASKS.md`.

Small clarifications and example additions don't need this process; structural
changes do.
