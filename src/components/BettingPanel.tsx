import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { calculateComboStake, countComboPossibilities } from '../game/combo';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, TICKET_STAKE } from '../game/constants';
import { DIGIT_COLORS } from '../utils/digitColors';
import type { BetRequest, BetSelection, GamePhase, TicketTier } from '../game/types';

const MAX_DIGIT_SLOTS = BASE_SEQUENCE_LENGTH.HIGH; // 3 — the widest entry, spec Section 5a
const DEFAULT_AUTO_BET_ROUNDS = 5;
const MIN_AUTO_BET_ROUNDS = 1;
const MAX_AUTO_BET_ROUNDS = 50;

const TIER_META: Record<TicketTier, { odds: string; description: string }> = {
  LOW: { odds: `${BASE_MULTIPLIERS.LOW}x`, description: '1 digit' },
  MEDIUM: { odds: `${BASE_MULTIPLIERS.MEDIUM}x`, description: '2 digits' },
  HIGH: { odds: `${BASE_MULTIPLIERS.HIGH}x`, description: '3 digits' },
};

/** Section 5a: the number of digits entered IS the tier selection — no
 * separate chip/toggle. 0 filled slots = no tier yet. */
function tierForDigitCount(count: number): TicketTier | null {
  if (count === 1) return 'LOW';
  if (count === 2) return 'MEDIUM';
  if (count === 3) return 'HIGH';
  return null;
}

type EditTarget = { kind: 'digit'; index: number } | { kind: 'jackpot'; index: 0 | 1 } | null;
interface AutoBetState {
  template: BetRequest;
  roundsRemaining: number;
  roundsTotal: number;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface BettingPanelProps {
  onLockChange?: (locked: boolean) => void;
  onAutoBetChange?: (state: { roundsRemaining: number; roundsTotal: number; stop: () => void } | null) => void;

}

export function BettingPanel({ onLockChange, onAutoBetChange }: BettingPanelProps) {
  const { placeBet, phase, balance, currentJackpotSequence, hasBetThisRound } = useGame();
  const [digits, setDigits] = useState<(number | null)[]>(() => Array(MAX_DIGIT_SLOTS).fill(null));
  const [jackpotDigits, setJackpotDigits] = useState<[number | null, number | null]>(currentJackpotSequence);
  const [isCombo, setIsCombo] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>({ kind: 'digit', index: 0 });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoBetRounds, setAutoBetRounds] = useState(DEFAULT_AUTO_BET_ROUNDS);
  const [autoBet, setAutoBet] = useState<AutoBetState | null>(null);
  const autoBetActive = autoBet !== null;
  const prevPhaseRef = useRef<GamePhase>(phase);

  // Auto-dismiss the confirmation/error message a few seconds after it
  // appears, instead of leaving it on screen indefinitely. Re-runs (and so
  // restarts the countdown) whenever a *new* feedback object is set — e.g.
  // placing another bet quickly replaces the timer rather than stacking one.
  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  // On every genuine entry into a NEW BETTING_OPEN round: unlock the form
  // (hasBetThisRound reset). The jackpot digit slots are intentionally NOT
  // re-seeded here anymore — the player's jackpot combination now persists
  // across rounds until they manually edit it or use the reroll (⟳)
  // control, rather than being overwritten by the engine's freshly
  // auto-generated combination every round. Auto Bet resubmission
  // (unchanged logic) piggybacks on the same phase-entry check, same
  // pattern Wheel.tsx uses for detecting entry into DRAWING.
  useEffect(() => {
    const enteredBettingOpen = phase === 'BETTING_OPEN' && prevPhaseRef.current !== 'BETTING_OPEN';
    prevPhaseRef.current = phase;

    if (enteredBettingOpen) {
    }

    if (!enteredBettingOpen || !autoBet) return;

    const result = placeBet(autoBet.template);
    if (!result.success) {
      setFeedback({ type: 'error', message: `Auto Bet stopped — ${result.message}` });
      setAutoBet(null);
      return;
    }
    setFeedback({ type: 'success', message: result.message });
    setAutoBet((prev) => {
      if (!prev) return null;
      const roundsRemaining = prev.roundsRemaining - 1;
      return roundsRemaining > 0 ? { ...prev, roundsRemaining } : null;
    });
  }, [phase, autoBet, placeBet]);

  const isBettingOpen = phase === 'BETTING_OPEN';
  const locked = !isBettingOpen || autoBetActive || hasBetThisRound;

  useEffect(() => {
    onLockChange?.(locked);
  }, [locked, onLockChange]);

  const filledDigits = digits.filter((d): d is number => d !== null);
  const filledCount = filledDigits.length;
  const detectedTier = tierForDigitCount(filledCount);

  function focusDigitSlot(index: number) {
    if (locked) return;
    playUiClick();
    setEditTarget({ kind: 'digit', index });
  }

  function focusJackpotSlot(index: 0 | 1) {
    if (locked) return;
    playUiClick();
    setEditTarget({ kind: 'jackpot', index });
  }

  function advanceFocus(current: NonNullable<EditTarget>) {
    if (current.kind === 'digit') {
      if (current.index + 1 < MAX_DIGIT_SLOTS) {
        setEditTarget({ kind: 'digit', index: current.index + 1 });
        return;
      }
      if (jackpotDigits[0] === null) {
        setEditTarget({ kind: 'jackpot', index: 0 });
        return;
      }
      if (jackpotDigits[1] === null) {
        setEditTarget({ kind: 'jackpot', index: 1 });
        return;
      }
      setEditTarget(null);
    } else {
      if (current.index === 0) {
        setEditTarget({ kind: 'jackpot', index: 1 });
        return;
      }
      setEditTarget(null);
    }
  }

  function handleDigitPress(digit: number) {
    if (!editTarget || locked) return;
    playUiClick();
    setFeedback(null);

    if (editTarget.kind === 'digit') {
      setDigits((prev) => {
        const next = [...prev];
        next[editTarget.index] = digit;
        return next;
      });
    } else {
      setJackpotDigits((prev) => {
        const next: [number | null, number | null] = [prev[0], prev[1]];
        next[editTarget.index] = digit;
        return next;
      });
    }
    advanceFocus(editTarget);
  }

  function handleClear() {
    if (locked) return;
    playUiClick();
    setDigits(Array(MAX_DIGIT_SLOTS).fill(null));
    setIsCombo(false);
    setEditTarget({ kind: 'digit', index: 0 });
    setFeedback(null);
  }

  /** Jackpot digits now persist across rounds until the player edits them
   * or rerolls — no longer auto-reseeded from the engine every round. */
  function handleRerollJackpot() {
    if (locked) return;
    playUiClick();
    setJackpotDigits([Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)]);
  }

  const comboAvailable = detectedTier !== null && detectedTier !== 'LOW';
  const comboActive = comboAvailable && isCombo;
  const jackpotComplete = jackpotDigits[0] !== null && jackpotDigits[1] !== null;
  const possibilityCount = comboActive ? countComboPossibilities(filledDigits) : 1;
  const totalStake = detectedTier === null ? 0 : comboActive ? calculateComboStake(filledDigits) : TICKET_STAKE;
  const canSubmit = isBettingOpen && !autoBetActive && !hasBetThisRound && detectedTier !== null && jackpotComplete && balance >= totalStake;

  function buildRequest(): BetRequest {
    const tier = detectedTier as TicketTier;
    const selection: BetSelection = { tier, digits: filledDigits, isCombo: comboActive };
    return { selections: [selection], jackpotSequence: jackpotDigits as [number, number] };
  }
  function handleSubmit() {
    if (!canSubmit) return;
    const result = placeBet(buildRequest());
    if (result.success) {
      playUiClick();
      setFeedback({ type: 'success', message: result.message });
      setEditTarget(null);
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  }

  function handleStartAutoBet() {
    if (!canSubmit) return;
    const request = buildRequest();
    const result = placeBet(request);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.message });
      return;
    }
    playUiClick();
    setEditTarget(null);
    const roundsRemaining = autoBetRounds - 1;
    setFeedback({
      type: 'success',
      message: `${result.message} — Auto Bet started (${autoBetRounds} round${autoBetRounds === 1 ? '' : 's'}).`,
    });
    if (roundsRemaining > 0) {
      setAutoBet({ template: request, roundsRemaining, roundsTotal: autoBetRounds });
    }
  }

  function handleStopAutoBet() {
    stopAutoBet();
  }

  const stopAutoBet = useCallback(() => {
    playUiClick();
    setAutoBet(null);
    setFeedback({ type: 'success', message: 'Auto Bet stopped.' });
    }, []);

    useEffect(() => {
      if (!onAutoBetChange) return;
      onAutoBetChange(
        autoBet ? { roundsRemaining: autoBet.roundsRemaining, roundsTotal: autoBet.roundsTotal, stop: stopAutoBet } : null,
      );
    }, [autoBet, onAutoBetChange, stopAutoBet]);

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm sm:p-5"
    >
      {/* Number Entry — Section 5a: tier is auto-detected by digit count */}
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Choose 1-3 Digits</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={locked || filledCount === 0}
             className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#eab308]/80 underline decoration-dotted transition hover:text-[#eab308] disabled:text-white/25 disabled:opacity-100"
          >
            Clear
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          {digits.map((digit, i) => {
            const isFocused = editTarget?.kind === 'digit' && editTarget.index === i;
            const filled = digit !== null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => focusDigitSlot(i)}
                disabled={locked}
                style={filled && !isFocused ? { backgroundColor: `${DIGIT_COLORS[digit]}33`, borderColor: DIGIT_COLORS[digit] } : undefined}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-lg font-bold tabular-nums transition',
                  isFocused
                    ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
                    : filled
                      ? 'text-white'
                      : 'border-dashed border-white/15 text-white/25',
                ].join(' ')}
              >
                {digit ?? '·'}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          {detectedTier ? (
            <>
              <span className="rounded-full bg-[#eab308]/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#eab308]">
                {detectedTier}
              </span>
              <span className="font-mono text-[11px] text-white/40">
                {TIER_META[detectedTier].odds} total return
              </span>
            </>
          ) : (
            <span className="font-mono text-[11px] text-white/30">Enter 1–3 digits to set volatility</span>
          )}
        </div>
      </div>

      {/* Combo — switch instead of checkbox, with inline explanation so the
          "any order" behavior is clear without a separate tooltip. Switch
          and the possibility/stake badge sit on independent rows/tracks so
          the badge appearing can never compress or offset the switch. */}
      {comboAvailable && (
        <div
          className={[
            'mt-2 rounded-xl border px-3.5 py-2 transition',
            isCombo
              ? 'border-[#eab308]/40 bg-[#eab308]/[0.06]'
              : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => {
              if (locked) return;
              playUiClick();
              setIsCombo((c) => !c);
            }}
            disabled={locked}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-white">Combo</span>
              <span className="font-mono text-[10px] text-white/40">Selected numbers in any order</span>
            </span>
            <span
              role="switch"
              aria-checked={isCombo}
              className={[
                'relative block h-5 w-9 shrink-0 rounded-full transition-colors',
                isCombo ? 'bg-[#eab308]' : 'bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-black shadow transition-transform',
                  isCombo ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
          {isCombo && (
            <p className="mt-1 text-right font-mono text-[10px] text-[#eab308]">
              {possibilityCount} possibilit{possibilityCount === 1 ? 'y' : 'ies'} · {formatCurrency(totalStake)}
            </p>
          )}
        </div>
      )}

      {/* Jackpot Combination — compact single row. Persists across rounds
          until edited or rerolled (Section 9 note in IMPLEMENTATION LOG).
          Intentionally minimal: the jackpot is a secondary/bonus feature,
          not the main game loop. */}
      <div className="mt-2 flex items-center justify-between rounded-xl border border-[#eab308]/15 bg-[#eab308]/[0.03] px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#eab308]/70">Jackpot</span>
        <div className="flex items-center gap-2">
          <JackpotSlot
            small
            value={jackpotDigits[0]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 0}
            disabled={locked}
            onClick={() => focusJackpotSlot(0)}
          />
          <span className="font-mono text-xs text-white/25">→</span>
          <JackpotSlot
            small
            value={jackpotDigits[1]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 1}
            disabled={locked}
            onClick={() => focusJackpotSlot(1)}
          />
          <button
            type="button"
            onClick={handleRerollJackpot}
            disabled={locked}
            aria-label="Reroll jackpot combination"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ⟳
          </button>
        </div>
      </div>

      <DigitPad active={editTarget !== null && !locked} onPress={handleDigitPress} />

      {feedback && (
        <p
          role="status"
          className={[
            'mt-2 rounded-lg px-3 py-1.5 text-center text-xs',
            feedback.type === 'success'
              ? 'bg-emerald-400/10 text-emerald-300'
              : 'bg-red-400/10 text-red-300',
          ].join(' ')}
        >
          {feedback.message}
        </p>
      )}

      {!autoBetActive && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">Auto Bet Rounds</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAutoBetRounds((r) => Math.max(MIN_AUTO_BET_ROUNDS, r - 1))}
              disabled={!isBettingOpen}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 font-mono text-sm text-white/60 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-sm font-bold tabular-nums text-white">{autoBetRounds}</span>
            <button
              type="button"
              onClick={() => setAutoBetRounds((r) => Math.min(MAX_AUTO_BET_ROUNDS, r + 1))}
              disabled={!isBettingOpen}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 font-mono text-sm text-white/60 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleStartAutoBet}
              disabled={!canSubmit}
              className={[
                'rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition',
                canSubmit
                  ? 'border-[#eab308]/50 text-[#eab308] hover:bg-[#eab308]/10'
                  : 'cursor-not-allowed border-white/10 text-white/25',
              ].join(' ')}
            >
              Auto Bet
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-5 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.30em] text-white/40">Total Stake:</span>
          <span className="font-mono text-xl font-bold tabular-nums text-white">{formatCurrency(totalStake)}</span>
        </div>
        {autoBetActive && autoBet ? (
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#eab308]">
              {autoBet.roundsTotal - autoBet.roundsRemaining}/{autoBet.roundsTotal} rounds
            </span>
            <button
              type="button"
              onClick={handleStopAutoBet}
              className="rounded-xl border border-white/10 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/60 transition hover:border-red-400/40 hover:text-red-300"
            >
              Stop
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={[
                'rounded-xl px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] transition',
                canSubmit
                  ? 'bg-[#eab308] text-black shadow-[0_0_24px_-6px_rgba(234,179,8,0.7)] hover:bg-[#facc15]'
                  : 'cursor-not-allowed bg-white/[0.06] text-white/25',
              ].join(' ')}
            >
              {isCombo ? 'Confirm Combo' : 'Place Bet'}
            </button>
          </div>
        )}
      </div>

      {hasBetThisRound && !autoBetActive && isBettingOpen && (
        <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
          Bet locked in for this round.
        </p>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
interface JackpotSlotProps {
  value: number | null;
  focused: boolean;
  disabled: boolean;
  onClick: () => void;
  small?: boolean;
}

function JackpotSlot({ value, focused, disabled, onClick, small }: JackpotSlotProps) {
  const filled = value !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={filled && !focused ? { backgroundColor: `${DIGIT_COLORS[value]}33`, borderColor: DIGIT_COLORS[value] } : undefined}
      className={[
        small
          ? 'flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-sm font-bold tabular-nums transition'
          : 'flex h-12 w-12 items-center justify-center rounded-xl border font-mono text-lg font-bold tabular-nums transition',
        focused
          ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
          : filled
            ? 'text-white'
            : 'border-dashed border-white/15 text-white/25',
      ].join(' ')}
    >
      {value ?? '·'}
    </button>
  );
}

interface DigitPadProps {
  active: boolean;
  onPress: (digit: number) => void;
}

/** Always two rows of five (0-4 / 5-9), on every breakpoint — a single
 * 10-across row was too congested to tap reliably. */
function DigitPad({ active, onPress }: DigitPadProps) {
  return (
    <div
      className={[
        'mt-3 grid grid-cols-5 gap-1.5 transition-opacity duration-200',
        active ? 'opacity-100' : 'pointer-events-none opacity-30',
      ].join(' ')}
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onPress(digit)}
          disabled={!active}
          style={{ backgroundColor: `${DIGIT_COLORS[digit]}26`, borderColor: `${DIGIT_COLORS[digit]}80` }}
          className="flex h-10 items-center justify-center rounded-lg border font-mono text-base font-semibold tabular-nums text-white transition hover:brightness-125 active:scale-95"
        >
          {digit}
        </button>
      ))}
    </div>
  );
}
