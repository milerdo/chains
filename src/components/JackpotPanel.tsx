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
import { formatCompactCurrency } from '../utils/format';
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
    label: '3 IN A ROW',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9)]',
    ring: 'border-[#eab308]/25',
  },
  MIDI: {
    label: '4 IN A ROW',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9]',
    ring: 'border-[#eab308]/25',
  },
  GRAND: {
    label: '5 IN A ROW',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_0_0_rgba(255,255,255,0.9]',
    ring: 'border-[#eab308]/25',
  },
};

function JackpotTile({ tierName, amount }: { tierName: JackpotTierName; amount: number }) {
  const animated = useAnimatedValue(amount);
  const meta = TIER_META[tierName];

  return (
    <div
      className={[
        'relative flex-1 overflow-hidden rounded-lg border bg-gradient-to-b from-white/[0.03] to-transparent px-2 py-1.5 backdrop-blur-sm transition-shadow duration-700',
        meta.ring,
        meta.glow,
      ].join(' ')}
    >
      {tierName === 'GRAND' && (
        <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.07] to-transparent" />
      )}
      <div className="relative flex flex-col items-center text-center">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${meta.accent}`}>
          {meta.label}
        </span>
        {/* Same font size/weight for MINI, MIDI, and GRAND — only the
            accent color and glow intensity differ between tiers. */}
        <span className="mt-0.2 font-mono text-sm-1.5 font-bold tabular-nums text-white">
          {formatCompactCurrency(animated)}
        </span>
      </div>
    </div>
  );
}

export function JackpotPanel() {
  const { jackpotPools } = useGame();

  return (
    <section aria-label="Progressive jackpots" className="flex w-full gap-1.5">     
      <JackpotTile tierName="MINI" amount={jackpotPools.MINI} />
      <JackpotTile tierName="MIDI" amount={jackpotPools.MIDI} />
      <JackpotTile tierName="GRAND" amount={jackpotPools.GRAND} />
    </section>
  );
}
