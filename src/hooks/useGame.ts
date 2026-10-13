// ============================================================================
// CHAINS — useGame Hook + GameProvider
// Bridges the pure TypeScript ChainsGame engine (Phase 1) into React. This
// module owns the single ChainsGame instance for the whole app, subscribes
// to it, and re-renders whenever the engine's state changes.
//
// No game math lives here — this is a thin reactive wrapper only. Every
// value it exposes is either read directly off engine.getState() or is a
// direct pass-through call into a public engine method.
//
// Reveal pipeline (two stages):
//   1. `wheelTargetDraw` fires at the original suspense-delay timing and
//      tells the Wheel which digit to land on. The Wheel does NOT reveal
//      this to the player yet — it's purely the landing target.
//   2. `currentDraw` / `streamHistory` (the "public" reveal, consumed by
//      GameHistory, NumberStream, JackpotPanel, etc.) do not update until
//      the Wheel calls `reportWheelLanded()` once its landing animation has
//      visually settled. A bounded fallback timer (PUBLIC_REVEAL_FALLBACK_MS)
//      reveals anyway if that's never called, so the game can never get
//      stuck (e.g. if no Wheel is mounted).
// This is what keeps the Draw History list (and anything else reading
// currentDraw/streamHistory) from showing a result before the wheel has
// actually stopped on it.
//
// Sound is gated on the exact same commit point (see commitPublicReveal
// below): a ticket's win/loss sound is only ever allowed to play once the
// wheel has visually landed, never at spin-start. Previously the outcome
// sound fired inside reveal() — which runs the instant the wheel STARTS its
// landing approach — so a player could hear whether they won or lost before
// the wheel visually stopped. applyTicketSoundsRef defers that call until
// commitPublicReveal() actually fires.
// ============================================================================

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyDemoJackpotPreset } from '../game/demoPreset';
import { ChainsGame } from '../game/engine';
import { isTerminal } from '../game/ticket';
import { playBaseWin, playJackpotFanfare, playStepMatch } from '../utils/audio';
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

export interface AutoBetState {
  template: BetRequest;
  roundsRemaining: number;
  roundsTotal: number;
}

export interface UseGameValue {
  /** Player's chosen jackpot pair; persists across rounds and breakpoint remounts. */
  jackpotPick: [number | null, number | null];
  setJackpotPick: (pair: [number | null, number | null]) => void;
  bettingLocked: boolean;
  autoBet: AutoBetState | null;
  autoBetError: string | null;
  clearAutoBetError: () => void;
  startAutoBet: (request: BetRequest, rounds: number) => PlaceBetResult;
  stopAutoBet: () => void;
 /** Transient "base win paid" notice, shown in PhaseStatus. */
  payoutFlash: { amount: number; key: number } | null;
  /** Raw engine snapshot, for anything not already broken out below. */
  gameState: GameState;
  activeTickets: Ticket[];
  history: Ticket[];
  balance: number;
  jackpotPools: JackpotPools;
  /** The 2-digit jackpot combination auto-assigned for the current betting
   * round (Section 9). Editable in the UI, but pre-filled with this value
   * the instant a fresh BETTING_OPEN phase begins. */
  currentJackpotSequence: [number, number];
  /** The most recently RESOLVED draw, held back from the raw engine value
   * until the Wheel has reported that its landing animation has actually
   * finished (see file header). Every component that displays a digit
   * (GameHistory, NumberStream) reads this — never wheelTargetDraw — so
   * none of them can find out before the wheel's reveal plays. */
  currentDraw: DrawResult | null;
  /** Same landing-gated reveal applied to the running stream list. */
  streamHistory: DrawResult[];
  /** The digit the Wheel should currently be landing/settling on. Fires at
   * the original suspense-delay timing. Only Wheel.tsx should consume
   * this — everything else should read `currentDraw` above. */
  wheelTargetDraw: DrawResult | null;
  /** Wheel.tsx calls this once its landing animation has visually
   * settled, which is what actually reveals currentDraw/streamHistory to
   * the rest of the UI (and, as of the sound-timing fix, is also the
   * moment any pending win/loss sound is allowed to play). Safe to call
   * multiple times or not at all (a bounded fallback timer reveals
   * regardless). */
  reportWheelLanded: () => void;
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
  jackpotCelebration: { ticketId: string; tier: JackpotTierName; amount: number } | null;
  dismissJackpotCelebration: () => void;

  placeBet: (request: BetRequest) => PlaceBetResult;
  placeBets: (requests: BetRequest[], dryRun?: boolean) => PlaceBetResult;
  /** Bets from the most recent round the player bet in (Repeat Last Bet). */
  lastRoundBets: BetRequest[];
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

function cloneRequest(r: BetRequest): BetRequest {
  return {
    selections: r.selections.map((s) => ({ ...s, digits: [...s.digits] })),
    jackpotSequence: [r.jackpotSequence[0], r.jackpotSequence[1]],
  };
}

const GameContext = createContext<UseGameValue | null>(null);

/** How often (ms) the local countdown re-reads the engine's live
 * timeRemainingMs between actual engine state emissions. */
const TIME_TICK_MS = 200;

/** Ceiling on how long the public reveal (currentDraw/streamHistory) waits
 * for Wheel.tsx's reportWheelLanded() before firing anyway. Generous
 * relative to Wheel.tsx's own worst-case landing duration
 * (MAX_APPROACH_MS = 1800ms there) — kept in sync manually since Wheel
 * doesn't currently export that constant; revisit if the two drift. */
const PUBLIC_REVEAL_FALLBACK_MS = 6000;

export function GameProvider({
  children,
  demoPreset = false,
}: {
  children: ReactNode;
  demoPreset?: boolean;
}) {
  // Exactly one ChainsGame instance for the lifetime of this provider.
  const gameRef = useRef<ChainsGame | null>(null);
  if (gameRef.current === null) {
    gameRef.current = new ChainsGame();
  }
  const game = gameRef.current;

  const demoPresetAppliedRef = useRef(false);
  useLayoutEffect(() => {
    if (!demoPreset || demoPresetAppliedRef.current) return;
    demoPresetAppliedRef.current = true;
    applyDemoJackpotPreset(game);
  }, [demoPreset, game]);

  const [gameState, setGameState] = useState<GameState>(() => game.getState());
  const [simulatedActivity, setSimulatedActivity] = useState<SimulatedActivity>(() => game.getSimulatedActivity());
  const [forcedQueue, setForcedQueue] = useState<number[]>(() => game.peekForcedDraws());
  const [timeRemaining, setTimeRemaining] = useState<number>(() => game.getState().timeRemainingMs);
  const [jackpotCelebration, setJackpotCelebration] = useState<{
    ticketId: string;
    tier: JackpotTierName;
    amount: number;
  } | null>(null);
  // Ticket ids whose LOST/JACKPOT_LOST transition is being held visible
  // briefly (red-X flash) before dropping into history. Pure display
  // delay — does not touch engine state.
  const [flashingFailedIds, setFlashingFailedIds] = useState<Set<string>>(new Set());
  const failedFlashTimeoutsRef = useRef<Map<string, number>>(new Map());
  
  const [payoutFlash, setPayoutFlash] = useState<{ amount: number; key: number } | null>(null);
  const payoutFlashTimeoutRef = useRef<number | null>(null);
  const [jackpotPick, setJackpotPick] = useState<[number | null, number | null]>([null, null]);
  const roundBetsRef = useRef<BetRequest[]>([]);
  const [lastRoundBets, setLastRoundBets] = useState<BetRequest[]>([]);
  // --- Reveal-delayed draw/stream state (public reveal) ----------------
  // Held back from the raw engine value until Wheel.tsx confirms its
  // landing animation has actually finished. See file header and
  // MIN_REVEAL_DELAY_MS for why this exists.
  const [revealedDraw, setRevealedDraw] = useState<{
    currentDraw: DrawResult | null;
    streamHistory: DrawResult[];
    tickets: Ticket[];
    balance: number;
    jackpotPools: JackpotPools;
  }>(() => {
    const initial = game.getState();
    return {
      currentDraw: initial.currentDraw,
      streamHistory: initial.streamHistory,
      tickets: initial.tickets,
      balance: initial.balance,
      jackpotPools: initial.jackpotPools,
    };
  });
  // Tracks the drawIndex already scheduled/revealed so the subscribe
  // callback only reacts to genuinely NEW draws — the engine emits on
  // every action (bets placed, jackpot pool ticks, ticket progress, etc.),
  // not just draws.
  const lastSeenDrawIndexRef = useRef<number>(revealedDraw.currentDraw?.drawIndex ?? 0);
  // Last status seen per ticket id, used to fire outcome sounds exactly
  // once per genuine transition (see applyTicketSounds below).
  const prevTicketStatusRef = useRef<Map<string, TicketStatus>>(new Map());
  // Tracks each ticket's last-seen baseProgress/jackpotProgress so an
  // intermediate digit match can be detected even when `status` itself
  // doesn't change this draw (e.g. ACTIVE -> ACTIVE, one step further in).
  const prevTicketProgressRef = useRef<Map<string, { baseProgress: number; jackpotProgress: number }>>(new Map());
  // Holds a pending "play the outcome sounds for this draw" closure,
  // queued the instant the wheel starts its landing approach but not
  // actually invoked until commitPublicReveal() fires — i.e. exactly when
  // the wheel has visually settled (or the fallback timer expires). This
  // is what stops the player hearing a win/loss chime before the wheel
  // stops spinning.
  const applyTicketSoundsRef = useRef<(() => void) | null>(null);

  // --- Wheel landing target (stage 1 of the reveal pipeline) -----------
  const [wheelTargetDraw, setWheelTargetDraw] = useState<DrawResult | null>(() => game.getState().currentDraw);
  // Holds the next public-reveal payload until either Wheel.tsx calls
  // reportWheelLanded() or the fallback timer below fires.
  const pendingPublicRevealRef = useRef<{
    currentDraw: DrawResult | null;
    streamHistory: DrawResult[];
    tickets: Ticket[];
    balance: number;
    jackpotPools: JackpotPools;
  } | null>(null);
  const publicRevealFallbackTimeoutRef = useRef<number | null>(null);

  const commitPublicReveal = useCallback(() => {
    if (publicRevealFallbackTimeoutRef.current !== null) {
      window.clearTimeout(publicRevealFallbackTimeoutRef.current);
      publicRevealFallbackTimeoutRef.current = null;
    }
    if (pendingPublicRevealRef.current === null) return;
    setRevealedDraw(pendingPublicRevealRef.current);
    pendingPublicRevealRef.current = null;
    // Sounds are gated on this exact commit point — never earlier — so a
    // win/loss chime can never leak out before the wheel visually lands.
    if (applyTicketSoundsRef.current) {
      const fn = applyTicketSoundsRef.current;
      applyTicketSoundsRef.current = null;
      fn();
    }
  }, []);

  /** Called by Wheel.tsx once its landing animation has visually settled.
   * This is what actually reveals currentDraw/streamHistory, and unlocks
   * any pending outcome sound for this draw. */
  const reportWheelLanded = useCallback(() => {
    commitPublicReveal();
  }, [commitPublicReveal]);

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
        let baseWinTotal = 0;
        for (const ticket of tickets) {
          const previousStatus = prevTicketStatusRef.current.get(ticket.id);
          const previousProgress = prevTicketProgressRef.current.get(ticket.id);
          const statusChanged = previousStatus !== ticket.status;
          const baseAdvanced = previousProgress !== undefined && ticket.baseProgress > previousProgress.baseProgress;          
          const jackpotAdvanced = previousProgress !== undefined && ticket.jackpotProgress > previousProgress.jackpotProgress;

          prevTicketStatusRef.current.set(ticket.id, ticket.status);
          prevTicketProgressRef.current.set(ticket.id, {
            baseProgress: ticket.baseProgress,
            jackpotProgress: ticket.jackpotProgress,
          });

          if (statusChanged) {
            if (ticket.status === 'JACKPOT_WON') {
              playJackpotFanfare();
              if (ticket.jackpotWinAmount !== null) {
                setJackpotCelebration({ ticketId: ticket.id, tier: ticket.jackpotTier, amount: ticket.jackpotWinAmount });
              }
              continue;
            }
            if (ticket.status === 'BASE_WON') {
              baseWinTotal += ticket.baseWinAmount ?? 0;
              playBaseWin();
              continue;
            }
            if (ticket.status === 'LOST' || ticket.status === 'JACKPOT_LOST') {
              setFlashingFailedIds((prev) => {
                const next = new Set(prev);
                next.add(ticket.id);
                return next;
              });
              const existing = failedFlashTimeoutsRef.current.get(ticket.id);
              if (existing !== undefined) window.clearTimeout(existing);
              const timeoutId = window.setTimeout(() => {
                setFlashingFailedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(ticket.id);
                  return next;
                });
                failedFlashTimeoutsRef.current.delete(ticket.id);
              }, 900);
              failedFlashTimeoutsRef.current.set(ticket.id, timeoutId);
              continue;
            }
          }
          // A digit matched but the link isn't fully resolved yet (e.g.
          // base step 1/3 -> 2/3, or jackpot step 1 -> 2 mid-qualification).
          if (baseAdvanced || jackpotAdvanced) playStepMatch();
         }
          if (baseWinTotal > 0) {
          setPayoutFlash({ amount: baseWinTotal, key: Date.now() });
          if (payoutFlashTimeoutRef.current !== null) window.clearTimeout(payoutFlashTimeoutRef.current);
          payoutFlashTimeoutRef.current = window.setTimeout(() => setPayoutFlash(null), 2500);
        }
      };

      const incomingDrawIndex = nextState.currentDraw?.drawIndex ?? 0;
      if (incomingDrawIndex === lastSeenDrawIndexRef.current) {
        // Not a new draw. If a reveal is pending, hold everything back until the wheel lands.
        if (pendingPublicRevealRef.current !== null) return;
        setRevealedDraw((prev) => ({
          ...prev,
          tickets: nextState.tickets,
          balance: nextState.balance,
          jackpotPools: nextState.jackpotPools,
        }));
        applyTicketSounds(nextState.tickets);
        return;
      }
      lastSeenDrawIndexRef.current = incomingDrawIndex;

      // Wheel starts decelerating toward the digit immediately; it stays hidden until it lands.
      setWheelTargetDraw(nextState.currentDraw);
      applyTicketSoundsRef.current = () => applyTicketSounds(nextState.tickets);
      pendingPublicRevealRef.current = {
        currentDraw: nextState.currentDraw,
        streamHistory: nextState.streamHistory,
        tickets: nextState.tickets,
        balance: nextState.balance,
        jackpotPools: nextState.jackpotPools,
      };
      if (publicRevealFallbackTimeoutRef.current !== null) {
        window.clearTimeout(publicRevealFallbackTimeoutRef.current);
      }
      publicRevealFallbackTimeoutRef.current = window.setTimeout(commitPublicReveal, PUBLIC_REVEAL_FALLBACK_MS);
    });
    game.start();
    return () => {
      unsubscribe();
      game.destroy();
      if (publicRevealFallbackTimeoutRef.current !== null) {
        window.clearTimeout(publicRevealFallbackTimeoutRef.current);
        publicRevealFallbackTimeoutRef.current = null;
      }
      failedFlashTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      failedFlashTimeoutsRef.current.clear();
      if (payoutFlashTimeoutRef.current !== null) window.clearTimeout(payoutFlashTimeoutRef.current);
    };
  }, [game]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeRemaining(game.getState().timeRemainingMs);
    }, TIME_TICK_MS);
    return () => window.clearInterval(interval);
  }, [game]);

  const [autoBet, setAutoBet] = useState<AutoBetState | null>(null);
  const [autoBetError, setAutoBetError] = useState<string | null>(null);
  const prevBettingPhaseRef = useRef<GamePhase>(gameState.phase);

  useEffect(() => {
    const entered = gameState.phase === 'BETTING_OPEN' && prevBettingPhaseRef.current !== 'BETTING_OPEN';
    prevBettingPhaseRef.current = gameState.phase;
    if (entered && roundBetsRef.current.length > 0) {
      setLastRoundBets(roundBetsRef.current);
      roundBetsRef.current = [];
    }
    if (!entered || !autoBet) return;
    const result = game.placeBet(autoBet.template);
    if (!result.success) {
      setAutoBetError(`Auto Bet stopped — ${result.message}`);
      setAutoBet(null);
      return;
    }
    const roundsRemaining = autoBet.roundsRemaining - 1;
    setAutoBet(roundsRemaining > 0 ? { ...autoBet, roundsRemaining } : null);
  }, [gameState.phase, autoBet, game]);

  const startAutoBet = useCallback(
    (request: BetRequest, rounds: number): PlaceBetResult => {
      const result = game.placeBet(request);
      if (!result.success) return result;
      setAutoBetError(null);
      if (rounds > 1) setAutoBet({ template: request, roundsRemaining: rounds - 1, roundsTotal: rounds });
      return result;
    },
    [game],
  );
  const stopAutoBet = useCallback(() => setAutoBet(null), []);
  const clearAutoBetError = useCallback(() => setAutoBetError(null), []);
  const bettingLocked = gameState.phase !== 'BETTING_OPEN' || autoBet !== null;
    const placeBet = useCallback(
    (request: BetRequest) => {
      const result = game.placeBet(request);
      if (result.success) roundBetsRef.current.push(cloneRequest(request));
      return result;
    },
    [game],
  );
  const placeBets = useCallback(
    (requests: BetRequest[], dryRun = false) => {
      const result = game.placeBets(requests, dryRun);
      if (result.success && !dryRun) roundBetsRef.current.push(...requests.map(cloneRequest));
      return result;
    },
    [game],
  );

  const forceNextDraw = useCallback((digit: number) => game.forceNextDraw(digit), [game]);
  const forceDrawSequence = useCallback((digits: number[]) => game.forceDrawSequence(digits), [game]);
  const clearForcedDraws = useCallback(() => game.clearForcedDraws(), [game]);

  const instantStep = useCallback(() => {
    game.instantStep();
  }, [game]);

  const setSpeed = useCallback((multiplier: number) => game.setSpeedMultiplier(multiplier), [game]);
  const pauseGame = useCallback(() => game.pause(), [game]);
  const resumeGame = useCallback(() => game.resume(), [game]);
  const resetGame = useCallback(() => {
    game.reset();
    commitPublicReveal();
    if (demoPreset) applyDemoJackpotPreset(game); // after commit, so pools aren't overwritten
    prevTicketStatusRef.current.clear();
    prevTicketProgressRef.current.clear();
    setJackpotCelebration(null);
    failedFlashTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    failedFlashTimeoutsRef.current.clear();
    setFlashingFailedIds(new Set());
    setPayoutFlash(null);
    setAutoBet(null);
    setAutoBetError(null);
    roundBetsRef.current = [];
    setLastRoundBets([]);
  }, [game, commitPublicReveal, demoPreset]);

  const dismissJackpotCelebration = useCallback(() => setJackpotCelebration(null), []);
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
      activeTickets: revealedDraw.tickets.filter((t) => !isTerminal(t.status) || flashingFailedIds.has(t.id)),
      history: revealedDraw.tickets.filter((t) => isTerminal(t.status) && !flashingFailedIds.has(t.id)),
      balance: revealedDraw.balance,
      jackpotPools: revealedDraw.jackpotPools,
      bettingLocked,
      autoBet,
      autoBetError,
      clearAutoBetError,
      startAutoBet,
      stopAutoBet,
      currentJackpotSequence: gameState.currentJackpotSequence,
      currentDraw: revealedDraw.currentDraw,
      streamHistory: revealedDraw.streamHistory,
      wheelTargetDraw,
      reportWheelLanded,
      phase: gameState.phase,
      timeRemaining,
      speedMultiplier: gameState.speedMultiplier,
      isPaused: gameState.isPaused,
      isRunning: gameState.isRunning,
      config: gameState.config,
      drawIndex: gameState.drawIndex,
      simulatedActivity,
      forcedQueue,
      jackpotCelebration,
      dismissJackpotCelebration,
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
      jackpotPick,
      setJackpotPick,
      payoutFlash,
      lastRoundBets,
      placeBets,
    }),
    [
      gameState,
      revealedDraw,
      flashingFailedIds,
      wheelTargetDraw,
      reportWheelLanded,
      timeRemaining,
      simulatedActivity,
      forcedQueue,
      jackpotCelebration,
      dismissJackpotCelebration,
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
      jackpotPick,
      setJackpotPick,
      bettingLocked,
      autoBet,
      autoBetError,
      clearAutoBetError,
      startAutoBet,
      stopAutoBet,
      payoutFlash,
      lastRoundBets,
      placeBets,
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
