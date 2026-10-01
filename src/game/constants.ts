// ============================================================================
// CHAINS — Configuration Constants
// All game timings and economic parameters live here so they can be tuned
// in one place for development / live demonstrations (Section 3).
// ============================================================================

import type { GameConfig, JackpotPools, JackpotTierName, TicketTier } from './types';

// ----------------------------------------------------------------------------
// Timings (ms)
// ----------------------------------------------------------------------------
export const BETTING_DURATION = 10_000;
export const BETTING_CLOSED_DURATION = 1_000;
export const DRAW_ANIMATION_DURATION = 5_000;
export const RESULT_DISPLAY_DURATION = 1_000;

// ----------------------------------------------------------------------------
// Economy
// ----------------------------------------------------------------------------
export const TICKET_STAKE = 1;
export const STARTING_BALANCE = 100;

/** Total return multiplier per $1 staked (Section 9). Total return already
 * includes the original stake. */
export const BASE_MULTIPLIERS: Record<TicketTier, number> = {
  LOW: 9,
  MEDIUM: 88,
  HIGH: 888,
};

/** Number of consecutive digits each tier requires (Section 5). */
export const BASE_SEQUENCE_LENGTH: Record<TicketTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/** Which progressive pool each tier feeds into and can win (Section 16). */
export const TIER_TO_JACKPOT: Record<TicketTier, JackpotTierName> = {
  LOW: 'MINI',
  MEDIUM: 'MIDI',
  HIGH: 'GRAND',
};

/** Seeds are 0 by design: jackpots are funded 100% by player contributions,
 * so jackpot RTP per tier == its contribution rate (no house-funded EV).
 * Do not add seeds without recomputing RTP (see rtp.ts). */
export const INITIAL_JACKPOT_POOLS: JackpotPools = {
  MINI: 0,
  MIDI: 0,
  GRAND: 0,
};

/** Progressive jackpot funding contribution added per $1 wagered on a
 * given tier, at the moment the bet is confirmed (Section 18). */
export const JACKPOT_CONTRIBUTION_RATES: Record<TicketTier, number> = {
  LOW: 0.06,
  MEDIUM: 0.07,
  HIGH: 0.08,
};

/** Number of digits in the jackpot qualification combination (Section 8). */
export const JACKPOT_SEQUENCE_LENGTH = 2;

/** Maximum number of concurrently-live (non-terminal) tickets allowed with
 * the exact same tier + digit sequence (Sections 5 & 12). */
export const MAX_CONCURRENT_TICKETS_PER_SEQUENCE = 3;

/** Bounds on retained history so long-running demo sessions don't grow
 * memory unboundedly. */
export const MAX_STREAM_HISTORY = 200;
export const MAX_TICKET_HISTORY = 200;
export const MAX_SIMULATED_EVENTS = 25;

export const DIGIT_MIN = 0;
export const DIGIT_MAX = 9;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  bettingDurationMs: BETTING_DURATION,
  bettingClosedDurationMs: BETTING_CLOSED_DURATION,
  drawAnimationDurationMs: DRAW_ANIMATION_DURATION,
  resultDisplayDurationMs: RESULT_DISPLAY_DURATION,
  startingBalance: STARTING_BALANCE,
  ticketStake: TICKET_STAKE,
};

/** Clearly label this as a demonstration system, never a certified RNG
 * (Section 23). Surfaced by UI in the Help modal / footer. */
export const RNG_DISCLAIMER =
  'CHAINS is a demonstration system using an unaudited pseudo-random number ' +
  'generator. It is NOT a certified gambling RNG and must not be used for ' +
  'real-money play.';
