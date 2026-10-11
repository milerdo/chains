import { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { calculateComboStake, countComboPossibilities } from '../game/combo';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, TICKET_STAKE } from '../game/constants';
import { DIGIT_COLORS } from '../utils/digitColors';
import type { BetRequest, TicketTier } from '../game/types';

const MAX_DIGIT_SLOTS = BASE_SEQUENCE_LENGTH.HIGH;
const AUTO_BET_PRESETS = [5, 10, 25, 50];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const TIER_DISPLAY_LABEL: Record<TicketTier, string> = { LOW: 'LOW', MEDIUM: 'MIDI', HIGH: 'HIGH' };

function tierForDigitCount(count: number): TicketTier | null {
  return count === 1 ? 'LOW' : count === 2 ? 'MEDIUM' : count === 3 ? 'HIGH' : null;
}

const randDigit = () => Math.floor(Math.random() * 10);

export function BettingPanel() {
  const {
    placeBet, balance, jackpotPick, setJackpotPick, bettingLocked: locked,
    autoBet, autoBetError, clearAutoBetError, startAutoBet, stopAutoBet,
  } = useGame();
  const [digits, setDigits] = useState<number[]>([]);
  const [isCombo, setIsCombo] = useState(false);
  const [jackpotFocus, setJackpotFocus] = useState<0 | 1 | null>(null);
  const [autoBetPickerOpen, setAutoBetPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (!autoBetError) return;
    const t = window.setTimeout(clearAutoBetError, 4000);
    return () => window.clearTimeout(t);
  }, [autoBetError, clearAutoBetError]);

  useEffect(() => {
    if (locked) {
      setJackpotFocus(null);
      setAutoBetPickerOpen(false);
    }
  }, [locked]);

  const shownFeedback: typeof feedback = autoBetError ? { type: 'error', message: autoBetError } : feedback;

  const tier = tierForDigitCount(digits.length);
  const comboActive = digits.length >= 2 && isCombo;
  const possibilityCount = comboActive ? countComboPossibilities(digits) : 1;
  const totalStake = tier === null ? 0 : comboActive ? calculateComboStake(digits) : TICKET_STAKE;
  const payout = tier === null ? 0 : BASE_MULTIPLIERS[tier] * TICKET_STAKE;
  const canSubmit = !locked && tier !== null && balance >= totalStake;
  const padActive = !locked && (jackpotFocus !== null || digits.length < MAX_DIGIT_SLOTS);

  function handleDigitPress(digit: number) {
    if (locked) return;
    playUiClick();
    setFeedback(null);
    clearAutoBetError();
    if (jackpotFocus !== null) {
      const next: [number, number] = [jackpotPick[0], jackpotPick[1]];
      next[jackpotFocus] = digit;
      setJackpotPick(next);
      setJackpotFocus(jackpotFocus === 0 ? 1 : null);
      return;
    }
    if (digits.length < MAX_DIGIT_SLOTS) setDigits((prev) => [...prev, digit]);
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

  function setOrder(combo: boolean) {
    if (locked) return;
    playUiClick();
    setIsCombo(combo);
  }

  function focusJackpotSlot(index: 0 | 1) {
    if (locked) return;
    playUiClick();
    setJackpotFocus((f) => (f === index ? null : index));
  }

  function handleRerollJackpot() {
    if (locked) return;
    playUiClick();
    setJackpotPick([randDigit(), randDigit()]);
    setJackpotFocus(null);
  }

  function buildRequest(): BetRequest {
    return {
      selections: [{ tier: tier as TicketTier, digits, isCombo: comboActive }],
      jackpotSequence: jackpotPick,
    };
  }

  function resetEntry() {
    setDigits([]);
    setIsCombo(false);
    setJackpotFocus(null);
    setAutoBetPickerOpen(false);
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

  function handleStartAutoBet(rounds: number) {
    if (!canSubmit) return;
    const result = startAutoBet(buildRequest(), rounds);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.message });
      return;
    }
    playUiClick();
    resetEntry();
    setFeedback({ type: 'success', message: `Auto Bet started (${rounds} round${rounds === 1 ? '' : 's'}).` });
  }

  const chipBtn =
    'rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm sm:p-5"
    >
      {/* Digits: tap a filled slot to remove it; pad fills the next free slot */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: MAX_DIGIT_SLOTS }, (_, i) => {
          const digit = digits[i] as number | undefined;
          const filled = digit !== undefined;
          const isNext = !locked && jackpotFocus === null && i === digits.length;
          return (
            <button
              key={i}
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
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        {tier ? (
          <>
            <span className="rounded-full bg-[#eab308]/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#eab308]">
              {TIER_DISPLAY_LABEL[tier]}
            </span>
            <span className="font-mono text-[11px] text-white/60">
              Pays <span className="font-bold text-white">{formatCurrency(payout)}</span>
              {comboActive && ` · ${possibilityCount} link${possibilityCount === 1 ? '' : 's'} · ${formatCurrency(totalStake)} stake`}
            </span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-white/30">Pick 1–3 digits</span>
        )}
      </div>

      <DigitPad active={padActive} onPress={handleDigitPress} />

      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" onClick={handleClear} disabled={locked || digits.length === 0} className={chipBtn}>
          Clear
        </button>
        <button type="button" onClick={handleRandom} disabled={locked} className={chipBtn}>
          Random
        </button>
      </div>

      <div role="group" aria-label="Number order" className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.03] p-1">
        <OrderButton label="Exact order" active={!comboActive} disabled={locked} onClick={() => setOrder(false)} />
        <OrderButton label="Any order" active={comboActive} disabled={locked || digits.length < 2} onClick={() => setOrder(true)} />
      </div>

      {/* Jackpot sequence: persists across rounds until edited or rerolled */}
      <div className="mt-2 flex items-center justify-between rounded-xl border border-[#eab308]/15 bg-[#eab308]/[0.03] px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#eab308]/70">Jackpot sequence</span>
        <div className="flex items-center gap-2">
          <JackpotSlot small value={jackpotPick[0]} focused={jackpotFocus === 0} disabled={locked} onClick={() => focusJackpotSlot(0)} />
          <span className="font-mono text-xs text-white/25">→</span>
          <JackpotSlot small value={jackpotPick[1]} focused={jackpotFocus === 1} disabled={locked} onClick={() => focusJackpotSlot(1)} />
          <button
            type="button"
            onClick={handleRerollJackpot}
            disabled={locked}
            aria-label="Randomize jackpot sequence"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ⟳
          </button>
        </div>
      </div>

      {shownFeedback && (
        <p
          role="status"
          className={[
            'mt-2 rounded-lg px-3 py-1.5 text-center text-xs',
            shownFeedback.type === 'success' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300',
          ].join(' ')}
        >
          {shownFeedback.message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 rounded-b-3xl border-t border-white/[0.06] bg-[#141414]/95 px-4 pb-4 pt-3 backdrop-blur-sm sm:-mx-5 sm:-mb-5 sm:px-5 sm:pb-5">
        {autoBet ? (
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-xl border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#eab308]">
              {autoBet.roundsTotal - autoBet.roundsRemaining}/{autoBet.roundsTotal} rounds
            </span>
            <button
              type="button"
              onClick={() => { playUiClick(); stopAutoBet(); setFeedback({ type: 'success', message: 'Auto Bet stopped.' }); }}
              className="rounded-xl border border-white/10 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/60 transition hover:border-red-400/40 hover:text-red-300"
            >
              Stop
            </button>
          </div>
        ) : (
          <>
            {autoBetPickerOpen && (
              <div className="mb-2 flex items-center justify-end gap-1.5">
                <span className="mr-auto font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">Auto rounds</span>
                {AUTO_BET_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleStartAutoBet(n)}
                    disabled={!canSubmit}
                    className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] font-mono text-xs font-bold text-white/70 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={[
                  'flex h-12 flex-1 items-center justify-center rounded-xl px-4 font-mono text-sm font-bold uppercase tracking-[0.2em] transition',
                  canSubmit
                    ? 'bg-[#eab308] text-black shadow-[0_0_24px_-6px_rgba(234,179,8,0.7)] hover:bg-[#facc15]'
                    : 'cursor-not-allowed bg-white/[0.06] text-white/25',
                ].join(' ')}
              >
                {tier === null
                  ? 'Select Digits'
                  : comboActive
                    ? `Place ${formatCurrency(totalStake)} Any-Order Bet`
                    : `Place ${formatCurrency(totalStake)} Bet`}
              </button>
              <button
                type="button"
                onClick={() => { playUiClick(); setAutoBetPickerOpen((o) => !o); }}
                disabled={!canSubmit}
                className={`${chipBtn} h-12 rounded-xl px-4`}
              >
                Auto
              </button>
            </div>
          </>
        )}
      </div>
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
          style={{ backgroundColor: `${DIGIT_COLORS[digit]}80`, borderColor: `${DIGIT_COLORS[digit]}80` }}
          className="flex h-10 items-center justify-center rounded-lg border font-mono text-lg font-bold tabular-nums text-white transition hover:brightness-125 active:scale-95"        
          >
          {digit}
        </button>
      ))}
    </div>
  );
}

function OrderButton({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'rounded-lg py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-30',
        active ? 'bg-[#eab308] text-black' : 'text-white/50 hover:text-white/80',
      ].join(' ')}
    >
      {label}
    </button>
  );
}