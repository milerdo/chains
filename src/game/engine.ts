// ============================================================================
// CHAINS — Headless Game Engine (Section 33)
//
// ChainsGame owns ALL game math and state. It has zero React / DOM
// dependencies and can run standalone:
//
//   const game = new ChainsGame();
//   game.placeBet({ selections: [{ tier: 'HIGH', digits: [4, 2, 3] }], jackpotSequence: [7, 4] });
//   game.processDraw(4);
//   game.processDraw(2);
//   game.processDraw(3);
//   const state = game.getState();
//
// A UI layer (React or otherwise) should only ever call public methods on
// this class and render whatever getState() / subscribe() hand back. This
// separation means the frontend, RNG, wallet, server, auth, and jackpot
// service can all be replaced later without touching the game mathematics.
// ============================================================================

import type {
  BetRequest,
  DrawResult,
  GameConfig,
  GamePhase,
  GameState,
  JackpotPools,
  JackpotTierName,
  PlaceBetResult,
  SimulatedActivity,
  SimulatedActivityEvent,
  Ticket,
  TicketTier,
} from './types';
import {
  BASE_SEQUENCE_LENGTH,
  DEFAULT_GAME_CONFIG,
  INITIAL_JACKPOT_POOLS,
  MAX_CONCURRENT_TICKETS_PER_SEQUENCE,
  MAX_SIMULATED_EVENTS,
  MAX_STREAM_HISTORY,
  MAX_TICKET_HISTORY,
} from './constants';
import { JackpotManager } from './jackpot';
import { RNG } from './rng';
import { calculateBaseTotalReturn, calculateTotalStake, roundCurrency } from './payouts';
import {
  activateDueTickets,
  countActiveWithSameSequence,
  createTicket,
  evaluateTicketOnDraw,
  isTerminal,
  validateBaseDigits,
  validateJackpotSequence,
} from './ticket';

type Listener = (state: GameState) => void;

interface PlaceBetOptions {
  /** Demo/developer helper tickets can bypass the BETTING_OPEN phase
   * requirement (Section 27, "Create simulated ticket"). Real player bets
   * never set this. */
  bypassPhaseCheck?: boolean;
}

const TIER_FOR_JACKPOT: Record<JackpotTierName, TicketTier> = {
  MINI: 'LOW',
  MIDI: 'MEDIUM',
  GRAND: 'HIGH',
};

const SIMULATED_PLAYER_LABEL_POOL_SIZE = 9000;

export class ChainsGame {
  // --- configuration -------------------------------------------------------
  private config: GameConfig;
  private rng: RNG;
  private jackpotManager: JackpotManager;
  private readonly seedJackpotPools: JackpotPools;

  // --- core game state -------------------------------------------------------
  private drawIndex = 0;
  private streamHistory: DrawResult[] = [];
  private currentDraw: DrawResult | null = null;
  private tickets: Ticket[] = [];
  private balance: number;

  // --- phase / scheduler state -----------------------------------------------
  private phase: GamePhase = 'BETTING_OPEN';
  private phaseDurationMs: number;
  private phaseRemainingMs: number;
  private phaseStartTime: number = Date.now();
  private isRunning = false;
  private isPaused = false;
  private speedMultiplier = 1;
  private scheduleTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- simulated "other players" activity (Section 28, cosmetic only) -------
  private simulatedActivity: SimulatedActivity = {
    playerCount: 0,
    activeTicketsByTier: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    recentEvents: [],
  };

  // --- subscribers -------------------------------------------------------
  private listeners: Set<Listener> = new Set();

  constructor(
    configOverrides: Partial<GameConfig> = {},
    rng: RNG = new RNG(),
    seedJackpotPools: JackpotPools = INITIAL_JACKPOT_POOLS,
  ) {
    this.config = { ...DEFAULT_GAME_CONFIG, ...configOverrides };
    this.rng = rng;
    this.seedJackpotPools = { ...seedJackpotPools };
    this.jackpotManager = new JackpotManager(this.seedJackpotPools);
    this.balance = this.config.startingBalance;
    this.phaseDurationMs = this.config.bettingDurationMs;
    this.phaseRemainingMs = this.phaseDurationMs;
    this.simulatedActivity = this.generateSimulatedActivity();
  }

  // ==========================================================================
  // Public: state access
  // ==========================================================================

  /** Full immutable snapshot of the engine. Safe to render directly. */
  getState(): GameState {
    return {
      phase: this.phase,
      drawIndex: this.drawIndex,
      currentDraw: this.currentDraw,
      streamHistory: [...this.streamHistory],
      tickets: this.tickets.map((t) => ({
        ...t,
        baseSequence: [...t.baseSequence],
        jackpotSequence: [t.jackpotSequence[0], t.jackpotSequence[1]],
        drawLog: [...t.drawLog],
      })),
      balance: this.balance,
      jackpotPools: this.jackpotManager.getPools(),
      phaseStartedAt: this.phaseStartTime,
      phaseEndsAt: this.phaseStartTime + this.phaseRemainingMs / this.speedMultiplier,
      timeRemainingMs: this.getTimeRemainingMs(),
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      isRunning: this.isRunning,
      config: { ...this.config },
    };
  }

  getActiveTickets(): Ticket[] {
    return this.tickets.filter((t) => !isTerminal(t.status));
  }

  getTicketHistory(): Ticket[] {
    return this.tickets.filter((t) => isTerminal(t.status));
  }

  getStreamHistory(): DrawResult[] {
    return [...this.streamHistory];
  }

  getJackpotPools(): JackpotPools {
    return this.jackpotManager.getPools();
  }

  getBalance(): number {
    return this.balance;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  getDrawIndex(): number {
    return this.drawIndex;
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getSimulatedActivity(): SimulatedActivity {
    return {
      playerCount: this.simulatedActivity.playerCount,
      activeTicketsByTier: { ...this.simulatedActivity.activeTicketsByTier },
      recentEvents: [...this.simulatedActivity.recentEvents],
    };
  }

  /** Subscribes to state changes; fires immediately with the current state.
   * Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ==========================================================================
  // Public: betting
  // ==========================================================================

  /** Places a bet during the BETTING_OPEN phase. Validates digit selections,
   * the jackpot combination, the 3-ticket-per-sequence concurrency cap
   * (Sections 5 & 12), and balance sufficiency, then atomically creates all
   * requested tier tickets, deducts the total stake, and funds the
   * progressive jackpot pools (Section 18). All-or-nothing: if any
   * selection is invalid, no tickets are created and no balance is
   * touched. */
  placeBet(request: BetRequest): PlaceBetResult {
    return this.placeBetInternal(request, {});
  }

  // ==========================================================================
  // Public: draw processing (core engine tick)
  // ==========================================================================

  /**
   * Resolves exactly one global draw and advances every live ticket by one
   * step. If forcedDigit is omitted, the digit is produced by the RNG
   * (respecting any queued forced digits from the demo panel). This is the
   * fundamental, framework-agnostic unit of engine work — safe to call
   * directly for headless testing (see Section 30 scenarios), and also what
   * the internal phase scheduler calls automatically during live play.
   */
  processDraw(forcedDigit?: number): DrawResult {
    this.drawIndex += 1;

    let digit: number;
    if (forcedDigit !== undefined) {
      if (!Number.isInteger(forcedDigit) || forcedDigit < 0 || forcedDigit > 9) {
        throw new Error(`forcedDigit must be an integer 0-9, received ${forcedDigit}.`);
      }
      digit = forcedDigit;
    } else {
      digit = this.rng.generateDigit();
    }

    const draw: DrawResult = { drawIndex: this.drawIndex, digit };

    this.streamHistory.push(draw);
    if (this.streamHistory.length > MAX_STREAM_HISTORY) {
      this.streamHistory.shift();
    }

    // Advance every ticket by exactly this one draw. Each ticket only
    // reacts if this draw index is its own "next" index, so independent
    // ticket timelines never interfere with each other (Section 12).
    this.tickets = activateDueTickets(this.tickets, this.drawIndex);
    this.tickets = this.tickets.map((ticket) => evaluateTicketOnDraw(ticket, draw));

    // Credit base wins that resolved on this exact draw. The base payout is
    // locked in permanently and can never be reduced by jackpot outcomes
    // (Section 13).
    for (const ticket of this.tickets) {
      if (ticket.resolvedBaseAtDrawIndex === draw.drawIndex && ticket.baseWinAmount !== null) {
        this.balance = roundCurrency(this.balance + ticket.baseWinAmount);
      }
    }

    // Resolve jackpot wins that completed on this exact draw. Winners are
    // grouped by jackpot tier so that if multiple tickets qualify on the
    // very same draw, the pool is split evenly between them (Section 17)
    // before being reset to its seed value.
    const winnersByTier = new Map<JackpotTierName, Ticket[]>();
    for (const ticket of this.tickets) {
      if (
        ticket.status === 'JACKPOT_WON' &&
        ticket.resolvedJackpotAtDrawIndex === draw.drawIndex &&
        ticket.jackpotWinAmount === null
      ) {
        const list = winnersByTier.get(ticket.jackpotTier) ?? [];
        list.push(ticket);
        winnersByTier.set(ticket.jackpotTier, list);
      }
    }

    for (const [jackpotTierName, winners] of winnersByTier.entries()) {
      const payout = this.jackpotManager.payout(
        jackpotTierName,
        winners.map((w) => w.id),
        draw.drawIndex,
      );
      for (const winner of winners) {
        const idx = this.tickets.findIndex((t) => t.id === winner.id);
        if (idx === -1) continue;
        const current = this.tickets[idx];
        const totalReturn = roundCurrency((current.totalReturn ?? 0) + payout.perWinnerAmount);
        this.tickets[idx] = {
          ...current,
          jackpotWinAmount: payout.perWinnerAmount,
          totalReturn,
        };
        this.balance = roundCurrency(this.balance + payout.perWinnerAmount);
      }
    }

    this.pruneTicketHistory();
    this.simulatedActivity = this.generateSimulatedActivity(draw);
    this.currentDraw = draw;
    this.emit();
    return draw;
  }

  // ==========================================================================
  // Public: game loop scheduler (live/timed play)
  // ==========================================================================

  /** Starts the autonomous timed game loop (BETTING_OPEN -> BETTING_CLOSED
   * -> DRAWING -> RESULT -> ...), using the configured phase durations
   * (Section 3). No-op if already running. */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.enterPhase('BETTING_OPEN', this.config.bettingDurationMs);
  }

  /** Stops the autonomous loop entirely. Engine state (tickets, balance,
   * stream, jackpots) is left untouched; only the timer stops. */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.clearTimer();
    this.emit();
  }

  /** Pauses the current phase's countdown in place (Section 27). */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    const elapsedReal = Date.now() - this.phaseStartTime;
    this.phaseRemainingMs = Math.max(0, this.phaseRemainingMs - elapsedReal * this.speedMultiplier);
    this.clearTimer();
    this.emit();
  }

  /** Resumes a paused game loop from exactly where it left off. */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.phaseStartTime = Date.now();
    this.armTimer();
    this.emit();
  }

  /** Changes playback speed (e.g. x1 / x5 / x20 for demos, Section 27)
   * without losing progress through the current phase. */
  setSpeedMultiplier(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error('Speed multiplier must be a positive number.');
    }
    if (this.isRunning && !this.isPaused) {
      const elapsedReal = Date.now() - this.phaseStartTime;
      this.phaseRemainingMs = Math.max(0, this.phaseRemainingMs - elapsedReal * this.speedMultiplier);
      this.phaseStartTime = Date.now();
    }
    this.speedMultiplier = multiplier;
    this.armTimer();
    this.emit();
  }

  /** Immediately skips whatever remains of the current phase and advances
   * to the next one (Section 27, "Instant Step / Force Draw"). */
  instantStep(): void {
    this.clearTimer();
    this.phaseRemainingMs = 0;
    this.advancePhase();
  }

  isGameRunning(): boolean {
    return this.isRunning;
  }

  isGamePaused(): boolean {
    return this.isPaused;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  // ==========================================================================
  // Public: demo / developer controls (Section 27)
  // ==========================================================================

  /** Queues a single digit to override the very next RNG-generated draw. */
  forceNextDraw(digit: number): void {
    this.rng.forceNext(digit);
    this.emit();
  }

  /** Queues an ordered sequence of digits (e.g. to force a jackpot
   * combination to land for a live pitch demo). */
  forceDrawSequence(digits: number[]): void {
    this.rng.forceSequence(digits);
    this.emit();
  }

  clearForcedDraws(): void {
    this.rng.clearForced();
    this.emit();
  }

  peekForcedDraws(): number[] {
    return this.rng.peekForcedQueue();
  }

  /** Creates a ticket on behalf of the demo panel, bypassing the
   * BETTING_OPEN phase restriction so a presenter can drop in a ticket at
   * any moment to narrate a scenario. */
  createSimulatedTicket(tier: TicketTier, digits?: number[], jackpotSequence?: [number, number]): PlaceBetResult {
    const resolvedDigits = digits ?? this.randomDigits(BASE_SEQUENCE_LENGTH[tier]);
    const resolvedJackpot: [number, number] = jackpotSequence ?? [this.randomDigit(), this.randomDigit()];
    return this.placeBetInternal(
      { selections: [{ tier, digits: resolvedDigits }], jackpotSequence: resolvedJackpot },
      { bypassPhaseCheck: true },
    );
  }

  /**
   * Fabricates and instantly resolves a fully-won ticket for a given
   * jackpot tier, purely for pitch demonstrations ("Create simulated
   * jackpot win", Section 27). This does not consume any real stream
   * draws and does not disturb any other ticket's progress; it pays out
   * the live pool (with the standard split-and-reset logic) exactly as a
   * real win would.
   */
  simulateJackpotWin(jackpotTierName: JackpotTierName): Ticket {
    const tier = TIER_FOR_JACKPOT[jackpotTierName];
    const digits = this.randomDigits(BASE_SEQUENCE_LENGTH[tier]);
    const jackpotSequence: [number, number] = [this.randomDigit(), this.randomDigit()];

    let ticket = createTicket({
      tier,
      digits,
      jackpotSequence,
      startDrawIndex: this.drawIndex,
      createdAtDrawIndex: this.drawIndex,
      stake: this.config.ticketStake,
    });

    const baseWinAmount = calculateBaseTotalReturn(tier, this.config.ticketStake);
    const payout = this.jackpotManager.payout(jackpotTierName, [ticket.id], this.drawIndex);

    ticket = {
      ...ticket,
      status: 'JACKPOT_WON',
      baseProgress: ticket.baseSequence.length,
      jackpotProgress: 2,
      resolvedBaseAtDrawIndex: this.drawIndex,
      resolvedJackpotAtDrawIndex: this.drawIndex,
      baseWinAmount,
      jackpotWinAmount: payout.perWinnerAmount,
      totalReturn: roundCurrency(baseWinAmount + payout.perWinnerAmount),
    };

    this.balance = roundCurrency(this.balance + ticket.totalReturn);
    this.tickets.push(ticket);
    this.pruneTicketHistory();
    this.emit();
    return ticket;
  }

  /** Directly overrides a jackpot pool balance for demo purposes. */
  forceJackpotPool(jackpotTierName: JackpotTierName, amount: number): void {
    this.jackpotManager.forceSetPool(jackpotTierName, amount);
    this.emit();
  }

  /** Full reset: balance, tickets, stream, jackpots, draw index, and phase
   * all return to their starting configuration (Section 27, "Reset Game"). */
  reset(): void {
    this.clearTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.speedMultiplier = 1;

    this.drawIndex = 0;
    this.streamHistory = [];
    this.currentDraw = null;
    this.tickets = [];
    this.balance = this.config.startingBalance;

    this.jackpotManager.reset(this.seedJackpotPools);
    this.rng.reset();

    this.phase = 'BETTING_OPEN';
    this.phaseDurationMs = this.config.bettingDurationMs;
    this.phaseRemainingMs = this.phaseDurationMs;
    this.phaseStartTime = Date.now();

    this.simulatedActivity = this.generateSimulatedActivity();
    this.emit();
  }

  /** Resets only the demo wallet balance, leaving tickets/stream/jackpots
   * untouched (Section 27, "Reset Balance"). */
  resetBalance(): void {
    this.balance = this.config.startingBalance;
    this.emit();
  }

  /** Cleans up timers and subscribers. Call when the engine instance is no
   * longer needed (e.g. on UI unmount).
   *
   * Resets isRunning/isPaused back to false (not just clearing the timer),
   * so a later start() on the same instance actually re-arms the loop
   * instead of silently no-op'ing on its `if (this.isRunning) return;`
   * guard. This matters in practice: React's StrictMode (dev mode only)
   * mounts every component twice — mount, unmount, mount again — which
   * fires this destroy() once before the "real" mount's start() call. Without
   * this reset, the engine ends up permanently believing it's running with
   * no timer actually scheduled. */
  destroy(): void {
    this.clearTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.listeners.clear();
  }

  // ==========================================================================
  // Private: betting internals
  // ==========================================================================

  private placeBetInternal(request: BetRequest, options: PlaceBetOptions): PlaceBetResult {
    if (!options.bypassPhaseCheck && this.phase !== 'BETTING_OPEN') {
      return this.betFailure('Betting is currently closed for this round.');
    }

    if (!request || !Array.isArray(request.selections) || request.selections.length === 0) {
      return this.betFailure('Select at least one tier (LOW, MEDIUM, or HIGH) before placing a bet.');
    }
    if (request.selections.length > 1) {
  return this.betFailure('Only one volatility tier (LOW, MEDIUM, or HIGH) may be selected per betting round.');
    }

    const tiersSeen = new Set<TicketTier>();
    for (const selection of request.selections) {
      if (tiersSeen.has(selection.tier)) {
        return this.betFailure(`Duplicate ${selection.tier} selection in the same bet.`);
      }
      tiersSeen.add(selection.tier);
    }

    try {
      for (const selection of request.selections) {
        validateBaseDigits(selection.tier, selection.digits);
      }
      validateJackpotSequence(request.jackpotSequence);
    } catch (error) {
      return this.betFailure(error instanceof Error ? error.message : 'Invalid bet.');
    }

    for (const selection of request.selections) {
      const activeCount = countActiveWithSameSequence(this.tickets, selection.tier, selection.digits);
      if (activeCount >= MAX_CONCURRENT_TICKETS_PER_SEQUENCE) {
        return this.betFailure(
          `Maximum of ${MAX_CONCURRENT_TICKETS_PER_SEQUENCE} concurrent ${selection.tier} tickets on ` +
            `${selection.digits.join(' → ')} already running. Wait for one to resolve before betting it again.`,
        );
      }
    }

    const totalStake = calculateTotalStake(request.selections.length, this.config.ticketStake);
    if (this.balance < totalStake) {
      return this.betFailure(`Insufficient balance. Need $${totalStake.toFixed(2)}, have $${this.balance.toFixed(2)}.`);
    }

    const startDrawIndex = this.drawIndex + 1;
    const newTickets: Ticket[] = request.selections.map((selection) =>
      createTicket({
        tier: selection.tier,
        digits: selection.digits,
        jackpotSequence: request.jackpotSequence,
        startDrawIndex,
        createdAtDrawIndex: this.drawIndex,
        stake: this.config.ticketStake,
      }),
    );

    for (const selection of request.selections) {
      this.jackpotManager.contribute(selection.tier, this.config.ticketStake);
    }

    this.balance = roundCurrency(this.balance - totalStake);
    this.tickets.push(...newTickets);
    this.emit();

    return {
      success: true,
      message: `Bet placed: ${newTickets.length} ticket(s), total stake $${totalStake.toFixed(2)}.`,
      ticketIds: newTickets.map((t) => t.id),
      totalStake,
    };
  }

  private betFailure(message: string): PlaceBetResult {
    return { success: false, message, ticketIds: [], totalStake: 0 };
  }

  // ==========================================================================
  // Private: phase scheduler internals
  // ==========================================================================

  private enterPhase(phase: GamePhase, durationMs: number): void {
    this.phase = phase;
    this.phaseDurationMs = durationMs;
    this.phaseRemainingMs = durationMs;
    this.phaseStartTime = Date.now();

    if (phase === 'DRAWING') {
      // The actual RNG result is determined by the engine the instant this
      // phase begins. Any spinning/animation in the UI is purely cosmetic
      // and reveals a result that has already been decided (Section 22).
      this.processDraw();
    }

    this.armTimer();
    this.emit();
  }

  private advancePhase(): void {
    switch (this.phase) {
      case 'BETTING_OPEN':
        this.enterPhase('BETTING_CLOSED', this.config.bettingClosedDurationMs);
        break;
      case 'BETTING_CLOSED':
        this.enterPhase('DRAWING', this.config.drawAnimationDurationMs);
        break;
      case 'DRAWING':
        this.enterPhase('RESULT', this.config.resultDisplayDurationMs);
        break;
      case 'RESULT':
        this.enterPhase('BETTING_OPEN', this.config.bettingDurationMs);
        break;
    }
  }

  private armTimer(): void {
    this.clearTimer();
    if (!this.isRunning || this.isPaused) return;
    const scaledMs = Math.max(0, this.phaseRemainingMs / this.speedMultiplier);
    this.scheduleTimeout = setTimeout(() => this.advancePhase(), scaledMs);
  }

  private clearTimer(): void {
    if (this.scheduleTimeout !== null) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = null;
    }
  }

  private getTimeRemainingMs(): number {
    if (!this.isRunning) return 0;
    if (this.isPaused) return this.phaseRemainingMs;
    const elapsedReal = (Date.now() - this.phaseStartTime) * this.speedMultiplier;
    return Math.max(0, this.phaseRemainingMs - elapsedReal);
  }

  // ==========================================================================
  // Private: bookkeeping helpers
  // ==========================================================================

  /** Caps retained ticket history so long demo sessions don't grow memory
   * without bound, while never discarding any ticket that's still live. */
  private pruneTicketHistory(): void {
    const active = this.tickets.filter((t) => !isTerminal(t.status));
    const terminal = this.tickets.filter((t) => isTerminal(t.status));
    const trimmedTerminal = terminal.slice(Math.max(0, terminal.length - MAX_TICKET_HISTORY));
    this.tickets = [...active, ...trimmedTerminal];
  }

  private randomDigit(): number {
    return Math.floor(Math.random() * 10);
  }

  private randomDigits(count: number): number[] {
    return Array.from({ length: count }, () => this.randomDigit());
  }

  /**
   * Produces cosmetic "other players" activity for the live-table feel
   * (Section 28). Entirely simulated, never represents real accounts, and
   * has zero influence on the real stream, tickets, or payouts.
   */
  private generateSimulatedActivity(draw?: DrawResult): SimulatedActivity {
    const playerCount = 80 + Math.floor(Math.random() * 120);
    const activeTicketsByTier: Record<TicketTier, number> = {
      LOW: Math.floor(playerCount * (0.35 + Math.random() * 0.15)),
      MEDIUM: Math.floor(playerCount * (0.18 + Math.random() * 0.12)),
      HIGH: Math.floor(playerCount * (0.08 + Math.random() * 0.08)),
    };

    const recentEvents = [...this.simulatedActivity.recentEvents];
    if (draw) {
      const eventCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < eventCount; i += 1) {
        const tiers: TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];
        const tier = tiers[Math.floor(Math.random() * tiers.length)];
        const outcome: SimulatedActivityEvent['outcome'] = Math.random() < 0.5 ? 'WIN' : 'LOST';
        const playerLabel = `Player #${1000 + Math.floor(Math.random() * SIMULATED_PLAYER_LABEL_POOL_SIZE)}`;
        recentEvents.unshift({
          id: `sim-${draw.drawIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          playerLabel,
          tier,
          outcome,
          atDrawIndex: draw.drawIndex,
        });
      }
      while (recentEvents.length > MAX_SIMULATED_EVENTS) {
        recentEvents.pop();
      }
    }

    return { playerCount, activeTicketsByTier, recentEvents };
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}
