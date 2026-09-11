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
  TicketTier,
} from '../game/types';

export interface UseGameValue {
  /** Raw engine snapshot, for anything not already broken out below. */
  gameState: GameState;
  activeTickets: Ticket[];
  history: Ticket[];
  balance: number;
  jackpotPools: JackpotPools;
  currentDraw: DrawResult | null;
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
  /** True for a brief window right after instantStep() fires, so
   * animation-driving components (the Wheel) know to skip their timed
   * reveal and snap straight to the already-resolved result. */
  skipNextAnimation: boolean;

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

/** How long (ms) the "skip the next animation" flag stays true after
 * instantStep() fires — long enough for a listening effect to observe it
 * on the very next render, short enough to never linger into a later,
 * normally-timed draw. */
const SKIP_ANIMATION_WINDOW_MS = 60;

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
  const [skipNextAnimation, setSkipNextAnimation] = useState(false);

  useEffect(() => {
    const unsubscribe = game.subscribe((nextState) => {
      setGameState(nextState);
      setSimulatedActivity(game.getSimulatedActivity());
      setForcedQueue(game.peekForcedDraws());
      setTimeRemaining(nextState.timeRemainingMs);
    });
    game.start();
    return () => {
      unsubscribe();
      game.destroy();
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
    setSkipNextAnimation(true);
    game.instantStep();
    window.setTimeout(() => setSkipNextAnimation(false), SKIP_ANIMATION_WINDOW_MS);
  }, [game]);

  const setSpeed = useCallback((multiplier: number) => game.setSpeedMultiplier(multiplier), [game]);
  const pauseGame = useCallback(() => game.pause(), [game]);
  const resumeGame = useCallback(() => game.resume(), [game]);
  const resetGame = useCallback(() => game.reset(), [game]);
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
      currentDraw: gameState.currentDraw,
      streamHistory: gameState.streamHistory,
      phase: gameState.phase,
      timeRemaining,
      speedMultiplier: gameState.speedMultiplier,
      isPaused: gameState.isPaused,
      isRunning: gameState.isRunning,
      config: gameState.config,
      drawIndex: gameState.drawIndex,
      simulatedActivity,
      forcedQueue,
      skipNextAnimation,
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
      timeRemaining,
      simulatedActivity,
      forcedQueue,
      skipNextAnimation,
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
