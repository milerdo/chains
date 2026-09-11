// ============================================================================
// CHAINS — BettingPanel
// Lets the player build up to 3 independent tier tickets (LOW/MEDIUM/HIGH)
// plus one shared 2-digit jackpot combination, then submits them as a
// single BetRequest to the engine. All validation (digit completeness,
// balance, the 3-ticket concurrency cap) is enforced by the engine itself
// (see engine.ts placeBetInternal) — this component only builds the
// request and surfaces whatever PlaceBetResult comes back.
//
// UX pattern: tapping a tier "chip" includes/excludes it from this bet.
// Included tiers show their sequence as a row of slots; tapping a slot (or
// a jackpot slot) focuses it, and the single shared digit pad below fills
// whichever slot is focused, then auto-advances to the next empty one —
// the same flow as entering a PIN.
// ============================================================================

import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, TICKET_STAKE } from '../game/constants';
import type { TicketTier } from '../game/types';

const TIER_ORDER: TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];

const TIER_META: Record<TicketTier, { odds: string; description: string }> = {
  LOW: { odds: `${BASE_MULTIPLIERS.LOW}x`, description: '1 digit' },
  MEDIUM: { odds: `${BASE_MULTIPLIERS.MEDIUM}x`, description: '2 digits, in order' },
  HIGH: { odds: `${BASE_MULTIPLIERS.HIGH}x`, description: '3 digits, in order' },
};

type EditTarget = { kind: 'tier'; tier: TicketTier; index: number } | { kind: 'jackpot'; index: 0 | 1 } | null;

function emptySlots(tier: TicketTier): (number | null)[] {
  return Array(BASE_SEQUENCE_LENGTH[tier]).fill(null) as (number | null)[];
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function BettingPanel() {
  const { placeBet, phase, balance } = useGame();

  const [includedTiers, setIncludedTiers] = useState<Set<TicketTier>>(new Set());
  const [tierDigits, setTierDigits] = useState<Record<TicketTier, (number | null)[]>>({
    LOW: emptySlots('LOW'),
    MEDIUM: emptySlots('MEDIUM'),
    HIGH: emptySlots('HIGH'),
  });
  const [jackpotDigits, setJackpotDigits] = useState<[number | null, number | null]>([null, null]);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isBettingOpen = phase === 'BETTING_OPEN';

  function findFirstEmptyTierSlot(tier: TicketTier, digits: Record<TicketTier, (number | null)[]>): number {
    return digits[tier].findIndex((d) => d === null);
  }

  function toggleTier(tier: TicketTier) {
    if (!isBettingOpen) return;
    playUiClick();
    setFeedback(null);
    setIncludedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
        setEditTarget((current) => (current?.kind === 'tier' && current.tier === tier ? null : current));
      } else {
        next.add(tier);
        const firstEmpty = findFirstEmptyTierSlot(tier, tierDigits);
        setEditTarget({ kind: 'tier', tier, index: firstEmpty === -1 ? 0 : firstEmpty });
      }
      return next;
    });
  }

  function focusTierSlot(tier: TicketTier, index: number) {
    if (!isBettingOpen || !includedTiers.has(tier)) return;
    playUiClick();
    setEditTarget({ kind: 'tier', tier, index });
  }

  function focusJackpotSlot(index: 0 | 1) {
    if (!isBettingOpen) return;
    playUiClick();
    setEditTarget({ kind: 'jackpot', index });
  }

  function advanceFocus(current: NonNullable<EditTarget>, digitsSnapshot: Record<TicketTier, (number | null)[]>) {
    if (current.kind === 'tier') {
      const slots = digitsSnapshot[current.tier];
      if (current.index + 1 < slots.length) {
        setEditTarget({ kind: 'tier', tier: current.tier, index: current.index + 1 });
        return;
      }
      const remainingTiers = TIER_ORDER.filter((t) => includedTiers.has(t) && t !== current.tier);
      for (const t of remainingTiers) {
        const firstEmpty = findFirstEmptyTierSlot(t, digitsSnapshot);
        if (firstEmpty !== -1) {
          setEditTarget({ kind: 'tier', tier: t, index: firstEmpty });
          return;
        }
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
    if (!editTarget || !isBettingOpen) return;
    playUiClick();
    setFeedback(null);

    if (editTarget.kind === 'tier') {
      setTierDigits((prev) => {
        const next = { ...prev, [editTarget.tier]: [...prev[editTarget.tier]] };
        next[editTarget.tier][editTarget.index] = digit;
        advanceFocus(editTarget, next);
        return next;
      });
    } else {
      setJackpotDigits((prev) => {
        const next: [number | null, number | null] = [prev[0], prev[1]];
        next[editTarget.index] = digit;
        return next;
      });
      advanceFocus(editTarget, tierDigits);
    }
  }

  function handleClear() {
    playUiClick();
    setIncludedTiers(new Set());
    setTierDigits({ LOW: emptySlots('LOW'), MEDIUM: emptySlots('MEDIUM'), HIGH: emptySlots('HIGH') });
    setJackpotDigits([null, null]);
    setEditTarget(null);
    setFeedback(null);
  }

  const activeSelections = TIER_ORDER.filter((tier) => includedTiers.has(tier));
  const totalStake = activeSelections.length * TICKET_STAKE;
  const jackpotComplete = jackpotDigits[0] !== null && jackpotDigits[1] !== null;
  const allTiersComplete = activeSelections.every((tier) => tierDigits[tier].every((d) => d !== null));
  const canSubmit =
    isBettingOpen && activeSelections.length > 0 && allTiersComplete && jackpotComplete && balance >= totalStake;

  function handleSubmit() {
    if (!canSubmit) return;
    const selections = activeSelections.map((tier) => ({ tier, digits: tierDigits[tier] as number[] }));
    const result = placeBet({ selections, jackpotSequence: jackpotDigits as [number, number] });
    if (result.success) {
      playUiClick();
      setFeedback({ type: 'success', message: result.message });
      setEditTarget(null);
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  }

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Place Bet</span>
        {!isBettingOpen && (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Betting closed
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {TIER_ORDER.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            included={includedTiers.has(tier)}
            digits={tierDigits[tier]}
            editTarget={editTarget}
            disabled={!isBettingOpen}
            onToggle={() => toggleTier(tier)}
            onFocusSlot={(index) => focusTierSlot(tier, index)}
          />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#eab308]/20 bg-[#eab308]/[0.04] p-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#eab308]/80">
          Jackpot Combination
        </span>
        <div className="mt-2 flex items-center justify-center gap-3">
          <JackpotSlot
            value={jackpotDigits[0]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 0}
            disabled={!isBettingOpen}
            onClick={() => focusJackpotSlot(0)}
          />
          <span className="font-mono text-white/30">→</span>
          <JackpotSlot
            value={jackpotDigits[1]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 1}
            disabled={!isBettingOpen}
            onClick={() => focusJackpotSlot(1)}
          />
        </div>
      </div>

      <DigitPad active={editTarget !== null && isBettingOpen} onPress={handleDigitPress} />

      {feedback && (
        <p
          role="status"
          className={[
            'mt-3 rounded-lg px-3 py-2 text-center text-xs',
            feedback.type === 'success'
              ? 'bg-emerald-400/10 text-emerald-300'
              : 'bg-red-400/10 text-red-300',
          ].join(' ')}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Total Stake</span>
          <span className="font-mono text-xl font-bold tabular-nums text-white">{formatCurrency(totalStake)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-white/10 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/50 transition hover:border-white/25 hover:text-white/80"
          >
            Clear
          </button>
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
            Place Bet
          </button>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

interface TierRowProps {
  tier: TicketTier;
  included: boolean;
  digits: (number | null)[];
  editTarget: EditTarget;
  disabled: boolean;
  onToggle: () => void;
  onFocusSlot: (index: number) => void;
}

function TierRow({ tier, included, digits, editTarget, disabled, onToggle, onFocusSlot }: TierRowProps) {
  const meta = TIER_META[tier];

  return (
    <div
      className={[
        'rounded-2xl border px-3.5 py-3 transition-colors duration-200',
        included ? 'border-[#eab308]/35 bg-[#eab308]/[0.05]' : 'border-white/[0.07] bg-white/[0.015]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span
            className={[
              'flex h-5 w-5 items-center justify-center rounded-md border text-[10px] transition',
              included ? 'border-[#eab308] bg-[#eab308] text-black' : 'border-white/20 text-transparent',
            ].join(' ')}
          >
            ✓
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="font-mono text-sm font-bold tracking-[0.1em] text-white">{tier}</span>
            <span className="font-mono text-[10px] text-white/35">
              {meta.description} · {meta.odds}
            </span>
          </span>
        </button>

        <span className="font-mono text-xs text-white/40">{formatCurrency(TICKET_STAKE)}</span>
      </div>

      {included && (
        <div className="mt-2.5 flex items-center gap-2 pl-7">
          {digits.map((digit, i) => {
            const isFocused = editTarget?.kind === 'tier' && editTarget.tier === tier && editTarget.index === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onFocusSlot(i)}
                disabled={disabled}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-base font-bold tabular-nums transition',
                  isFocused
                    ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
                    : digit !== null
                      ? 'border-white/15 bg-white/[0.04] text-white'
                      : 'border-dashed border-white/15 text-white/25',
                ].join(' ')}
              >
                {digit ?? '·'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface JackpotSlotProps {
  value: number | null;
  focused: boolean;
  disabled: boolean;
  onClick: () => void;
}

function JackpotSlot({ value, focused, disabled, onClick }: JackpotSlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-lg font-bold tabular-nums transition',
        focused
          ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
          : value !== null
            ? 'border-[#eab308]/30 bg-white/[0.04] text-white'
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

function DigitPad({ active, onPress }: DigitPadProps) {
  return (
    <div
      className={[
        'mt-4 grid grid-cols-5 gap-1.5 transition-opacity duration-200 sm:grid-cols-10',
        active ? 'opacity-100' : 'pointer-events-none opacity-30',
      ].join(' ')}
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onPress(digit)}
          disabled={!active}
          className="flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] font-mono text-sm font-semibold tabular-nums text-white/80 transition hover:border-[#eab308]/50 hover:bg-[#eab308]/10 hover:text-[#eab308] active:scale-95"
        >
          {digit}
        </button>
      ))}
    </div>
  );
}
