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

interface TierMeta {
  label: string;
  accent: string;
  glow: string;
  ring: string;
}

const TIER_META: Record<JackpotTierName, TierMeta> = {
  MINI: {
    label: 'LOW',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9)]',
    ring: 'border-[#eab308]/25',
  },
  MIDI: {
    label: 'MIDI',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9)]',
    ring: 'border-[#eab308]/25',
  },
  GRAND: {
    label: 'HIGH',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9)]',
    ring: 'border-[#eab308]/25',
  },
};

function JackpotTile({ tierName, amount }: { tierName: JackpotTierName; amount: number }) {
  const animated = useAnimatedValue(amount);
  const meta = TIER_META[tierName];

  return (
    <div
      className={[
        'relative flex-1 overflow-hidden rounded-lg border bg-gradient-to-b from-white/[0.03] to-transparent px-1.5 py-1.5 backdrop-blur-sm transition-shadow duration-700',
        meta.ring,
        meta.glow,
      ].join(' ')}
    >
      {tierName === 'GRAND' && (
        <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.07] to-transparent" />
      )}
      <div className="relative flex items-baseline justify-center gap-1 whitespace-nowrap">
        <span className={`font-mono text-[13px] font-semibold uppercase leading-none tracking-[0.1em] ${meta.accent}`}>
          {meta.label}
        </span>
        <span className="font-mono text-[13px] font-bold leading-none tabular-nums text-white">
          {formatCompactCurrency(animated)}
        </span>
      </div>
    </div>
  );
}

export function JackpotPanel() {
 const { jackpotPools, payoutFlash } = useGame();

  return (
    <section aria-label="Progressive jackpots" className="relative flex w-full gap-1.5">     
      <JackpotTile tierName="MINI" amount={jackpotPools.MINI} />
      <JackpotTile tierName="MIDI" amount={jackpotPools.MIDI} />
      <JackpotTile tierName="GRAND" amount={jackpotPools.GRAND} />
      {payoutFlash && (
        <div
          key={payoutFlash.key}
          className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-emerald-400 bg-[#0b1a12] font-mono text-sm font-bold uppercase tracking-[0.15em] text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.55)]"
        >
          Base win {formatCurrency(payoutFlash.amount)} paid
        </div>
      )}
    </section>
  );
}
