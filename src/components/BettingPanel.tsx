import { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { calculateComboStake, countComboPossibilities } from '../game/combo';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, TICKET_STAKE } from '../game/constants';
import { DIGIT_COLORS } from '../utils/digitColors';
import type { BetRequest, TicketTier } from '../game/types';

const MAX_DIGIT_SLOTS = BASE_SEQUENCE_LENGTH.HIGH;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];


function tierForDigitCount(count: number): TicketTier | null {
  return count === 1 ? 'LOW' : count === 2 ? 'MEDIUM' : count === 3 ? 'HIGH' : null;
}

const randDigit = () => Math.floor(Math.random() * 10);

export function BettingPanel() {
  const {
    placeBet, balance, jackpotPick, setJackpotPick, bettingLocked: locked,
  } = useGame();
  const [digits, setDigits] = useState<number[]>([]);
  const [isCombo, setIsCombo] = useState(false);
  const [jackpotFocus, setJackpotFocus] = useState<0 | 1 | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);


  useEffect(() => {
    if (locked) setJackpotFocus(null);
  }, [locked]);

  const tier = tierForDigitCount(digits.length);
  const comboActive = digits.length >= 2 && isCombo;
  const possibilityCount = comboActive ? countComboPossibilities(digits) : 1;
  const totalStake = tier === null ? 0 : comboActive ? calculateComboStake(digits) : TICKET_STAKE;
  const jackpotComplete = jackpotPick[0] !== null && jackpotPick[1] !== null;
  const waitingJackpot: 0 | 1 | null =
    locked ? null : jackpotFocus ?? (jackpotPick[0] === null ? 0 : jackpotPick[1] === null ? 1 : null);
  const canSubmit = !locked && tier !== null && jackpotComplete && balance >= totalStake;
  const padActive = !locked && (jackpotFocus !== null || digits.length < MAX_DIGIT_SLOTS || !jackpotComplete);

  function handleDigitPress(digit: number) {
    if (locked) return;
    playUiClick();
    setFeedback(null);
    if (jackpotFocus !== null) {
      const next: [number | null, number | null] = [jackpotPick[0], jackpotPick[1]];
      next[jackpotFocus] = digit;
      setJackpotPick(next);
      setJackpotFocus(jackpotFocus === 0 ? 1 : null);
      return;
    }
    if (digits.length < MAX_DIGIT_SLOTS) {
      setDigits((prev) => [...prev, digit]);
      return;
    }
    const empty = jackpotPick[0] === null ? 0 : jackpotPick[1] === null ? 1 : null;
    if (empty !== null) {
      const next: [number | null, number | null] = [jackpotPick[0], jackpotPick[1]];
      next[empty] = digit;
      setJackpotPick(next);
    }
  }

  function handleRemoveDigit(index: number) {
    if (locked) return;
    playUiClick();
    setFeedback(null);
    const next = digits.filter((_, i) => i !== index);
    setDigits(next);
    if (next.length < 2) setIsCombo(false);
  }

  function handleClear() {
    if (locked) return;
    playUiClick();
    setDigits([]);
    setIsCombo(false);
    setJackpotFocus(null);
    setFeedback(null);
  }

  /** Digits only. The jackpot pair is never touched. */
  function handleRandom() {
    if (locked) return;
    playUiClick();
    const count = 1 + Math.floor(Math.random() * MAX_DIGIT_SLOTS);
    setDigits(Array.from({ length: count }, randDigit));
    setIsCombo(false);
    setJackpotFocus(null);
    setFeedback(null);
  }

  function toggleAnyOrder() {
    if (locked || digits.length < 2) return;
    playUiClick();
    setIsCombo((c) => !c);
  }

  function focusJackpotSlot(index: 0 | 1) {
    if (locked) return;
    playUiClick();
    setJackpotFocus((f) => (f === index ? null : index));
  }

  function buildRequest(): BetRequest {
    return {
      selections: [{ tier: tier as TicketTier, digits, isCombo: comboActive }],
      jackpotSequence: jackpotPick as [number, number],
    };
  }

  function resetEntry() {
    setDigits([]);
    setIsCombo(false);
    setJackpotFocus(null);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const result = placeBet(buildRequest());
    if (result.success) {
      playUiClick();
      setFeedback({ type: 'success', message: result.message });
      resetEntry();
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  }

    const chipBtn =
    'rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30 self-stretch';

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm sm:p-5"
    >
          {/* Base digits and jackpot digits, each with its caption underneath */}
        <div className="flex items-start justify-center gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_DIGIT_SLOTS }, (_, i) => {
                const digit = digits[i] as number | undefined;
                const filled = digit !== undefined;
                const isNext = !locked && jackpotFocus === null && i === digits.length;
                return (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="font-mono text-xs text-white/25">→</span>}
                    <button
                      type="button"
                      onClick={() => handleRemoveDigit(i)}
                      disabled={locked || !filled}
                      aria-label={filled ? `Remove digit ${digit}` : 'Empty digit slot'}
                      style={filled ? { backgroundColor: `${DIGIT_COLORS[digit]}33`, borderColor: DIGIT_COLORS[digit] } : undefined}
                      className={[
                        'flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-lg font-bold tabular-nums transition disabled:cursor-default',
                        filled
                          ? 'text-white'
                          : isNext
                            ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
                            : 'border-dashed border-white/15 text-white/25',
                      ].join(' ')}
                    >
                      {digit ?? '·'}
                    </button>
                  </span>
                );
              })}
            </div>
            <span className="font-mono text-[11px] text-white/60">
              {tier ? (
                <>
                  Base chain pays <span className="font-bold text-white">{BASE_MULTIPLIERS[tier]}×</span>
                </>
              ) : (
                <span className="text-white/30">Pick 1–3 digits</span>
              )}
            </span>
          </div>

          <span aria-hidden="true" className="flex h-11 items-center font-mono text-m font-black text-[#eab308]">→</span>


          <div className="flex flex-col items-center gap-1.5">
            <div role="group" aria-label="Jackpot sequence" className="flex h-11 items-center gap-1.5">
              <JackpotSlot value={jackpotPick[0]} waiting={waitingJackpot === 0} disabled={locked} onClick={() => focusJackpotSlot(0)} />
              <span className="font-mono text-xs text-[#eab308]/60">→</span>
              <JackpotSlot value={jackpotPick[1]} waiting={waitingJackpot === 1} disabled={locked} onClick={() => focusJackpotSlot(1)} />
            </div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#eab308]/80">Jackpot</span>
          </div>
        </div>

        <DigitPad active={padActive} onPress={handleDigitPress} />

        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" onClick={handleClear} disabled={locked || digits.length === 0} className={chipBtn}>
            Clear
          </button>
          <button type="button" onClick={handleRandom} disabled={locked} className={chipBtn}>
            Random
          </button>
          <button
            type="button"
            onClick={toggleAnyOrder}
            disabled={locked || digits.length < 2}
            aria-pressed={comboActive}
            className={[
              'ml-auto flex flex-col items-center rounded-lg border-2 px-4 py-1 font-mono leading-tight transition disabled:cursor-not-allowed disabled:opacity-30',
              comboActive
                ? 'border-[#eab308] bg-[#eab308] text-black'
                : 'border-[#eab308]/60 bg-[#eab308]/[0.08] text-[#eab308] hover:bg-[#eab308]/20',
            ].join(' ')}
          >
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-80">Numbers in</span>
            <span className="text-xs font-black uppercase tracking-[0.15em]">Any order</span>
          </button>
        </div>

      {feedback && (
        <p
          role="status"
          className={[
            'mt-2 rounded-lg px-3 py-1.5 text-center text-xs',
            feedback.type === 'success' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300',
          ].join(' ')}
        >
          {feedback.message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 rounded-b-3xl border-t border-white/[0.06] bg-[#141414]/95 px-4 pb-4 pt-3 backdrop-blur-sm sm:-mx-5 sm:-mb-5 sm:px-5 sm:pb-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={[
            'flex h-12 w-full flex-col items-center justify-center rounded-xl px-4 font-mono font-bold uppercase leading-tight transition',
            canSubmit
              ? 'bg-[#eab308] text-black shadow-[0_0_24px_-6px_rgba(234,179,8,0.7)] hover:bg-[#facc15]'
              : 'cursor-not-allowed bg-white/[0.06] text-white/25',
          ].join(' ')}
        >
          <span className="text-sm tracking-[0.2em]">
            {tier === null
              ? 'Select Digits'
              : !jackpotComplete
                ? 'Set Jackpot Sequence'
                : `Place ${formatCurrency(totalStake)} Bet`}
          </span>
          {comboActive && (
            <span className="text-[10px] tracking-[0.12em] opacity-70">
              Any order · {possibilityCount} link{possibilityCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
interface JackpotSlotProps {
  value: number | null;
  waiting: boolean;
  disabled: boolean;
  onClick: () => void;
}

function JackpotSlot({ value, waiting, disabled, onClick }: JackpotSlotProps) {
  const filled = value !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={filled ? `Jackpot digit ${value}` : 'Empty jackpot digit'}
      style={filled && !waiting ? { backgroundColor: `${DIGIT_COLORS[value]}33` } : undefined}
      className={[
        'flex h-9 w-9 items-center justify-center rounded-lg border-2 font-mono text-sm font-bold tabular-nums transition',
        waiting
          ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)] animate-pulse'
          : filled
            ? 'border-[#eab308]/70 text-white'
            : 'border-dashed border-[#eab308]/40 text-[#eab308]/40',
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
          style={{ backgroundColor: `${DIGIT_COLORS[digit]}80`, borderColor: `${DIGIT_COLORS[digit]}80` }}
          className="flex h-10 items-center justify-center rounded-lg border font-mono text-lg font-bold tabular-nums text-white transition hover:brightness-125 active:scale-95"        
          >
          {digit}
        </button>
      ))}
    </div>
  );
}
