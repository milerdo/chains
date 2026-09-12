// ============================================================================
// CHAINS — useGame Hook + GameProvider
// Bridges the pure TypeScript ChainsGame engine (Phase 1) into React. This
// module owns the single ChainsGame instance for the whole app, subscribes
// to it, and re-renders whenever the engine's state changes.
//
// No game math lives here — this is a thin reactive wrapper only. Every
// value it exposes is either read directly off engine.getState() or is a
// direct pass-through call into a public engine method.
// ============================================================================

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChainsGame } from '../game/engine';
import { isTerminal } from '../game/ticket';
import { playBaseWin, playJackpotFanfare, playLoss } from '../utils/audio';
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
  Ticket,
  TicketStatus,
  TicketTier,
} from '../game/types';

export interface UseGameValue {
  /** Raw engine snapshot, for anything not already broken out below. */
  gameState: GameState;
  activeTickets: Ticket[];
  history: Ticket[];
  balance: number;
  jackpotPools: JackpotPools;
  /** The most recently RESOLVED draw, held back from the raw engine value
   * until the Wheel's suspense animation has actually had time to play
   * (see MIN_REVEAL_DELAY_MS below). The engine computes the true digit
   * the instant the DRAWING phase begins — by design, so the RNG result
   * is never influenced by the UI — but every component that displays a
   * digit (Wheel, NumberStream, GameHistory) must not find out before the
   * animation says so, or the "reveal" is spoiled before it plays. */
  currentDraw: DrawResult | null;
  /** Same reveal-delay applied to the running stream list. */
  streamHistory: DrawResult[];
  phase: GamePhase;
  /** Milliseconds remaining in the current phase, updated smoothly on a
   * short local interval (the engine itself only emits on phase changes /
   * draws, not every tick). */
  timeRemaining: number;
  speedMultiplier: number;
  isPaused: boolean;
  isRunning: boolean;
  config: GameConfig;
  drawIndex: number;
  simulatedActivity: SimulatedActivity;
  forcedQueue: number[];

  placeBet: (request: BetRequest) => PlaceBetResult;
  forceNextDraw: (digit: number) => void;
  forceDrawSequence: (digits: number[]) => void;
  clearForcedDraws: () => void;
  instantStep: () => void;
  setSpeed: (multiplier: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  resetBalance: () => void;
  simulateJackpotWin: (tier: JackpotTierName) => void;
  createSimulatedTicket: (tier: TicketTier) => void;
}

const GameContext = createContext<UseGameValue | null>(null);

/** How often (ms) the local countdown re-reads the engine's live
 * timeRemainingMs between actual engine state emissions. */
const TIME_TICK_MS = 200;

/** Floor on how long a draw stays hidden after it's computed, even if
 * drawAnimationDurationMs is configured very short — matches the minimum
 * spin time the Wheel commits to, so the two can never disagree. Exported
 * so Wheel.tsx can shape its cosmetic spin-deceleration curve against the
 * exact same number rather than keeping its own separate copy. */
export const MIN_REVEAL_DELAY_MS = 1200;

export function GameProvider({ children }: { children: ReactNode }) {
  // Exactly one ChainsGame instance for the lifetime of this provider.
  const gameRef = useRef<ChainsGame | null>(null);
  if (gameRef.current === null) {
    gameRef.current = new ChainsGame();
  }
  const game = gameRef.current;

  const [gameState, setGameState] = useState<GameState>(() => game.getState());
  const [simulatedActivity, setSimulatedActivity] = useState<SimulatedActivity>(() => game.getSimulatedActivity());
  const [forcedQueue, setForcedQueue] = useState<number[]>(() => game.peekForcedDraws());
  const [timeRemaining, setTimeRemaining] = useState<number>(() => game.getState().timeRemainingMs);

  // --- Reveal-delayed draw/stream state -------------------------------
  // Held back from the raw engine value until the suspense animation has
  // had time to play. See MIN_REVEAL_DELAY_MS and the UseGameValue doc
  // comment above for why this exists.
  const [revealedDraw, setRevealedDraw] = useState<{ currentDraw: DrawResult | null; streamHistory: DrawResult[] }>(
    () => {
      const initial = game.getState();
      return { currentDraw: initial.currentDraw, streamHistory: initial.streamHistory };
    },
  );
  // Tracks the drawIndex already scheduled/revealed so the subscribe
  // callback only reacts to genuinely NEW draws — the engine emits on
  // every action (bets placed, jackpot pool ticks, ticket progress, etc.),
  // not just draws.
  const lastSeenDrawIndexRef = useRef<number>(revealedDraw.currentDraw?.drawIndex ?? 0);
  const revealTimeoutRef = useRef<number | null>(null);
  // Set synchronously (not via React state) immediately around
  // instantStep()'s call into the engine, so the subscribe callback below
  // — a stable closure that does not re-run per render — can read the
  // live "was this instant-stepped?" signal at the exact moment the
  // engine's synchronous emit fires, with no stale-closure risk and no
  // arbitrary timing window to get wrong.
  const skipNextRevealDelayRef = useRef(false);
  // Last status seen per ticket id, used to fire outcome sounds exactly
  // once per genuine transition (see applyTicketSounds below).
  const prevTicketStatusRef = useRef<Map<string, TicketStatus>>(new Map());

  useEffect(() => {
    const unsubscribe = game.subscribe((nextState) => {
      setGameState(nextState);
      setSimulatedActivity(game.getSimulatedActivity());
      setForcedQueue(game.peekForcedDraws());
      setTimeRemaining(nextState.timeRemainingMs);

      // Plays the right sound for any ticket whose status just changed
      // into a win/loss outcome, at most once per transition (a ticket
      // could pass BASE_WON -> JACKPOT_STEP_1 -> JACKPOT_WON across
      // separate draws, correctly chiming once for each real outcome).
      const applyTicketSounds = (tickets: Ticket[]) => {
        for (const ticket of tickets) {
          const previousStatus = prevTicketStatusRef.current.get(ticket.id);
          if (previousStatus === ticket.status) continue;
          prevTicketStatusRef.current.set(ticket.id, ticket.status);
          if (ticket.status === 'JACKPOT_WON') playJackpotFanfare();
          else if (ticket.status === 'BASE_WON') playBaseWin();
          else if (ticket.status === 'LOST' || ticket.status === 'JACKPOT_LOST') playLoss();
        }
      };

      const incomingDrawIndex = nextState.currentDraw?.drawIndex ?? 0;
      if (incomingDrawIndex === lastSeenDrawIndexRef.current) {
        // Not a new draw — a bet was placed, a jackpot pool ticked up, a
        // demo-panel action fabricated/simulated a ticket, etc. There's no
        // pending "unrevealed" draw here, so any ticket outcome is safe to
        // announce immediately (this is also what makes the Demo Panel's
        // "Simulate Jackpot Win" button play its fanfare right away).
        applyTicketSounds(nextState.tickets);
        return;
      }
      lastSeenDrawIndexRef.current = incomingDrawIndex;

      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }

      const reveal = () => {
        setRevealedDraw({ currentDraw: nextState.currentDraw, streamHistory: nextState.streamHistory });
        // Ticket outcomes caused by THIS draw must surface — visually and
        // audibly — at the same moment the digit itself does, not before;
        // otherwise a win/loss sound would spoil the wheel's reveal the
        // same way the undelayed stream/history once did (see item 1b).
        applyTicketSounds(nextState.tickets);
      };

      if (skipNextRevealDelayRef.current) {
        reveal();
      } else {
        const delayMs = Math.max(MIN_REVEAL_DELAY_MS, nextState.config.drawAnimationDurationMs) / nextState.speedMultiplier;
        revealTimeoutRef.current = window.setTimeout(reveal, delayMs);
      }
    });
    game.start();
    return () => {
      unsubscribe();
      game.destroy();
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeRemaining(game.getState().timeRemainingMs);
    }, TIME_TICK_MS);
    return () => window.clearInterval(interval);
  }, [game]);

  const placeBet = useCallback((request: BetRequest) => game.placeBet(request), [game]);
  const forceNextDraw = useCallback((digit: number) => game.forceNextDraw(digit), [game]);
  const forceDrawSequence = useCallback((digits: number[]) => game.forceDrawSequence(digits), [game]);
  const clearForcedDraws = useCallback(() => game.clearForcedDraws(), [game]);

  const instantStep = useCallback(() => {
    // Both the flag flip and the engine call are synchronous, and
    // instantStep()'s own call chain (advancePhase -> enterPhase ->
    // processDraw -> emit) is entirely synchronous too, so the subscribe
    // callback above observes skipNextRevealDelayRef.current === true at
    // exactly the right moment, then it's safe to flip back immediately —
    // no timing window needed.
    skipNextRevealDelayRef.current = true;
    game.instantStep();
    skipNextRevealDelayRef.current = false;
  }, [game]);

  const setSpeed = useCallback((multiplier: number) => game.setSpeedMultiplier(multiplier), [game]);
  const pauseGame = useCallback(() => game.pause(), [game]);
  const resumeGame = useCallback(() => game.resume(), [game]);
  const resetGame = useCallback(() => {
    game.reset();
    prevTicketStatusRef.current.clear();
  }, [game]);
  const resetBalance = useCallback(() => game.resetBalance(), [game]);
  const simulateJackpotWin = useCallback(
    (tier: JackpotTierName) => {
      game.simulateJackpotWin(tier);
    },
    [game],
  );
  const createSimulatedTicket = useCallback(
    (tier: TicketTier) => {
      game.createSimulatedTicket(tier);
    },
    [game],
  );

  const value = useMemo<UseGameValue>(
    () => ({
      gameState,
      activeTickets: gameState.tickets.filter((t) => !isTerminal(t.status)),
      history: gameState.tickets.filter((t) => isTerminal(t.status)),
      balance: gameState.balance,
      jackpotPools: gameState.jackpotPools,
      currentDraw: revealedDraw.currentDraw,
      streamHistory: revealedDraw.streamHistory,
      phase: gameState.phase,
      timeRemaining,
      speedMultiplier: gameState.speedMultiplier,
      isPaused: gameState.isPaused,
      isRunning: gameState.isRunning,
      config: gameState.config,
      drawIndex: gameState.drawIndex,
      simulatedActivity,
      forcedQueue,
      placeBet,
      forceNextDraw,
      forceDrawSequence,
      clearForcedDraws,
      instantStep,
      setSpeed,
      pauseGame,
      resumeGame,
      resetGame,
      resetBalance,
      simulateJackpotWin,
      createSimulatedTicket,
    }),
    [
      gameState,
      revealedDraw,
      timeRemaining,
      simulatedActivity,
      forcedQueue,
      placeBet,
      forceNextDraw,
      forceDrawSequence,
      clearForcedDraws,
      instantStep,
      setSpeed,
      pauseGame,
      resumeGame,
      resetGame,
      resetBalance,
      simulateJackpotWin,
      createSimulatedTicket,
    ],
  );

  return createElement(GameContext.Provider, { value }, children);
}

/** Subscribes the calling component to the shared CHAINS game engine.
 * Must be rendered somewhere beneath a `<GameProvider>` (see App.tsx). */
export function useGame(): UseGameValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame() must be called within a <GameProvider>.');
  }
  return ctx;
}
