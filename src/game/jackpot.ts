// ============================================================================
// CHAINS — Progressive Jackpot Manager
// Manages live pool balances, funding accumulation, winner payouts (with
// multi-winner split support), and seed resets. Framework-agnostic.
// ============================================================================

import type { JackpotPools, JackpotTierName, TicketTier } from './types';
import { INITIAL_JACKPOT_POOLS, JACKPOT_CONTRIBUTION_RATES, TIER_TO_JACKPOT } from './constants';
import { roundCurrency, roundPrecise, splitJackpotEvenly } from './payouts';

export interface JackpotWinRecord {
  tierName: JackpotTierName;
  ticketId: string;
  amountWon: number;
  drawIndex: number;
  /** splitting the jackpot */
  splitAmong: number;
}

export interface JackpotPayoutResult {
  tierName: JackpotTierName;
  /** Amount paid to each individual winning ticket after the split. */
  perWinnerAmount: number;
  /** Sum actually paid out across all winners this round. */
  totalPaid: number;
  winnerTicketIds: string[];
}

export class JackpotManager {
  private pools: JackpotPools;
  private readonly seedPools: JackpotPools;
  private winHistory: JackpotWinRecord[] = [];

  constructor(seedPools: JackpotPools = INITIAL_JACKPOT_POOLS) {
    this.seedPools = { ...seedPools };
    this.pools = { ...seedPools };
  }

  /** Immutable snapshot of all three pool balances. */
  getPools(): JackpotPools {
    return { ...this.pools };
  }

  getPool(tierName: JackpotTierName): number {
    return this.pools[tierName];
  }

  /**
   * Adds this tier's configured contribution rate (per $1 staked) to its
   * corresponding jackpot pool. Returns the exact amount contributed.
   */
  contribute(tier: TicketTier, stake: number): number {
    const jackpotTierName = TIER_TO_JACKPOT[tier];
    // Contribution rates are by design: $0.06 / $0.07 /
    // $0.08 per $1 wagered. the pool accumulator must retain full
    // precision rather than rounding every single contribution to the
    // nearest cent — that would silently truncate the "exact" rate the spec
    // requires. Only roundPrecise (floating-point dust cleanup) is applied
    // here; roundCurrency is reserved for amounts actually paid out.
    const contribution = roundPrecise(JACKPOT_CONTRIBUTION_RATES[tier] * stake);
    this.pools[jackpotTierName] = roundPrecise(this.pools[jackpotTierName] + contribution);
    return contribution;
  }

  /**
   * Pays out a progressive jackpot pool to one or more simultaneous winning
   * tickets, splitting equally (Section 17). The pool is then reset back to
   * its seed value. Architected to support N>1 winners even though the
   * single-player MVP will normally only ever pass one ticket id.
   */
  payout(tierName: JackpotTierName, winnerTicketIds: string[], drawIndex: number): JackpotPayoutResult {
    if (winnerTicketIds.length === 0) {
      return { tierName, perWinnerAmount: 0, totalPaid: 0, winnerTicketIds: [] };
    }

    const poolAmount = this.pools[tierName];
    const perWinnerAmount = splitJackpotEvenly(poolAmount, winnerTicketIds.length);

    for (const ticketId of winnerTicketIds) {
      this.winHistory.push({
        tierName,
        ticketId,
        amountWon: perWinnerAmount,
        drawIndex,
        splitAmong: winnerTicketIds.length,
      });
    }

    this.pools[tierName] = this.seedPools[tierName];

    return {
      tierName,
      perWinnerAmount,
      totalPaid: roundCurrency(perWinnerAmount * winnerTicketIds.length),
      winnerTicketIds: [...winnerTicketIds],
    };
  }

  getWinHistory(): JackpotWinRecord[] {
    return [...this.winHistory];
  }

  forceSetPool(tierName: JackpotTierName, amount: number): void {
    this.pools[tierName] = roundCurrency(amount);
  }

  /** Resets all pools back to their seed values and clears win history. */
  reset(seedPools: JackpotPools = this.seedPools): void {
    this.pools = { ...seedPools };
    this.winHistory = [];
  }
}
