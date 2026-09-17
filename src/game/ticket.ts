// ============================================================================
// CHAINS — Ticket Lifecycle & Evaluation Logic
// (Sections 10, 11, 12, 13, 14, 15, 24, 29, 30)
//
// This module owns the ticket state machine. evaluateTicketOnDraw() is a
// pure function: given a ticket and a single global draw, it returns a new
// ticket object reflecting exactly one step of progress. It never mutates
// its input and never looks beyond the single draw it's given, which keeps
// the engine's draw-by-draw processing fully deterministic and testable.
// ============================================================================

import type {
  DrawResult,
  JackpotTierName,
  Ticket,
  TicketDrawRecord,
  TicketStatus,
  TicketTier,
} from './types';
import { BASE_SEQUENCE_LENGTH, DIGIT_MAX, DIGIT_MIN, JACKPOT_SEQUENCE_LENGTH, TICKET_STAKE, TIER_TO_JACKPOT } from './constants';
import { calculateBaseTotalReturn } from './payouts';

let ticketSequenceCounter = 0;

/** Generates a unique, human-inspectable ticket id. */
function generateTicketId(): string {
  ticketSequenceCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `T-${Date.now().toString(36)}-${ticketSequenceCounter}-${random}`;
}

export const TERMINAL_STATUSES: readonly TicketStatus[] = ['LOST', 'JACKPOT_WON', 'JACKPOT_LOST'];

/** True once a ticket can no longer change state. */
export function isTerminal(status: TicketStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

export function validateBaseDigits(tier: TicketTier, digits: number[]): void {
  const expectedLength = BASE_SEQUENCE_LENGTH[tier];
  if (!Array.isArray(digits) || digits.length !== expectedLength) {
    throw new Error(`${tier} tickets require exactly ${expectedLength} digit(s); received ${digits?.length ?? 0}.`);
  }
  digits.forEach((digit, i) => {
    if (!Number.isInteger(digit) || digit < DIGIT_MIN || digit > DIGIT_MAX) {
      throw new Error(`Invalid digit at position ${i} in ${tier} ticket: ${digit}. Digits must be integers 0-9.`);
    }
  });
}

export function validateJackpotSequence(sequence: number[]): void {
  if (!Array.isArray(sequence) || sequence.length !== JACKPOT_SEQUENCE_LENGTH) {
    throw new Error(`Jackpot combination must contain exactly ${JACKPOT_SEQUENCE_LENGTH} digits.`);
  }
  sequence.forEach((digit, i) => {
    if (!Number.isInteger(digit) || digit < DIGIT_MIN || digit > DIGIT_MAX) {
      throw new Error(`Invalid jackpot digit at position ${i}: ${digit}. Digits must be integers 0-9.`);
    }
  });
}

// ----------------------------------------------------------------------------
// Creation
// ----------------------------------------------------------------------------

export interface CreateTicketParams {
  tier: TicketTier;
  digits: number[];
  jackpotSequence: [number, number];
  startDrawIndex: number;
  createdAtDrawIndex: number;
  stake?: number;
  comboGroupId?: string | null;
  comboDigits?: number[] | null;
}

/** Creates a brand-new ticket in the WAITING state. Throws if the digits or
 * jackpot sequence are invalid. */
export function createTicket(params: CreateTicketParams): Ticket {
  const { tier, digits, jackpotSequence, startDrawIndex, createdAtDrawIndex } = params;
  const stake = params.stake ?? TICKET_STAKE;

  validateBaseDigits(tier, digits);
  validateJackpotSequence(jackpotSequence);

  const jackpotTier: JackpotTierName = TIER_TO_JACKPOT[tier];

  return {
    id: generateTicketId(),
    tier,
    baseSequence: [...digits],
    jackpotSequence: [jackpotSequence[0], jackpotSequence[1]],
    jackpotTier,
    stake,
    status: 'WAITING',
    baseProgress: 0,
    jackpotProgress: 0,
    startDrawIndex,
    nextDrawIndex: startDrawIndex,
    createdAtDrawIndex,
    resolvedBaseAtDrawIndex: null,
    resolvedJackpotAtDrawIndex: null,
    baseWinAmount: null,
    jackpotWinAmount: null,
    totalReturn: 0,
    drawLog: [],
    comboGroupId: params.comboGroupId ?? null,
    comboDigits: params.comboDigits ? [...params.comboDigits] : null,
  };
}

// ----------------------------------------------------------------------------
// Evaluation
// ----------------------------------------------------------------------------

/** Maps jackpot qualification progress to the corresponding resting status. */
function jackpotProgressToStatus(progress: number): TicketStatus {
  if (progress <= 0) return 'BASE_WON';
  if (progress === 1) return 'JACKPOT_STEP_1';
  return 'JACKPOT_STEP_2';
}

/**
 * Advances a single ticket by exactly one global draw.
 *
 * - Terminal tickets (LOST / JACKPOT_WON / JACKPOT_LOST) are returned
 *   unchanged — a finished ticket never restarts and never uses later
 *   numbers (Section 11).
 * - Tickets are only evaluated on the draw whose index matches their own
 *   nextDrawIndex; every other draw passes through untouched. This is what
 *   guarantees ticket timelines stay fully independent of each other and of
 *   the betting-phase clock (Sections 2, 10, 12).
 *
 * This function is pure: it never mutates `ticket` and always returns a new
 * object when a change occurs.
 */
export function evaluateTicketOnDraw(ticket: Ticket, draw: DrawResult): Ticket {
  if (isTerminal(ticket.status)) {
    return ticket;
  }
  if (draw.drawIndex !== ticket.nextDrawIndex) {
    return ticket;
  }

  if (ticket.status === 'WAITING' || ticket.status === 'ACTIVE') {
    return evaluateBaseStep(ticket, draw);
  }

  // BASE_WON, JACKPOT_STEP_1, JACKPOT_STEP_2 -> jackpot qualification phase.
  return evaluateJackpotStep(ticket, draw);
}

function evaluateBaseStep(ticket: Ticket, draw: DrawResult): Ticket {
  const expectedDigit = ticket.baseSequence[ticket.baseProgress];
  const matched = draw.digit === expectedDigit;

  const drawLog: TicketDrawRecord[] = [
    ...ticket.drawLog,
    { drawIndex: draw.drawIndex, digit: draw.digit, matched, phase: 'BASE' },
  ];

  if (!matched) {
    // Immediate, permanent loss. Does not wait for another matching digit,
    // does not restart, does not use later numbers (Section 11).
    return {
      ...ticket,
      status: 'LOST',
      drawLog,
      resolvedBaseAtDrawIndex: draw.drawIndex,
    };
  }

  const newBaseProgress = ticket.baseProgress + 1;
  const baseComplete = newBaseProgress === ticket.baseSequence.length;

  if (!baseComplete) {
    return {
      ...ticket,
      status: 'ACTIVE',
      baseProgress: newBaseProgress,
      nextDrawIndex: draw.drawIndex + 1,
      drawLog,
    };
  }

  // Base sequence fully matched: credit the total return immediately, lock
  // it in permanently, and move into Jackpot Qualification Mode. This
  // payout can never be put back at risk by the jackpot phase (Section 13).
  const baseWinAmount = calculateBaseTotalReturn(ticket.tier, ticket.stake);

  return {
    ...ticket,
    status: 'BASE_WON',
    baseProgress: newBaseProgress,
    nextDrawIndex: draw.drawIndex + 1,
    resolvedBaseAtDrawIndex: draw.drawIndex,
    baseWinAmount,
    totalReturn: baseWinAmount,
    drawLog,
  };
}

function evaluateJackpotStep(ticket: Ticket, draw: DrawResult): Ticket {
  const expectedDigit = ticket.jackpotSequence[ticket.jackpotProgress];
  const matched = draw.digit === expectedDigit;

  const drawLog: TicketDrawRecord[] = [
    ...ticket.drawLog,
    { drawIndex: draw.drawIndex, digit: draw.digit, matched, phase: 'JACKPOT' },
  ];

  if (!matched) {
    // Jackpot qualification ends. The already-credited base payout is
    // untouched and remains on the player's balance (Section 15).
    return {
      ...ticket,
      status: 'JACKPOT_LOST',
      drawLog,
      resolvedJackpotAtDrawIndex: draw.drawIndex,
    };
  }

  const newJackpotProgress = ticket.jackpotProgress + 1;
  const jackpotComplete = newJackpotProgress === ticket.jackpotSequence.length;

  if (!jackpotComplete) {
    return {
      ...ticket,
      status: jackpotProgressToStatus(newJackpotProgress),
      jackpotProgress: newJackpotProgress,
      nextDrawIndex: draw.drawIndex + 1,
      drawLog,
    };
  }

  // Full jackpot combination matched. The actual pool payout amount (which
  // may be split across simultaneous winners, Section 17) is resolved by
  // the engine via the JackpotManager, not here — this function only owns
  // the ticket's own sequence-matching state.
  return {
    ...ticket,
    status: 'JACKPOT_WON',
    jackpotProgress: newJackpotProgress,
    resolvedJackpotAtDrawIndex: draw.drawIndex,
    drawLog,
  };
}

/**
 * Flips any WAITING tickets whose startDrawIndex has now been reached to
 * ACTIVE, purely for display accuracy. Functionally, evaluateTicketOnDraw()
 * treats WAITING and ACTIVE identically, so this is optional bookkeeping —
 * it just keeps ticket.status semantically precise ("queued" vs "live")
 * for the UI even before the first digit has been compared.
 */
export function activateDueTickets(tickets: Ticket[], currentDrawIndex: number): Ticket[] {
  let changed = false;
  const next = tickets.map((ticket) => {
    if (ticket.status === 'WAITING' && currentDrawIndex >= ticket.startDrawIndex) {
      changed = true;
      return { ...ticket, status: 'ACTIVE' as TicketStatus };
    }
    return ticket;
  });
  return changed ? next : tickets;
}

/** True if two base digit sequences are identical, in order and length. */
export function sequenceEquals(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Counts how many currently non-terminal tickets share the exact same tier
 * and base digit sequence. Used to enforce the concurrency cap of 3
 * (Sections 5 & 12) — jackpot-qualifying tickets still count, since only
 * LOST / JACKPOT_WON / JACKPOT_LOST are truly finished.
 */
export function countActiveWithSameSequence(tickets: readonly Ticket[], tier: TicketTier, digits: number[]): number {
  return tickets.filter((t) => t.tier === tier && sequenceEquals(t.baseSequence, digits) && !isTerminal(t.status)).length;
}
