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

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH, TICKET_STAKE } from '../game/constants';
import type { BetRequest, GamePhase, TicketTier } from '../game/types';

const TIER_ORDER: TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];

const TIER_META: Record<TicketTier, { odds: string; description: string }> = {
  LOW: { odds: `${BASE_MULTIPLIERS.LOW}x`, description: '1 digit' },
  MEDIUM: { odds: `${BASE_MULTIPLIERS.MEDIUM}x`, description: '2 digits' },
  HIGH: { odds: `${BASE_MULTIPLIERS.HIGH}x`, description: '3 digits' },
};

const MIN_AUTO_BET_ROUNDS = 1;
const MAX_AUTO_BET_ROUNDS = 50;
const DEFAULT_AUTO_BET_ROUNDS = 5;

type EditTarget = { kind: 'tier'; tier: TicketTier; index: number } | { kind: 'jackpot'; index: 0 | 1 } | null;

interface AutoBetState {
  template: BetRequest;
  roundsRemaining: number;
  roundsTotal: number;
}

function emptySlots(tier: TicketTier): (number | null)[] {
  return Array(BASE_SEQUENCE_LENGTH[tier]).fill(null) as (number | null)[];
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function BettingPanel() {
  const { placeBet, phase, balance } = useGame();

const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);  const [tierDigits, setTierDigits] = useState<Record<TicketTier, (number | null)[]>>({
    LOW: emptySlots('LOW'),
    MEDIUM: emptySlots('MEDIUM'),
    HIGH: emptySlots('HIGH'),
  });
  const [jackpotDigits, setJackpotDigits] = useState<[number | null, number | null]>([null, null]);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
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

  // Auto Bet: re-submit the saved template the instant a NEW betting round
  // opens (not just "while" it's open — prevPhaseRef gates this to fire
  // exactly once per phase transition, the same pattern Wheel.tsx uses for
  // detecting entry into DRAWING). Stops itself if a resubmission ever
  // fails (e.g. balance ran out, or the 3-ticket concurrency cap was hit by
  // something else in the meantime) rather than failing silently on repeat.
  useEffect(() => {
    const enteredBettingOpen = phase === 'BETTING_OPEN' && prevPhaseRef.current !== 'BETTING_OPEN';
    prevPhaseRef.current = phase;
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
  const locked = !isBettingOpen || autoBetActive;

  function findFirstEmptyTierSlot(tier: TicketTier, digits: Record<TicketTier, (number | null)[]>): number {
    return digits[tier].findIndex((d) => d === null);
  }

function selectTier(tier: TicketTier) {
  if (locked) return;
  playUiClick();
  setFeedback(null);
  if (selectedTier === tier) {
    setSelectedTier(null);
    setEditTarget((current) => (current?.kind === 'tier' && current.tier === tier ? null : current));
    return;
  }
  setSelectedTier(tier);
  const firstEmpty = findFirstEmptyTierSlot(tier, tierDigits);
  setEditTarget({ kind: 'tier', tier, index: firstEmpty === -1 ? 0 : firstEmpty });
}

  function focusTierSlot(tier: TicketTier, index: number) {
  if (locked || selectedTier !== tier) return;
  playUiClick();
  setEditTarget({ kind: 'tier', tier, index });
}

  function focusJackpotSlot(index: 0 | 1) {
    if (locked) return;
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
  if (autoBetActive) return;
  playUiClick();
  setSelectedTier(null);
  setTierDigits({ LOW: emptySlots('LOW'), MEDIUM: emptySlots('MEDIUM'), HIGH: emptySlots('HIGH') });
  setJackpotDigits([null, null]);
  setEditTarget(null);
  setFeedback(null);
}

  const activeSelections = selectedTier ? [selectedTier] : [];
  const totalStake = activeSelections.length * TICKET_STAKE;
  const jackpotComplete = jackpotDigits[0] !== null && jackpotDigits[1] !== null;
  const allTiersComplete = activeSelections.every((tier) => tierDigits[tier].every((d) => d !== null));
  const canSubmit =
    isBettingOpen &&
    !autoBetActive &&
    activeSelections.length > 0 &&
    allTiersComplete &&
    jackpotComplete &&
    balance >= totalStake;

  function buildRequest(): BetRequest {
    const selections = activeSelections.map((tier) => ({ tier, digits: tierDigits[tier] as number[] }));
    return { selections, jackpotSequence: jackpotDigits as [number, number] };
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
    playUiClick();
    setAutoBet(null);
    setFeedback({ type: 'success', message: 'Auto Bet stopped.' });
  }

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Place Bet</span>
        {!isBettingOpen && !autoBetActive && (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Betting closed
          </span>
        )}
        {autoBetActive && (
          <span className="rounded-full bg-[#eab308]/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#eab308]">
            Auto Bet running
          </span>
        )}
      </div>

      {/* Tier toggles all on one row; digit slots for whichever tiers are
          included render below, one row per included tier. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TIER_ORDER.map((tier) => (
          <TierChip
          key={tier}
          tier={tier}
          included={selectedTier === tier}
          disabled={locked}
          onToggle={() => selectTier(tier)}
          />
        ))}
      </div>

      {activeSelections.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2">
          {activeSelections.map((tier) => (
            <TierDigitsRow
              key={tier}
              tier={tier}
              digits={tierDigits[tier]}
              editTarget={editTarget}
              disabled={locked}
              onFocusSlot={(index) => focusTierSlot(tier, index)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[#eab308]/20 bg-[#eab308]/[0.04] p-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#eab308]/80">
          Jackpot Combination
        </span>
        <div className="mt-2 flex items-center justify-center gap-3">
          <JackpotSlot
            value={jackpotDigits[0]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 0}
            disabled={locked}
            onClick={() => focusJackpotSlot(0)}
          />
          <span className="font-mono text-white/30">→</span>
          <JackpotSlot
            value={jackpotDigits[1]}
            focused={editTarget?.kind === 'jackpot' && editTarget.index === 1}
            disabled={locked}
            onClick={() => focusJackpotSlot(1)}
          />
        </div>
      </div>

      <DigitPad active={editTarget !== null && !locked} onPress={handleDigitPress} />

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

      {!autoBetActive && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
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

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Total Stake</span>
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
        )}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

interface TierChipProps {
  tier: TicketTier;
  included: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function TierChip({ tier, included, disabled, onToggle }: TierChipProps) {
  const meta = TIER_META[tier];

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={[
        'flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        included
          ? 'border-[#eab308]/35 bg-[#eab308]/[0.05]'
          : 'border-white/[0.07] bg-white/[0.015] hover:border-white/15',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-5 w-5 items-center justify-center rounded-md border text-[10px] transition',
          included ? 'border-[#eab308] bg-[#eab308] text-black' : 'border-white/20 text-transparent',
        ].join(' ')}
      >
        ✓
      </span>
      <span className="font-mono text-sm font-bold tracking-[0.1em] text-white">{tier}</span>
      <span className="font-mono text-[10px] text-white/35">{meta.description}</span>
      <span className="font-mono text-[10px] text-white/50">{meta.odds}</span>
    </button>
  );
}

interface TierDigitsRowProps {
  tier: TicketTier;
  digits: (number | null)[];
  editTarget: EditTarget;
  disabled: boolean;
  onFocusSlot: (index: number) => void;
}

function TierDigitsRow({ tier, digits, editTarget, disabled, onFocusSlot }: TierDigitsRowProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">{tier}</span>
      <div className="flex items-center gap-2">
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
