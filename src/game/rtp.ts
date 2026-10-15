// CHAINS: theoretical RTP derived from constants (never hardcoded).
// Jackpot RTP equals the contribution rate because pools have no seed:
// everything contributed is eventually paid out.
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, JACKPOT_CONTRIBUTION_RATES, JACKPOT_SEQUENCE_LENGTH } from './constants';
import { countComboPossibilities } from './combo';
import type { TicketTier } from './types';

export const TIERS: readonly TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];

export const hitProbability = (tier: TicketTier): number => 10 ** -BASE_SEQUENCE_LENGTH[tier];
/** Probability the 3 jackpot numbers appear in any order over the next 3
 * draws: (distinct orderings) / 10^3. Default = 3 distinct digits (best
 * case, 6/1000 = 1 in 166.7). 112 -> 3/1000, 111 -> 1/1000. */
export const jackpotQualifyProbability = (digits: readonly number[] = [0, 1, 2]): number =>
  countComboPossibilities([...digits]) * 10 ** -JACKPOT_SEQUENCE_LENGTH;
/** Probability a $1 link wins its jackpot (base win, then the set). */
export const jackpotHitProbability = (tier: TicketTier, digits?: readonly number[]): number =>
  hitProbability(tier) * jackpotQualifyProbability(digits);
export const baseRtp = (tier: TicketTier): number => hitProbability(tier) * BASE_MULTIPLIERS[tier];
export const jackpotRtp = (tier: TicketTier): number => JACKPOT_CONTRIBUTION_RATES[tier];
export const totalRtp = (tier: TicketTier): number => baseRtp(tier) + jackpotRtp(tier);
/** Equal-weighted average across tiers (assumes equal play on each). */
export const overallRtp = (): number => TIERS.reduce((s, t) => s + totalRtp(t), 0) / TIERS.length;
export const houseEdge = (): number => 1 - overallRtp();