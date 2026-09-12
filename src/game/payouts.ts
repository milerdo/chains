// ============================================================================
// CHAINS — Payout & Contribution Calculations (Section 9, 18)
// Pure functions only. No state, no side effects.
// ============================================================================

import type { TicketTier } from './types';
import { BASE_MULTIPLIERS, TICKET_STAKE } from './constants';

/** Rounds a currency value to the nearest cent, avoiding common
 * floating-point artifacts (e.g. 0.1 + 0.2). Use this for anything actually
 * credited/debited to the player's balance (stakes, base payouts, jackpot
 * payouts) — real money should never carry sub-cent amounts. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rounds to a higher, non-cent precision (default 6 decimal places) purely
 * to eliminate floating-point representation dust (e.g. 0.1 + 0.2 !==
 * 0.30000000000000004) without destroying legitimate sub-cent precision.
 * Use this for internal accumulators — like the progressive jackpot pools
 * — whose configured funding rates ($0.06 / $0.08 / $0.072 per Section 18)
 * are themselves sub-cent and must accumulate exactly over many
 * contributions rather than being truncated to whole cents on every add. */
export function roundPrecise(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Total return (profit + original stake) for a given stake amount. This is
 * the exact amount credited the instant a ticket's base sequence completes
 * (Section 13). */
export function calculateBaseTotalReturn(tier: TicketTier, stake: number = TICKET_STAKE): number {
  return roundCurrency(BASE_MULTIPLIERS[tier] * stake);
}

/** Total stake required for a bet containing the given number of tier
 * selections, at the configured per-ticket stake (Section 6). */
export function calculateTotalStake(selectionCount: number, stakePerTicket: number = TICKET_STAKE): number {
  return roundCurrency(selectionCount * stakePerTicket);
}

/** Splits a progressive jackpot pool evenly across N simultaneous winners
 * (Section 17). Returns the amount paid to each individual winner. */
export function splitJackpotEvenly(poolAmount: number, winnerCount: number): number {
  if (winnerCount <= 0) return 0;
  return roundCurrency(poolAmount / winnerCount);
}
