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

**Phase 6, Task 6.8 — Pages: pokerDesk/[pokerModeId], pokerDesk/details/[deskId], gameList**

### Context
Three server pages + two client components. Same CRUD pattern as 6.7.
No new GET-by-id endpoint exists for desks — the detail page fetches all desks
and filters by id. The game list page uses the same games endpoint as statistics
but is a focused list view rather than an analytics view.

### Files to read first
- `src/lib/admin/fetchAdmin.ts`
- `docs/CONTRACTS.md` entries:
  - GET/POST /api/admin/pokerDesks
  - PUT/DELETE /api/admin/pokerDesks/[id]
  - GET /api/admin/analytics/games (for gameList page)

### Files to create
- `src/components/admin/poker/DeskCreateForm.tsx`
- `src/components/admin/poker/DeskRowActions.tsx`
- `src/app/admin/pokerDesk/[pokerModeId]/page.tsx`
- `src/app/admin/pokerDesk/details/[deskId]/page.tsx`
- `src/app/admin/gameList/page.tsx`

---

### 1. DeskCreateForm.tsx — 'use client'
Props: `{ pokerModeId: string }`
Collapsible form (same toggle pattern as 6.7 forms).
State: `open`, `tableName`, `minToStart` (default "4"), `minToContinue` (default "3"),
  `maxPlayerCount` (default "6"), `isPractice: boolean`, `loading`, `error`.

Fields:
- tableName: text input, required
- minToStart: number input (min 3)
- minToContinue: number input (min 3)
- maxPlayerCount: number input (min 3)
- isPractice: checkbox "Practice desk"

Client validation: maxPlayerCount >= minToStart, minToContinue <= minToStart
On submit: `POST /api/admin/pokerDesks` with
  `{ pokerModeId, tableName, minToStart: parseInt, minToContinue: parseInt,
     maxPlayerCount: parseInt, isPractice }`
On success: close + clear + `router.refresh()`
On error: show `body.message`

---

### 2. DeskRowActions.tsx — 'use client'
Props: `{ id: string; currentStatus: string }`
State: `status`, `loading`, `confirmDelete`, `error`

Controls:
- Status select: `active` / `disabled` only (`closed` is engine-only — NEVER include it)
  + "Update" button → `PUT /api/admin/pokerDesks/${id}` with `{ status }`
- Delete with two-step confirm → `DELETE /api/admin/pokerDesks/${id}`
- Both `router.refresh()` on success

---

### 3. src/app/admin/pokerDesk/[pokerModeId]/page.tsx — server component
Page params: `{ params: { pokerModeId: string } }`

Fetches (parallel):
```ts
const [modesData, desksData] = await Promise.all([
  fetchAdmin('/api/admin/pokerModes', { pokerId: '' }),  // fetch all modes to find this one
  fetchAdmin('/api/admin/pokerDesks', { pokerModeId }),
]);
// find the mode by id to get its display name
const mode = modesData.modes.find((m: ModeShape) => m.id === pokerModeId);
```

Desk response shape (CONTRACTS.md GET /api/admin/pokerDesks):
```ts
{ desks: Array<{
  id: string; pokerModeId: string; tableName: string;
  gameType: string; bType: string; mode: string; currency: string;
  status: 'active' | 'disabled' | 'closed';
  stake: string; minBuyIn: string; maxBuyIn: string;
  minToStart: number; minToContinue: number;
  maxPlayerCount: number; maxSeats: number;
  seatedCount: number; currentGameStatus: string;
  buttonSeatNumber: number | null; firstGameStartedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}> }
```

Layout:
```tsx
<Header
  title={mode ? `${mode.gameType} — ${mode.stake} stake` : 'Desks'}
  subtitle={`${desks.length} desk${desks.length !== 1 ? 's' : ''}`}
/>
<div className="p-6">
  <DeskCreateForm pokerModeId={pokerModeId} />
  <div className="bg-white rounded-lg border border-slate-200">
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-200">
          <th>Table name</th>
          <th>Status</th>
          <th>Seated</th>
          <th>Game</th>
          <th>Min/Max players</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {desks.map(d => (
          <tr key={d.id} className="border-b border-slate-100">
            <td>
              <Link href={`/admin/pokerDesk/details/${d.id}?modeId=${pokerModeId}`}
                className="font-medium text-indigo-600 hover:underline text-sm">
                {d.tableName}
              </Link>
            </td>
            <td>{StatusBadge(d.status)}</td>
            <td className="text-sm text-slate-600">{d.seatedCount} / {d.maxSeats}</td>
            <td className="text-sm text-slate-500">{d.currentGameStatus}</td>
            <td className="text-sm text-slate-500">{d.minToStart} – {d.maxPlayerCount}</td>
            <td><DeskRowActions id={d.id} currentStatus={d.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
    {desks.length === 0 && (
      <p className="text-center text-sm text-slate-400 py-8">No desks yet.</p>
    )}
  </div>
</div>
```

Inline helpers:
```ts
interface ModeShape { id: string; gameType: string; stake: string; mode: string; }
function StatusBadge(status: string) { /* active=emerald, disabled=slate, closed=red */ }
```

---

### 4. src/app/admin/pokerDesk/details/[deskId]/page.tsx — server component
Page params: `{ params: { deskId: string } }`
Reads `searchParams`: `modeId` (for back-navigation link — may be absent)

Fetch: `fetchAdmin('/api/admin/pokerDesks')` (all desks, no filter)
Find desk: `desks.find(d => d.id === deskId)` — if not found render "Desk not found".

Layout (read-only config view — no edit form, editing done from list via DeskRowActions):
```tsx
<Header title={desk.tableName} subtitle="Desk detail" />
<div className="p-6 space-y-6">

  {/* Back link */}
  {searchParams.modeId && (
    <Link href={`/admin/pokerDesk/${searchParams.modeId}`}
      className="text-sm text-indigo-600 hover:underline">
      ← Back to desks
    </Link>
  )}

  {/* Config card */}
  <div className="bg-white rounded-lg border border-slate-200 p-5">
    <h2 className="text-sm font-medium text-slate-700 mb-4">Configuration</h2>
    <dl className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
      <dt className="text-slate-500">Game type</dt>
      <dd className="col-span-2 text-slate-900">{desk.gameType}</dd>
      <dt className="text-slate-500">Mode</dt>
      <dd className="col-span-2">{ModeBadge(desk.mode)}</dd>
      <dt className="text-slate-500">Status</dt>
      <dd className="col-span-2">{StatusBadge(desk.status)}</dd>
      <dt className="text-slate-500">Stake (SB)</dt>
      <dd className="col-span-2 text-slate-900">{desk.stake}</dd>
      <dt className="text-slate-500">Buy-in range</dt>
      <dd className="col-span-2 text-slate-900">{desk.minBuyIn} – {desk.maxBuyIn}</dd>
      <dt className="text-slate-500">Min to start</dt>
      <dd className="col-span-2 text-slate-900">{desk.minToStart}</dd>
      <dt className="text-slate-500">Min to continue</dt>
      <dd className="col-span-2 text-slate-900">{desk.minToContinue}</dd>
      <dt className="text-slate-500">Max players</dt>
      <dd className="col-span-2 text-slate-900">{desk.maxSeats}</dd>
      <dt className="text-slate-500">Currency</dt>
      <dd className="col-span-2 text-slate-900">{desk.currency}</dd>
    </dl>
  </div>

  {/* Live status card */}
  <div className="bg-white rounded-lg border border-slate-200 p-5">
    <h2 className="text-sm font-medium text-slate-700 mb-4">Live status</h2>
    <dl className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
      <dt className="text-slate-500">Seated</dt>
      <dd className="col-span-2 text-slate-900">{desk.seatedCount} / {desk.maxSeats}</dd>
      <dt className="text-slate-500">Current game</dt>
      <dd className="col-span-2 text-slate-900">{desk.currentGameStatus}</dd>
      <dt className="text-slate-500">First hand at</dt>
      <dd className="col-span-2 text-slate-900">
        {desk.firstGameStartedAt
          ? new Date(desk.firstGameStartedAt).toLocaleString('en-IN') : '—'}
      </dd>
      <dt className="text-slate-500">Created</dt>
      <dd className="col-span-2 text-slate-900">
        {new Date(desk.createdAt).toLocaleDateString('en-IN')}
      </dd>
    </dl>
  </div>

</div>
```

Inline helpers (same StatusBadge/ModeBadge pattern as task 6.7 mode page).

---

### 5. src/app/admin/gameList/page.tsx — server component
Reads `searchParams`: `page` (default "1"), `gameType`.

Fetch: `fetchAdmin('/api/admin/analytics/games', { page, limit: '20', gameType })`

Response (CONTRACTS.md 4.13): `{ games[], pagination }`

Layout:
```tsx
<Header title="Game list" subtitle={`${pagination.total} total`} />
<div className="p-6">
  {/* Filter bar */}
  <div className="flex gap-3 mb-4">
    ...gameType filter links or a client component...
  </div>
  <div className="bg-white rounded-lg border border-slate-200">
    <table>...</table>
    {/* pagination */}
  </div>
</div>
```

Keep the filter simple: no client component needed. Render static links:
```tsx
<div className="flex gap-2 mb-4">
  {["", "Texas Hold'em", "Omaha"].map(gt => (
    <Link key={gt} href={`/admin/gameList?gameType=${encodeURIComponent(gt)}&page=1`}
      className={`text-sm px-3 py-1.5 rounded border ${
        gameType === gt
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}>
      {gt || 'All'}
    </Link>
  ))}
</div>
```

Table columns: ID | Desk | Type | Pot | Players | Duration | Date | Winners
- ID: mono truncated `...${g.id.slice(-8)}`
- Desk: `g.deskId.slice(-8)` mono (no desk name available in this endpoint)
- Type: `text-sm text-slate-600`
- Pot: `text-sm font-medium text-slate-900`
- Players: `g.playerCount`
- Duration: `${Math.floor(g.durationSeconds/60)}m ${g.durationSeconds%60}s`
- Date: `new Date(g.completedAt).toLocaleDateString('en-IN')`
- Winners: `g.players.filter(p => p.isWinner).map(p => p.username).join(', ')`

Pagination: URL links preserving `gameType` param.

---

### Constraints
- `DeskCreateForm`, `DeskRowActions`: 'use client'. All three pages: server components.
- `status: 'closed'` is NEVER settable via the UI — engine-only per CONTRACTS.md invariant.
  DeskRowActions status select must only offer `active` and `disabled`.
- `@/` imports only. PascalCase filenames. No barrel index.ts.
- `router.refresh()` after all mutations.
- Delete: two-step confirm as in 6.7.
- Do NOT add new npm packages.

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
