// CHAINS: theoretical RTP derived from constants (never hardcoded).
// Jackpot RTP equals the contribution rate because pools have no seed:
// everything contributed is eventually paid out.
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, JACKPOT_CONTRIBUTION_RATES, JACKPOT_SEQUENCE_LENGTH } from './constants';
import type { TicketTier } from './types';

export const TIERS: readonly TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];

export const hitProbability = (tier: TicketTier): number => 10 ** -BASE_SEQUENCE_LENGTH[tier];
/** Probability a $1 link wins its jackpot (base win, then the pair). */
export const jackpotHitProbability = (tier: TicketTier): number =>
  hitProbability(tier) * 10 ** -JACKPOT_SEQUENCE_LENGTH;
export const baseRtp = (tier: TicketTier): number => hitProbability(tier) * BASE_MULTIPLIERS[tier];
export const jackpotRtp = (tier: TicketTier): number => JACKPOT_CONTRIBUTION_RATES[tier];
export const totalRtp = (tier: TicketTier): number => baseRtp(tier) + jackpotRtp(tier);
/** Equal-weighted average across tiers (assumes equal play on each). */
export const overallRtp = (): number => TIERS.reduce((s, t) => s + totalRtp(t), 0) / TIERS.length;
export const houseEdge = (): number => 1 - overallRtp();