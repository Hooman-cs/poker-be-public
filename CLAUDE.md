# CLAUDE.md — Poker Project Briefing

Read this fully before doing anything. This file defines what is locked, what
the source of truth is, and how you must behave in this repo.

---

## What this project is

Next.js 14 **App Router**, TypeScript only (`.ts` / `.tsx`). This repo contains:

- The complete backend (auth, user routes, lobby, payments, game engine, models).
- The admin-side frontend (the dashboard under `src/app/admin/**`).

A separate user-side mobile app (which we also own — `ApiCaller.js`) consumes
the user-facing API. The shapes of those user endpoints are LOCKED.

---

## Source-of-truth precedence (resolve every conflict this way)

1. **Frozen core** — `src/models/**`, `src/engine/**`, `src/services/gameService.ts`,
   `src/config/constants.ts`. See `KEEP.md`.
2. **Locked user contract** — `USER_API_CHANGES.md` + the non-auth sections of
   `docs/user_api_contracts.pdf`. The mobile app depends on these exact shapes.
3. **`TASKS.md`** — the live tracker for what to build next.
4. **`CONTRACTS.md`** — precise interface specs for cross-phase callables.
   Read the relevant entry BEFORE writing a caller.
5. **`ARCHITECTURE.md`** — the file structure and conventions every new file follows.
6. **`LOGS.md`** — decision history with `[INVARIANT]` tags downstream code MUST respect.

Anything else (admin routes, components, pages, internal naming) is OURS to design.
The previous developer's choices are NOT authoritative. `docs/archive/` contains
historical artifacts kept only for reference — never binding.

If a piece of code conflicts with the frozen core or the locked user contract,
the code is wrong. If a piece of code conflicts with anything in level 3 and
below, talk first; those can be updated.

---

## LOCKED — see KEEP.md for the level system

`KEEP.md` defines 5 levels of "frozen-ness," from Level 1 (Architectural
Bedrock — money helpers, identity model, JWT, wallet) down to Level 5
(Operational Scripts — free to edit).

Most engine and service code is **Level 2** (Core Logic) — surgical bug
fixes are allowed *with* a documented reason in LOGS.md and a Tier-1
smoke test pass.

Most schema models are **Level 3** — additive changes are normal; breaking
changes need a migration plan.

Auth guards, API helpers, types, middleware are **Level 4** — normal
review, don't break callers.

If you believe a Level 1 or Level 2 file has a real bug, STOP and discuss —
do not edit without the unlock receipt in LOGS.md.

---

## Tier-1 smoke tests — your safety net for engine changes

Three scripts in `scripts/` exist to prove the frozen core works
end-to-end. Run BEFORE making any Level 2 change and AFTER:

- `playOneHand.ts` — 9 checks, 3-player Hold'em hand.
- `playThreeHands.ts` — 14 checks, button rotation across hands.
- `playLifecycle.ts` — full lifecycle: cold-start, warm play, mid-hand
  leave, warm-floor play, force-closure on drop below minToContinue.

Phase 1 found **3 real bugs in nominally-frozen code** using these tests
(plus 3 from the Phase 0 audit). They are load-bearing.

[INVARIANT] All three tests must continue to pass for any future Level 2
change. Failure means the change is wrong, not the test.

---

## Conventions (apply consistently everywhere)

- **Admin auth** = httpOnly cookie named `token`, read via `cookies().get('token')`.
- **User auth** = Bearer token in the `Authorization` header.
- **JWT role** = the admin model issues `role: 'admin'`. Every admin route authorizes
  on `payload.role === 'admin'`. There is NO `superadmin`.
- **Money** is INTEGER MINOR UNITS everywhere (paise/cents). Conversion happens
  only at the API edge via `toMinor`/`toMajor`/`formatMoney` from `constants.ts`.
- **Currencies** are tagged on every money-bearing model. INR (`₹`) and USD (`$`)
  are supported; default is INR.
- **Success state** is `'completed'` everywhere — not `'successful'`.
- **Timestamps** via `timestamps: true` (`createdAt` / `updatedAt`) — not custom date fields.
- One concern per file. Route handlers stay thin; orchestration lives in the service layer.
- Always `await dbConnect()` first; always wrap in try/catch with proper status codes.

---

## File structure & where things go

See `ARCHITECTURE.md` for the full layout. Quick reference:

- Models, engine, service, constants → frozen (do not edit).
- New cross-cutting helpers → `src/lib/` (auth guards in `src/lib/auth/`,
  API response/error/serialization in `src/lib/api/`).
- New shared types → `src/types/`.
- Tiny generic helpers → `src/utils/`.
- New API routes → `src/app/api/...` (App Router convention).
- New operational scripts → `scripts/` at repo root.

No `index.ts` re-exports. Always use the `@/` alias. Always import from the
actual file path, never via a barrel.

---

## Rules of engagement (how you must work)

- Before writing code for a task, state a short plan and which files you'll
  touch. Then STOP for OK.
- Work on **one file or one tightly-scoped slice at a time**. After each,
  STOP and wait for review.
- Never edit anything in `KEEP.md` without an unlock discussion first.
- Never change a user-facing request/response shape — those are locked by
  the mobile app's dependency.
- When writing a caller, read the relevant `CONTRACTS.md` entry FIRST. The
  catalog is the truth for what cross-phase callables accept and return.
- After writing or changing a callable's behavior, update its `CONTRACTS.md`
  entry in the SAME COMMIT. Entries that drift become lies, which is worse
  than not having them.
- Capture meaningful decisions in `LOGS.md` as they happen. Use `[INVARIANT]`
  for rules downstream phases MUST respect.
- If something is ambiguous, ask ONE clarifying question rather than guessing.
- Prefer deleting commented-out legacy over leaving it. (User rollback comments
  are an exception — those get stripped at commit-and-freeze time.)

---

## Discipline gotchas (lessons we've already learned)

- **Re-read the actual schema/code before writing code that touches it.**
  The Phase 1 smoke test went through 8 iterations of "missing required field"
  errors because I patched instead of auditing. **Habit: before any
  `Model.create({...})` call, grep `required:` on the model first.**
- **Integration bugs live at function-to-function handoffs.** Phase 1 found
  the spread-on-Mongoose-subdoc bug (engine spreading a subdoc loses data
  fields) at the service↔engine boundary. The service is the ONLY place
  Mongoose docs meet the pure engine; every value crossing that boundary
  must be a plain object (`const plainPlayer: IGamePlayer = { ... }`).
- **Style rules from earlier phases stay in effect.** I drifted on the
  no-divider-comments rule in Phase 1 (`// ====` was used in 3 files; user
  caught it). Style rules are global, not phase-local.
- **The mongoose `desk.seats` type doesn't quite line up with `ISeat[]`.**
  Until `pokerModelTypes.ts` provides a clean helper, the `as unknown as
  ISeat[]` cast is the pragmatic workaround.
- **Phase 0 audit didn't catch boundary bugs.** Straight-line happy paths
  passed; mixed check/raise/fold flop didn't (the round-closure-with-folds
  bug). Lesson for future audits: exercise *combinations* of states, not
  just sequential ones.

---

## Chat-handoff guidance

The chat history grows with every turn, eventually hitting context limits.
Phase boundaries are natural points to switch to a fresh chat.

Opening a new chat after a phase closes:
1. Read this file (CLAUDE.md) fully — it captures all binding rules.
2. Read `TASKS.md` to see what's next.
3. Read relevant sections of `CONTRACTS.md` before writing callers.
4. Skim `LOGS.md` for any `[INVARIANT]` tags relevant to the task.
5. Read `FUTURE_V2.md` to understand what's deliberately deferred.

Don't ask the user to re-explain context — the docs are the truth.
Personal preferences (no divider comments, user works in PowerShell on
Windows, etc.) are captured in the discipline section above.