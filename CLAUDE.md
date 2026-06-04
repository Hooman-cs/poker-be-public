# CLAUDE.md — Poker Project Briefing

Read this file COMPLETELY before doing anything else. Every rule here
is load-bearing. Skimming it produces integration bugs.

---

## What this project is

Next.js 14 App Router, TypeScript only. This repo contains:
- Complete backend (auth, user routes, lobby, payments, game engine, models).
- Admin-side Next.js frontend (`src/app/admin/**`).

A separate user-side mobile app (which we own — `ApiCaller.js`) consumes
the user-facing API. Those endpoint shapes are LOCKED.

Tech stack: Next.js 14, MongoDB/Mongoose, Socket.io (port 3001), Razorpay.
Environment: user works in **PowerShell / VS Code on Windows** (`P:\poker`).

---

## Source-of-truth hierarchy (resolve every conflict this way)

1. **KEEP.md (5-level freeze system)** — defines what can and cannot be edited.
2. **USER_API_CHANGES.md** + non-auth sections of `docs/user_api_contracts.pdf` — the mobile app contract.
3. **TASKS.md** — the live work tracker.
4. **CONTRACTS.md** — precise signatures for every cross-phase callable. Read before writing a caller.
5. **ARCHITECTURE.md** — file structure and conventions.
6. **LOGS.md** — decision history. Grep `[INVARIANT]` before touching anything.
7. **FUTURE_V2.md** — deliberately deferred items. Do NOT implement these in v1.

The previous developer's code is NOT authoritative. `docs/archive/` is historical only.

---

## KEEP.md — the 5-level freeze system

**Level 1 — Architectural Bedrock.** Never edit without cross-project justification.
- `src/config/constants.ts`, `src/models/user.ts`, `src/models/wallet.ts`, `src/utils/jwt.ts`

**Level 2 — Core Logic.** Surgical fixes allowed with: LOGS.md entry + Tier-1 smoke test pass.
- `src/engine/gameEngine.ts`, `src/engine/handEvaluator.ts`, `src/engine/potCalculator.ts`, `src/services/gameService.ts`

**Level 3 — Data Models.** Additive changes OK; breaking changes need a migration plan.
- All other models in `src/models/`.

**Level 4 — Boundary Helpers.** Normal review; don't break callers.
- `src/lib/auth/`, `src/lib/api/`, `src/types/`, `src/middleware.ts`, `src/utils/helpers.ts`, `src/config/dbConnect.ts`

**Level 5 — Operational Scripts.** Free to edit.
- `scripts/createAdmin.ts`, `scripts/changeAdminPassword.ts`, `scripts/playOneHand.ts`, `scripts/playThreeHands.ts`, `scripts/playLifecycle.ts`

**Rule:** touching Level 1 or 2 without a LOGS.md unlock receipt is a violation.

---

## Tier-1 smoke tests — run after any Level 2 change

```bash
npx tsx --env-file=.env.local scripts/playOneHand.ts
npx tsx --env-file=.env.local scripts/playThreeHands.ts
npx tsx --env-file=.env.local scripts/playLifecycle.ts
```

All three must pass. Failure means the change is wrong, not the test.
These caught 6 real bugs in Phase 1 from code that was "frozen."

---

## Conventions (apply everywhere, no exceptions)

- **Money** = integer minor units everywhere (paise/cents). API edge: `serializeMoney`/`parseAmount` from `src/lib/api/money.ts`. Outbound responses send formatted strings (`"₹12.34"`). Inbound bodies send integers.
- **Admin auth** = httpOnly cookie named `token`.
- **User auth** = Bearer token in `Authorization` header.
- **JWT roles** = `'admin'` for admins, `'user'` for users. Must be explicit on sign — `signToken` makes role optional which is a trap.
- **Success status** = `'completed'` everywhere (not `'successful'`, not `'success'`).
- **Timestamps** = `timestamps: true` on every schema (gives `createdAt`/`updatedAt`). No manual date fields.
- **Imports** = `@/` alias only. No relative paths. No `index.ts` barrel files.
- **File naming** = camelCase `.ts`, PascalCase `.tsx` React components.
- **Routes** = thin handlers that call services. No business logic in route files.
- **Always `await dbConnect()`** before any DB operation in a route or script.
- **Game types** = only `"Texas Hold'em"` and `'Omaha'` in v1. Stud/Razz/5-Draw → FUTURE_V2.md.
- **minToStart** (admin-configured) vs **minToContinue** (warm-floor, default 3) are separate fields on PokerDesk.

---

## Boundary invariants (violating these creates silent bugs)

- **Service↔engine boundary:** every value passed into engine functions MUST be a plain object. Mongoose subdocs look like the right type but spread wrong. Use `const plainPlayer: IGamePlayer = { userId: ..., balanceAtTable: ..., ... }` before passing to engine. This was a real Phase 1 bug.
- **Button position is canonical.** SB/BB/UTG are all derived from `desk.buttonSeatNumber`. Never hardcode position-by-index.
- **Round closure only counts active+all-in players.** Folded players' bets must be excluded from the "are all bets equal" check.
- **Post-flop first-actor is button-relative** (first active seat clockwise of button). Not array-index-0.
- **`desk.seats` is arrival-ordered, not seat-number-ordered.** Sort by `seatNumber` before any clockwise-walk logic.

---

## File structure (quick reference — see ARCHITECTURE.md for full)

```
src/
  app/api/          ← route handlers (thin, call services)
  app/admin/        ← admin Next.js pages/components
  app/auth/         ← login page
  config/           ← constants.ts (frozen), dbConnect.ts
  engine/           ← gameEngine, handEvaluator, potCalculator (frozen)
  lib/auth/         ← requireUser, requireAdmin
  lib/api/          ← money.ts, errors.ts
  models/           ← Mongoose schemas
  services/         ← gameService.ts (frozen), future service files
  types/            ← shared DTOs (pokerModelTypes.ts)
  utils/            ← jwt.ts (frozen), helpers.ts
scripts/            ← CLI tools and smoke tests (repo root, NOT under src/)
```

---

## Working style — CRITICAL

This is a **consultative collaboration**, not a task executor.
The user values design discussion before implementation. Follow this process:

### Before implementing any non-trivial task:
1. **Read the relevant CONTRACTS.md entry** for every function you'll call.
2. **Re-read the actual model/schema** for every `Model.create()` or schema-touching call. Grep `required:` on every model you seed. This is the single most effective bug-prevention habit.
3. **State which files you'll touch** and what the change is. One sentence per file.
4. **If there are 2+ reasonable approaches**, present them as Option A / Option B with trade-offs. Wait for the user to choose.
5. **Ask ONE clarifying question** if anything is genuinely ambiguous. Wait for the answer before writing code.
6. **Wait for "go" or "ok" before writing code.**

### When writing:
- One file per turn unless explicitly told otherwise.
- Stop and wait for review after each file.
- Update CONTRACTS.md in the **same turn** as any code that changes a callable's signature.
- Capture decisions in LOGS.md with `[INVARIANT]` tags when they're binding for future phases.
- If you disagree with a direction, say so with reasons before proceeding.
- If you see a downstream consequence the user might not have considered, flag it.

### When something feels wrong:
Do not silently implement the wrong thing. Say: "I want to flag something before proceeding: [reason]."

---

## Token efficiency rules (follow these to stay within context limits)

### What to skip:
- Do NOT re-summarize what you just did in a long paragraph after presenting a file.
- Do NOT explain what a function does if the code is self-evident.
- Do NOT preface code with "Here is the file:" — just write the code.
- Do NOT repeat information already in CLAUDE.md or CONTRACTS.md when answering a question.
- Do NOT read a file you already read earlier in the same conversation unless it changed.

### What to do instead:
- After presenting a file: one or two sentences on (a) any non-obvious design choice and (b) any downstream risk. Then stop.
- If a task is mechanical (rename a field everywhere, add an import), do it without a design-discussion preamble.
- When presenting options, use a compact table or bullet list — not paragraphs.

### File reading discipline:
- Read specific sections (`sed -n 'START,ENDp'`) rather than whole files when you only need part.
- Re-read schemas BEFORE writing code that touches them — but only the required-fields section if that's all you need.
- Check CONTRACTS.md for function signatures before writing callers — but only the relevant entry.

### Conversation discipline:
- If the user says "go" or "ok" or "next" — that means the previous decision is confirmed. Do not re-ask.
- If something was decided three turns ago and is in the docs, it's decided. Don't re-surface it.
- If a question has been answered (e.g. "Option A"), execute Option A. Don't re-present the options.

---

## Discipline gotchas (lessons from Phase 1 — do not repeat)

- **Re-read schemas before coding.** The Phase 1 smoke test required 8 iterations because of missing required fields caught at runtime. Habit: `grep "required:" model.ts` before writing any seed or create call.
- **Integration bugs live at handoffs.** The engine spread a Mongoose subdoc and got `undefined` fields → NaN → crash. The service is the ONLY place Mongoose docs meet the pure engine. Always construct a plain typed object before crossing the boundary.
- **Style rules are global.** No `// ====` divider comment patterns. Ever. This was explicitly rejected in Phase 0 and kept reappearing.
- **`seats` array is arrival-ordered.** Walking it by index for clockwise rotation is wrong. Sort by `seatNumber` first.
- **Validation runs BEFORE pre-save hooks.** The `bType` auto-set hook fires after validation — so required `bType` fields must still be passed explicitly to `Model.create()`.
- **The mongoose `desk.seats` type doesn't align with `ISeat[]`.** Use `as unknown as ISeat[]` cast at the service↔engine boundary.

---

## Docs update discipline

After any Phase task is complete:
- TASKS.md: mark the task `[x]`.
- CONTRACTS.md: update the entry for any changed signature.
- LOGS.md: add an `[INVARIANT]` entry if the change creates a new rule downstream phases must respect.
- KEEP.md: update if a new file needs a freeze level assigned.

Do NOT skip these updates. Docs that drift become lies, which is worse than no docs.

---

## What NOT to build (v1 scope guard)

Check FUTURE_V2.md before building anything that sounds like:
- Grace period / dissolution timer for desk closure.
- Sitting-out / disconnected player states (Phase 5 socket work).
- Anti-ratholing enforcement.
- Tournament mode.
- Stud / Razz / Five-Card Draw game types.
- Per-hand rake (commission is per-session on leave, Phase 3/4).
- Auto-fold timer (Phase 5 socket work).
- Heads-up (2-player) tables.

If a task description touches one of these, STOP and flag it before implementing.