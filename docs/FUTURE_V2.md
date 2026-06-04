# FUTURE_V2.md — Deferred to Major Version 2.0

This file collects items deliberately scoped OUT of the v1 launch but
documented enough to be picked up later. Each entry has source (where the
decision was made) so context is reconstructable.

## Game Variants
- **Stud, Razz, Five-Card Draw.** Removed from `PokerGameType` union for v1. Engine code preserved as dead-code branches behind a `gameType as string` cast in `handEvaluator.ts`; `HOLE_CARDS_BY_GAME` has Omaha only. Re-enable: edit the union in `poker.ts`, restore the table in `gameEngine.ts`, write per-variant smoke tests. Five-Card Draw blinds-vs-antes ambiguity needs resolving when restored. (Source: LOGS.md 2026-06-01)

## Heads-Up Play
- **2-player tables.** `desk.minToStart` and `desk.minToContinue` have `min: 3` at the schema level. Heads-up has different turn-order rules (button = SB; post-flop first-actor = BB) the engine doesn't model. Lift the schema floor + add heads-up acting-order branches in `initializeGameState` and `getFirstActivePlayer` to enable.

## Table Closure / Grace Period
- **Pause-with-timeout instead of immediate force-close.** v1 force-closes a warm desk the moment player count drops below `minToContinue`. PDF (`Poker_Below_Minimum_Players.pdf`) recommends a 2-5 minute dissolution timer giving new players a chance to fill the seats. Implementation: `closeScheduledAt` field on desk + lazy expiry check on every desk-touching service call. Recovery: when a sit brings count back to `minToContinue+`, clear `closeScheduledAt`.
- **Idle-reset cold transition.** Once a desk closes, it stays closed. Future: after long idle, automatically transition closed→cold so admin doesn't need to re-open manually.

## Mid-Hand Drop Below `minToContinue`
- **Currently:** mid-hand collapse handled by existing `<= 1` single-survivor logic. Drops to 2 players play out as broken heads-up.
- **Future:** when `userLeavesSeat` reduces active+all-in below `minToContinue` mid-hand, end the hand immediately (collapse to showdown with current pot). Tracked separately because Option-A code wasn't written this phase due to deadline.

## Player States Beyond Active / Folded
- **Sitting Out.** Player is seated but skipped on every action. Auto-action: "check if free, fold if facing a bet." Doesn't count toward active player threshold for new hands. Requires socket-layer presence detection (Phase 5).
- **Disconnected.** Auto-transitioned to Sitting Out after N seconds of no heartbeat. Phase 5.
- **Reserved.** Seat held for a player who is logging in / loading. Out of scope.

## Anti-Ratholing
- Per `Poker_Player_Leave_Handling.pdf`: if a player leaves with profit and rejoins the same stakes within a configurable window, their new buy-in must be ≥ their last leave stack. Store `lastLeaveAmount` + `lastLeaveAt` per player per stake level. Check in `addUserToSeat`. Exempt force-closed leaves from the penalty.

## Commission / Rake
- **Moved out of FUTURE_V2** (this rebuild, not deferred to v2). Confirmed by management 2026-06-01: per-session commission on net profit, deducted on `userLeavesSeat` (not per-hand rake). Admin-configurable percentage. Player buys 100, leaves with 162 → commission on 62 profit. Buys 100, leaves with ≤100 → no commission.
- **Phase 3/4 work, not engine work.** Lives in `userLeavesSeat` (deduct from wallet credit) and admin panel (configure percentage). Schema: probably `commissionRate: number` on PokerMode (per-stake configurable) plus a `commissions` audit collection.
- **Open: storage** — likely a `commissions` audit collection separate from `walletTransaction`, so revenue is queryable for reporting.
- See TASKS.md Phase 3 for the user-facing leave-with-commission flow and Phase 4 for the admin configuration UI.

## Lobby + Real-Time State
- **Visible table state in lobby** (Waiting / Active / Closed) with seat counts. Phase 6 admin frontend + user mobile lobby.
- **Live state broadcasts** to seated players + lobby observers. Phase 5 socket layer.
- **Chat at the table.** Not building chat in v1.

## Tournaments
- Tournament-mode tables: registration windows, blind level escalation, table balancing, prize-pool distribution, blinded-out semantics. Entire feature deferred.

## Auto-Fold Timer
- 60-second action timer per player. After timeout: auto-fold (or check if free). After 3-4 consecutive auto-folds, mark player as "left." Belongs in the socket layer (Phase 5 task 5.2) — engine has no concept of wall-clock time.

## Audit Logging
- Every state transition (cold→warm, warm→closed, leave, force-close), every chip movement, every dealer-button advance — durable audit log. Useful for dispute resolution and regulatory compliance. Out of scope for v1; existing model-level audit (WalletTransaction etc.) covers chip movements.

## Operational
- **Idle reset to cold.** Closed desks stay closed; admin re-opens manually. v2: auto-reset after time.
- **Background job runner.** For real timers (grace-period expiry, idle reset, daily reports). v1 uses lazy checks instead.
- **Per-stake-level configuration.** Some tables are 1/2, some 5/10. Anti-ratholing windows, rake percentages, etc., may need to differ by stake. v2.