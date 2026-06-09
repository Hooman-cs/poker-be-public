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

**Phase 6, Task 6.1 — Admin shared components: Sidebar, Header, SearchInput**

### Context
Phase 6 is the admin frontend. All backend admin API routes (Phase 4) are complete.
shadcn/ui and Tailwind are available. lucide-react is already in dependencies.
Design aesthetic: dark sidebar (slate-900), clean white/light content area, calm and readable.
Target look: Claude.ai interface — not flashy, just calm + professional.

### Files to read first
- `docs/ARCHITECTURE.md` — "Admin panel scope & screens" and "Conventions" sections
- `src/app/layout.tsx` — understand existing root layout
- `tailwind.config.ts` — confirm theme tokens before using custom colors

### Files to create
- `src/components/admin/Sidebar.tsx`
- `src/components/admin/Header.tsx`
- `src/components/admin/SearchInput.tsx`

### Sidebar.tsx — 'use client'
Dark sidebar: `bg-slate-900 text-white`, `w-64`, `min-h-screen`, fixed left.
Top: app name "Poker Admin" in bold white text.
Nav items — use Next.js `Link` + `usePathname` for active state detection:
  - Overview → /admin/overview (icon: LayoutDashboard)
  - Statistics → /admin/statistics (icon: BarChart2)
  - Users → /admin/users (icon: Users)
  - Transactions → /admin/transactions (icon: ArrowLeftRight)
  - PG Transactions → /admin/pgTransactions (icon: CreditCard)
  - Poker → /admin/poker (icon: Layers)
  - Game List → /admin/gameList (icon: List)
Active link: `bg-white/10 rounded-md`. Hover: `hover:bg-slate-800`.
All icons from `lucide-react` at size 18.

### Header.tsx — server component (no hooks)
Props: `{ title: string; subtitle?: string }`
Clean bar: `bg-white border-b px-6 py-4`.
Title: `text-xl font-semibold text-gray-900`. Subtitle (optional): `text-sm text-gray-500`.

### SearchInput.tsx — 'use client'
Props: `{ value: string; onChange: (val: string) => void; placeholder?: string }`
Relative wrapper `div`. `Search` icon from lucide-react, absolute-positioned left-inside.
Input: `pl-9 pr-4 py-2`, `border border-gray-300 rounded-md`, focus ring, `w-full`.

### Constraints
- 'use client' on Sidebar (uses `usePathname`) and SearchInput. Header: server component.
- `@/` imports only. PascalCase filenames. No barrel `index.ts`.
- Pure presentational — no API calls, no business logic.
- lucide-react is already installed — do NOT modify package.json.
- shadcn/ui components (Button, Input) may be used ONLY if already present under
  `src/components/ui/`. If not present, use plain Tailwind HTML elements.

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
