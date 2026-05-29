# KEEP.md — Files NOT touched during the rebuild

Every file in `src/` (and supporting config) is in one of three buckets:
**modify**, **delete & rebuild**, or **keep**. Modify and delete-and-rebuild are
tracked in `TASKS.md`. This file is the third bucket — the things we explicitly
do NOT change — split into two kinds because they have different semantics.

## Verified Keep (audited against the frozen-core rules, no edits needed)

These were checked deliberately and found correct as-written. Each has a short
"why" so the audit isn't lost.

| File | Why it's kept |
|---|---|
| `src/models/bankAccount.ts` | No money fields (strings/booleans only). No auth concerns. Already uses `timestamps: true`. No duplicate indexes. The 5-account-per-user pre-save hook is correct. (Audited 2026-05-29.) |

When we touch the rebuild bucket and find a file in this list referenced incorrectly
(e.g. the old admin code used `bankId` instead of `bankAccountId`), the FIX is in
the caller, not here.

## Foundation Keep (off-limits — touching these cascades widely)

Stable, depended-on, working. We don't change these except for a deliberate, documented
reason (and only after asking — like we did when unlocking models for the Google auth change).

**Note on the frozen core:** at task 0.18, all Phase 0 outputs — every model, every engine
file, `src/config/constants.ts`, and `src/services/gameService.ts` — are PROMOTED into the
Foundation Keep section below. After the freeze, they have the same off-limits status as
the entries already listed. This list is therefore expected to grow at 0.18, not stay
fixed at its current contents.

### Frozen core — Phase 0 outputs (promoted at 0.18, 2026-05-29)
| File | Notes |
|---|---|
| `src/config/constants.ts` | Currency config, money helpers (`toMinor`/`toMajor`/`formatMoney`), all timing constants (`ADMIN_TOKEN_TTL`, `ADMIN_COOKIE_MAX_AGE_S`, `USER_TOKEN_TTL`), `PRACTICE_STARTING_STACK_MINOR`, `BOT_DIFFICULTIES`. Edits here ripple everywhere — gate behind discussion. |
| `src/models/wallet.ts` | One wallet per user (unique on `userId`), integer minor units, currency-bound, float-guard pre-save hook. |
| `src/models/walletTransaction.ts` | Renamed from `Transaction`. Wallet money-flow audit ledger. Status enum standardized on `'completed'`. |
| `src/models/bankTransaction.ts` | Deposit/withdraw transactions linked to user bank accounts. `bankAccountId` canonical (not `bankId`). |
| `src/models/gatewayTransaction.ts` | Razorpay/payment-gateway audit rows. `gatewayOrderId` canonical (not `orderId`). |
| `src/models/pokerMode.ts` | Template for stakes/buy-in tiers. Integer money + currency. |
| `src/models/pokerGameArchive.ts` | Finished-game archive. `username` required (the empty-string crash fix is in `gameService.showdown`). |
| `src/models/pokerDesk.ts` | Schema-only — NO methods. All behavior moved to `gameService.ts`. |
| `src/models/poker.ts` | Poker game-type metadata. |
| `src/models/user.ts` | Google `authProviders` array (Option 2, extensible). Email unique. Mobile optional + non-unique. `usernameLocked` flag. |
| `src/models/bankAccount.ts` | Verified-keep from the start (also listed in section above); promoted again here so the freeze list is exhaustive. |
| `src/models/admin.ts` | Near-keep; password hashing + bcrypt comparePassword. |
| `src/engine/potCalculator.ts` | Pure pot-splitting (main + side pots), integer math, `sanitizeMath` removed. |
| `src/engine/handEvaluator.ts` | Pure winner determination + integer split-pot math. Pokersolver bridging + Razz lowball. |
| `src/engine/gameEngine.ts` | Pure game logic (deck, dealing, action processing, round progression, `advanceRound` helper, `buildArchiveData` takes username map). |
| `src/services/gameService.ts` | Orchestration: seat/wallet ops, game lifecycle, showdown. Per-desk `async-mutex`. Mongo transactions wrap cash-mode wallet writes. THE only place engine results meet documents and money. |

### Utilities (logic-bearing, foundational)
| File | Notes |
|---|---|
| `src/utils/jwt.ts` | Token sign/verify; used by every auth path. |
| `src/utils/helpers.ts` | Keeps `generateGamerName`. (We removed `generateOtp` as part of 0.11 — that was a deliberate edit, not a "touch.") |
| `src/config/dbConnect.ts` | DB connection with global caching; imported everywhere. |

### Runtime / hook (correct and reused)
| File | Notes |
|---|---|
| `src/hooks/useSocket.ts` | Socket.io client wrapper; consumed by live-table views. |

### App shell (Next.js plumbing)
| File | Notes |
|---|---|
| `src/app/layout.tsx` | Root layout (HTML wrapper, fonts, metadata). |
| `src/app/globals.css` | Tailwind base + minimal globals. |

### Root config (build, tooling, types)
| File | Notes |
|---|---|
| `next.config.mjs` | Next.js config. |
| `tsconfig.json` | TS config + path aliases (`@/*`). |
| `tailwind.config.ts` | Tailwind config. |
| `postcss.config.mjs` | PostCSS for Tailwind. |
| `package.json` | We add deps as features need them (e.g. `google-auth-library` at task 3.1), never preemptively. |
| `.eslintrc.json` | ESLint config. |
| `global.d.ts`, `pokersolver.d.ts` | Ambient type declarations. |

## What's NOT here (lives in TASKS.md instead)

- **Modify bucket** — every Phase 0 model/engine/service task, `middleware.ts` (clean in place), `helpers.ts` trim.
- **Delete-and-rebuild bucket** — `src/app/api/**`, `src/components/**`, admin pages, `src/server.ts`, `src/utils/pokerModelTypes.ts`, `src/app/auth/**`, `src/app/page.tsx`.

If a file isn't in TASKS.md and isn't in this file, **flag it** — that's the
"silently forgotten" failure mode we're trying to avoid. Every file should be
accounted for under exactly one bucket.

## Discipline notes

- Adding a new file? Decide its bucket at creation and write it somewhere
  (TASKS.md for modify/build, KEEP.md for keep). Never leave a file unaccounted for.
- Want to edit a Foundation Keep file? Stop and discuss first. The cost of a
  bad change to one of these is high precisely because they're depended on
  by many other files.
