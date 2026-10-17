// ============================================================================
// CHAINS — JackpotPanel
// High-contrast banner for the three progressive pools. Each pool eases
// toward its new value with a short numeric tween whenever it changes
// (funding contributions or a payout reset), rather than snapping instantly.
// MINI / MIDI / GRAND all share identical typography (font size, weight,
// padding) — only the accent color and glow intensity differ between tiers.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import type { JackpotTierName } from '../game/types';

function useAnimatedValue(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}

const TIER_LABEL: Record<JackpotTierName, string> = { MINI: 'LOW', MIDI: 'MIDI', GRAND: 'HIGH' };

function JackpotCell({ tierName, amount, size }: { tierName: JackpotTierName; amount: number; size: string }) {
  const animated = useAnimatedValue(amount);

  return (
    <div className="relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap">
      {tierName === 'GRAND' && (
        <span className="pointer-events-none absolute -inset-x-2 inset-y-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.07] to-transparent" />
      )}
      <span className={`relative font-mono ${size} font-semibold uppercase leading-none tracking-[0.08em] text-[#fbbf24]`}>
        {TIER_LABEL[tierName]}
      </span>
      <span className={`relative font-mono ${size} font-bold leading-none tabular-nums text-white`}>
        {formatCompactCurrency(animated)}
      </span>
    </div>
  );
}

export function JackpotPanel() {
  const { jackpotPools, payoutFlash } = useGame();

  const longest = Math.max(
    ...(['MINI', 'MIDI', 'GRAND'] as const).map((t) => formatCompactCurrency(jackpotPools[t]).length),
  );
  // "$8,300.00" = 9 chars, "$10,000.00" = 10, "$100,000.00" = 11, "$1,000,000.00" = 13
  const size =
    longest <= 9 ? 'text-[13px] sm:text-[15px]'
    : longest === 10 ? 'text-[12px] sm:text-[14px]'
    : longest === 11 ? 'text-[11px] sm:text-[13px]'
    : 'text-[10px] sm:text-[11px]';

  return (
    <section
      aria-label="Progressive jackpots"
      className="relative flex h-10 w-full shrink-0 items-center justify-around overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-2"
    >
      <JackpotCell tierName="MINI" amount={jackpotPools.MINI} size={size} />
      <JackpotCell tierName="MIDI" amount={jackpotPools.MIDI} size={size} />
      <JackpotCell tierName="GRAND" amount={jackpotPools.GRAND} size={size} />
      {payoutFlash && (
        <div
          key={payoutFlash.key}
          className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-emerald-400 bg-[#0b1a12] font-mono text-sm font-bold uppercase tracking-[0.15em] text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.55)]"
        >
          Base win {formatCurrency(payoutFlash.amount)} paid
        </div>
      )}
    </section>
  );
}