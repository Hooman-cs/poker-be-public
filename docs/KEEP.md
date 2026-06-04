# KEEP.md — Files NOT touched during the rebuild

Every file in `src/` (and supporting config) is in one of three buckets:
**modify**, **delete & rebuild**, or **keep**. Modify and delete-and-rebuild
are tracked in `TASKS.md`. This file is the third bucket — the things we
explicitly do NOT change without deliberate process.

## The Keep Levels (1 = hardest to change, 5 = easiest)

The previous "Foundation Keep" was a single coarse bucket — every file in it
had the same "off-limits, ask first" status. In reality some files are
categorically more dangerous to touch than others. The five levels below
make that gradient explicit, with each level having different unlock
semantics.

A file's **level** answers the question *"what does it take to make a change
here?"* — not *"how important is it?"* All five levels are important; they
differ only in how much process is required before an edit.

---

## Level 1 — Architectural Bedrock

Touching these requires explicit re-justification across the whole project.
They define what *money*, *auth*, and *user* mean in this codebase. Changing
them invalidates assumptions in many other places downstream.

**Unlock semantics:** written justification in LOGS.md, named decision-maker,
plan for re-auditing dependents *before* the change ships. If the change is
non-trivial (anything beyond a one-line bug fix), expect a project-wide
ripple — assume hours, not minutes, of follow-on work.

| File | Why Level 1 |
|---|---|
| `src/config/constants.ts` | Defines currency, money minor-unit helpers (`toMinor`, `toMajor`, `formatMoney`), and ALL timing constants (`ADMIN_TOKEN_TTL`, `USER_TOKEN_TTL`, etc.). Every money calculation and every auth-token decision flows through values defined here. |
| `src/models/user.ts` | The identity model. `authProviders` shape is the contract every auth flow honors. Changing required fields, the auth-provider schema, or the username discipline ripples through Phase 3 (auth), Phase 4 (admin user management), and the mobile app. |
| `src/models/wallet.ts` | The money truth. Integer minor units; unique on `userId`; currency-bound; float-guard pre-save hook. Every cash-mode transaction reads or writes this. Changing the shape would require a data migration. |
| `src/utils/jwt.ts` | Token sign/verify. The root of every protected request. Every auth guard (`requireUser`, `requireAdmin`, `middleware`) ultimately verifies tokens via this file. |

---

## Level 2 — Core Logic

The engine and service. Self-contained in scope but everything depends on
their behavior being correct. Surgical bug fixes (like the two we made in
Phase 1) are allowed; behavior changes that alter game outcomes or money
movement need real justification.

**Unlock semantics:** documented reason in LOGS.md + a test (smoke or focused)
demonstrating the change is correct. Tier-1 smoke test (`scripts/playOneHand.ts`)
must pass after the change. If the change affects pot calculation, money
movement, or showdown, run it explicitly against multi-player scenarios.

| File | Why Level 2 |
|---|---|
| `src/engine/gameEngine.ts` | Pure game logic — deck, dealing, action processing, round progression, `advanceRound` helper, `buildArchiveData`. Two bugs found and fixed in Phase 1 (the spread-on-subdoc was actually in gameService; the round-closure-with-folds was here). |
| `src/engine/handEvaluator.ts` | Pure winner determination + integer split-pot math. Pokersolver bridging + Razz lowball. |
| `src/engine/potCalculator.ts` | Pure pot-splitting (main + side pots), integer math. |
| `src/services/gameService.ts` | Orchestration: seat/wallet ops, game lifecycle, showdown. Per-desk `async-mutex`. Mongo transactions wrap cash-mode wallet writes. THE only place engine results meet documents and money. Includes the `toObject()` boundary discipline (plain `IGamePlayer` constructed before crossing into engine) — see LOGS.md 2026-06-01. |

---

## Level 3 — Data Models (non-bedrock)

Schemas + validators. Adding fields is usually safe (forward-compatible).
Changing required-ness, types, or removing fields is dangerous because of
denormalization (data already exists with the old shape) and because
existing code reads those fields.

**Unlock semantics:** clear plan for backward compatibility. For additive
changes (new optional field): straightforward. For breaking changes
(removing/renaming): explicit migration plan documented in LOGS.md.

| File | Why Level 3 |
|---|---|
| `src/models/admin.ts` | Identity model for a tiny set (admins). Password hashing + bcrypt comparePassword. Adding tracking fields (lastLogin, etc.) is normal evolution. |
| `src/models/poker.ts` | Poker game-type metadata. |
| `src/models/pokerMode.ts` | Template for stakes/buy-in tiers. Integer money + currency. |
| `src/models/pokerDesk.ts` | Schema-only — NO methods. Carries embedded subdoc types (`IGamePlayer`, `IRound`) that the engine depends on. **Subdoc type changes here ripple into Level 2.** |
| `src/models/pokerGameArchive.ts` | Finished-game archive. `username` required (the empty-string crash fix is in `gameService.showdown`). |
| `src/models/walletTransaction.ts` | Wallet money-flow audit ledger. Status enum standardized on `'completed'`. |
| `src/models/bankTransaction.ts` | Deposit/withdraw transactions linked to user bank accounts. `bankAccountId` canonical (not `bankId`). |
| `src/models/gatewayTransaction.ts` | Razorpay/payment-gateway audit rows. `gatewayOrderId` canonical (not `orderId`). |
| `src/models/bankAccount.ts` | Verified Keep from Phase 0 — no money fields (strings/booleans only), 5-account-per-user pre-save hook is correct. |

---

## Level 4 — Boundary Helpers

Auth guards, API helpers, types, middleware, utility functions. Stable but
expected to evolve as new use cases appear. Most edits at this level are
adding new error codes, new helper functions, or new types — not changing
existing ones.

**Unlock semantics:** normal review. Don't break callers; if a signature
changes, update every caller in the same change. No LOGS.md entry needed
for additive changes; do log signature changes.

| File | Why Level 4 |
|---|---|
| `src/lib/auth/requireUser.ts` | Bearer-token guard. Six failure codes. Strict on `role === 'user'`. |
| `src/lib/auth/requireAdmin.ts` | Cookie guard + DB status check. Six failure codes. Async (DB lookup for revocation). |
| `src/lib/api/money.ts` | API edge: `serializeMoney`, `serializeMoneyFields` (outbound → formatted string), `parseAmount` (inbound → strict integer minor units). |
| `src/lib/api/errors.ts` | Single source of truth for error→HTTP-status mapping. `AuthError`, `successResponse`, `errorResponse`. |
| `src/types/pokerModelTypes.ts` | Shared transport/DTO types derived from frozen-core models. Class A types live here. |
| `src/middleware.ts` | Cheap auth gate for `/admin/**` and `/auth/login`. Cookie-based JWT verify with `jose` (Edge runtime). |
| `src/utils/helpers.ts` | Keeps `generateGamerName`. |
| `src/config/dbConnect.ts` | DB connection with global caching; imported everywhere. |

---

## Level 5 — Operational Scripts

Stable in their current state, but trivial to rewrite if needed because they
have no runtime dependents — they're invoked by hand, not imported.

**Unlock semantics:** free to edit. The only discipline is "don't break the
existing CLI shape if someone has scripts using it" — and at our scale,
that's a non-concern.

| File | Why Level 5 |
|---|---|
| `scripts/createAdmin.ts` | CLI seed for admin creation. Args-or-prompts hybrid, masked password via `readline` `_writeToOutput` hijack. |
| `scripts/changeAdminPassword.ts` | Looks up by email, confirms identity, updates password through the model. Never deletes, never creates. |
| `scripts/playOneHand.ts` | Tier-1 smoke test. Seeds + plays a 3-player Hold'em hand + verifies 9 invariants. Run before any future change to Level 2 files. |
| `scripts/playThreeHands.ts` | Tier-1 multi-hand smoke test. 3 hands on the same desk, verifies button rotation across hands. 14/14 checks. |
| `scripts/playLifecycle.ts` | Tier-1 lifecycle smoke test. 5 hands at varying player counts (4→6→5→4→3→force-close→reject). Verifies cold-start gate, warm play, mid-hand leave, force-closure, money conservation across the full lifecycle. |

---

## Not Leveled — App Shell + Root Config

These aren't "frozen" in the bedrock sense; they're plumbing. The Next.js
runtime needs them to exist with specific shapes, but their contents are
straightforward and we don't have meaningful "discipline" rules around them.

| File | Notes |
|---|---|
| `src/app/layout.tsx` | Root layout (HTML wrapper, fonts, metadata). |
| `src/app/globals.css` | Tailwind base + minimal globals. |
| `next.config.mjs` | Next.js config. |
| `tsconfig.json` | TS config + path aliases (`@/*`). |
| `tailwind.config.ts` | Tailwind config. |
| `postcss.config.mjs` | PostCSS for Tailwind. |
| `package.json` | We add deps as features need them, never preemptively. |
| `.eslintrc.json` | ESLint config. |
| `global.d.ts`, `pokersolver.d.ts` | Ambient type declarations. |

## Not Yet Leveled — Inherited from Old Code

`src/hooks/useSocket.ts` was previously listed as "Runtime / hook (correct
and reused)." Honestly, it hasn't been audited against the Phase 0+1 standards
because the socket transport rebuild (Phase 5) hasn't happened yet. It's
inherited from the old codebase and will be re-evaluated in Phase 5 — at that
point it either gets promoted to Level 4 (boundary helper) or rewritten.

---

## What's NOT here (lives in TASKS.md instead)

- **Modify bucket** — Phase 0 model/engine/service tasks (now complete and
  promoted into the levels above).
- **Delete-and-rebuild bucket** — `src/app/api/**`, `src/components/**`,
  admin pages, `src/server.ts`, `src/utils/pokerModelTypes.ts` (the empty
  shell from old code), `src/app/auth/**`, `src/app/page.tsx`.

If a file isn't in TASKS.md and isn't in this file, **flag it** — that's
the "silently forgotten" failure mode we're trying to avoid. Every file
should be accounted for under exactly one bucket.

## Discipline notes

- Adding a new file? Decide its bucket and level at creation. Put it
  somewhere (TASKS.md for build, KEEP.md at the appropriate level for keep).
- Want to edit a Level 1 or Level 2 file? Stop and write the justification
  first. The Phase 1 engine fixes set the precedent: documented reason in
  LOGS.md + a test that proves correctness.
- Level changes are themselves rare events. If a Level 3 file starts
  carrying logic that the engine depends on, that's a signal to promote
  it to Level 2 (not to leave it under-protected).