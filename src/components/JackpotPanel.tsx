// ============================================================================
// CHAINS — JackpotPanel
// High-contrast banner for the three progressive pools. Each pool eases
// toward its new value with a short numeric tween whenever it changes
// (funding contributions or a payout reset), rather than snapping instantly.
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
    label: 'MINI',
    accent: 'text-[#fde68a]',
    glow: 'shadow-[0_0_22px_-8px_rgba(234,179,8,0.35)]',
    ring: 'border-[#eab308]/20',
  },
  MIDI: {
    label: 'MIDI',
    accent: 'text-[#fbbf24]',
    glow: 'shadow-[0_0_26px_-6px_rgba(251,191,36,0.4)]',
    ring: 'border-[#eab308]/30',
  },
  GRAND: {
    label: 'GRAND',
    accent: 'text-[#eab308]',
    glow: 'shadow-[0_0_38px_-4px_rgba(234,179,8,0.6)]',
    ring: 'border-[#eab308]/50',
  },
};

function JackpotTile({ tierName, amount }: { tierName: JackpotTierName; amount: number }) {
  const animated = useAnimatedValue(amount);
  const meta = TIER_META[tierName];
  const isGrand = tierName === 'GRAND';

  return (
    <div
      className={[
        'relative flex-1 overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.045] to-transparent px-3 py-3 backdrop-blur-sm transition-shadow duration-700 sm:px-4',
        meta.ring,
        meta.glow,
        isGrand ? 'sm:py-4' : '',
      ].join(' ')}
    >
      {isGrand && (
        <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.07] to-transparent" />
      )}
      <div className="relative flex flex-col items-center text-center">
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.4em] ${meta.accent}`}>
          {meta.label}
        </span>
        <span
          className={[
            'mt-1 font-mono font-bold tabular-nums text-white',
            isGrand ? 'text-2xl sm:text-3xl' : 'text-base sm:text-xl',
          ].join(' ')}
        >
          {formatCompactCurrency(animated)}
        </span>
      </div>
    </div>
  );
}

export function JackpotPanel() {
  const { jackpotPools } = useGame();

  return (
    <section aria-label="Progressive jackpots" className="mx-auto flex w-full max-w-6xl gap-2 px-4 sm:gap-3 sm:px-6">
      <JackpotTile tierName="MINI" amount={jackpotPools.MINI} />
      <JackpotTile tierName="MIDI" amount={jackpotPools.MIDI} />
      <JackpotTile tierName="GRAND" amount={jackpotPools.GRAND} />
    </section>
  );
}
