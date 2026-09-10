// ============================================================================
// CHAINS — Core Engine Type Definitions
// Pure TypeScript. No React / DOM dependencies.
// ============================================================================

/** The four phases of the continuous game loop (Section 3). */
export type GamePhase = 'BETTING_OPEN' | 'BETTING_CLOSED' | 'DRAWING' | 'RESULT';

/** The three ticket volatilities a player can bet on (Section 5). */
export type TicketTier = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * The full ticket state machine (Section 24).
 *
 * WAITING            -> ticket created, first live draw hasn't occurred yet
 * ACTIVE             -> base sequence partially matched, still live
 * LOST               -> base sequence mismatch (terminal)
 * BASE_WON           -> base sequence fully matched, credited, 0 jackpot
 *                       qualification draws consumed yet (jackpot step 0)
 * JACKPOT_STEP_1     -> first jackpot digit matched, awaiting the second
 *                       qualification draw
 * JACKPOT_STEP_2     -> reserved for jackpot combinations longer than 2
 *                       digits (extensibility hook — unused while the
 *                       jackpot combination is fixed at 2 digits, since
 *                       the second draw resolves directly to WON/LOST)
 * JACKPOT_WON        -> full jackpot combination matched (terminal)
 * JACKPOT_LOST       -> jackpot qualification failed; base payout stands
 *                       (terminal)
 */
export type TicketStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'LOST'
  | 'BASE_WON'
  | 'JACKPOT_STEP_1'
  | 'JACKPOT_STEP_2'
  | 'JACKPOT_WON'
  | 'JACKPOT_LOST';

/** The three progressive jackpot pools (Section 16). */
export type JackpotTierName = 'MINI' | 'MIDI' | 'GRAND';

/** One resolved global draw on the shared stream (Section 4). */
export interface DrawResult {
  drawIndex: number;
  digit: number;
}

/** Live balances of the three progressive jackpot pools. */
export interface JackpotPools {
  MINI: number;
  MIDI: number;
  GRAND: number;
}

/** A single per-draw audit entry attached to a ticket, for history/UI display. */
export interface TicketDrawRecord {
  drawIndex: number;
  digit: number;
  matched: boolean;
  phase: 'BASE' | 'JACKPOT';
}

/** A single player ticket. Contains enough information to fully reconstruct
 * its state at any point (Section 24). */
export interface Ticket {
  id: string;
  tier: TicketTier;
  /** The exact digit sequence this ticket must match, in order. */
  baseSequence: number[];
  /** The 2-digit jackpot combination locked in at bet time (Section 8). */
  jackpotSequence: [number, number];
  /** Which progressive pool this ticket can win (Section 16). */
  jackpotTier: JackpotTierName;
  /** Stake in demo credits paid for this ticket. */
  stake: number;
  status: TicketStatus;
  /** Number of base digits matched so far (0..baseSequence.length). */
  baseProgress: number;
  /** Number of jackpot digits matched so far (0..jackpotSequence.length). */
  jackpotProgress: number;
  /** The global draw index this ticket first evaluates against. */
  startDrawIndex: number;
  /** The global draw index this ticket is currently waiting to evaluate
   * against next. Used to guarantee each ticket only ever evaluates once
   * per global draw, and only on draws that are actually "its turn". */
  nextDrawIndex: number;
  /** The global draw index at which this ticket was created (bet placed). */
  createdAtDrawIndex: number;
  /** The draw index on which the base sequence resolved (win or loss), or
   * null while still live. */
  resolvedBaseAtDrawIndex: number | null;
  /** The draw index on which jackpot qualification resolved (win or loss),
   * or null while not yet resolved / not applicable. */
  resolvedJackpotAtDrawIndex: number | null;
  /** Total credited amount for the base game (multiplier * stake), locked
   * in permanently the instant the base sequence completes. Null until the
   * base sequence resolves as a win. */
  baseWinAmount: number | null;
  /** Progressive jackpot amount actually paid out to this ticket (after any
   * multi-winner split). Null until the jackpot resolves as a win. */
  jackpotWinAmount: number | null;
  /** Running total of everything credited to the player from this ticket:
   * baseWinAmount + jackpotWinAmount (when applicable). */
  totalReturn: number;
  /** Ordered audit trail of every draw this ticket has evaluated against. */
  drawLog: TicketDrawRecord[];
}

/** One tier selection within a single bet submission (Section 5). */
export interface BetSelection {
  tier: TicketTier;
  digits: number[];
}

/** A full bet submission: 1-3 independent tier tickets sharing one jackpot
 * combination for that betting round (Sections 5 & 8). */
export interface BetRequest {
  selections: BetSelection[];
  jackpotSequence: [number, number];
}

/** Result of attempting to place a bet. */
export interface PlaceBetResult {
  success: boolean;
  message: string;
  ticketIds: string[];
  totalStake: number;
}

/** Tunable timings and economic parameters (Section 6, 9, 16, 18). All
 * timings live in one place so they can be changed for live demos
 * (Section 3). */
export interface GameConfig {
  bettingDurationMs: number;
  bettingClosedDurationMs: number;
  drawAnimationDurationMs: number;
  resultDisplayDurationMs: number;
  startingBalance: number;
  ticketStake: number;
}

/** Simulated "other players" activity for the live-table feel (Section 28).
 * Purely cosmetic — never represents real accounts. */
export interface SimulatedActivity {
  playerCount: number;
  activeTicketsByTier: Record<TicketTier, number>;
  recentEvents: SimulatedActivityEvent[];
}

export interface SimulatedActivityEvent {
  id: string;
  playerLabel: string;
  tier: TicketTier;
  outcome: 'WIN' | 'LOST';
  atDrawIndex: number;
}

/** Full immutable snapshot of the engine, handed to subscribers and
 * returned by getState(). React (or any UI) should simply render this. */
export interface GameState {
  phase: GamePhase;
  drawIndex: number;
  currentDraw: DrawResult | null;
  streamHistory: DrawResult[];
  tickets: Ticket[];
  balance: number;
  jackpotPools: JackpotPools;
  phaseStartedAt: number;
  phaseEndsAt: number;
  timeRemainingMs: number;
  speedMultiplier: number;
  isPaused: boolean;
  isRunning: boolean;
  config: GameConfig;
}
