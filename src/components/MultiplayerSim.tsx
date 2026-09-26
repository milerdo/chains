// ============================================================================
// CHAINS — MultiplayerSim
// Simulated per-digit "table heat" — what % of other (simulated) players
// are betting each digit this round. Refreshes on its own short local
// timer (obviously simulated, decoupled from real draw cadence). Purely
// cosmetic: never represents real accounts, never affects or hints at the
// real stream, tickets, or payouts.
// ============================================================================

import { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { DIGIT_COLORS } from '../utils/digitColors';

const REFRESH_MS = 1500;

function randomHeat(): number[] {
  const rawWeights = Array.from({ length: 10 }, () => Math.random() + 0.2);
  const sum = rawWeights.reduce((a, b) => a + b, 0);
  return rawWeights.map((w) => Math.round((w / sum) * 100));
}

export function MultiplayerSim() {
  const { simulatedActivity } = useGame();
  const [heat, setHeat] = useState<number[]>(() => randomHeat());

  useEffect(() => {
    const id = window.setInterval(() => setHeat(randomHeat()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const maxPct = Math.max(...heat, 1);

  return (
    <section
      aria-label="Simulated bet heat map"
      className="flex h-full min-h-0 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Heat Map</span>
        <span className="font-mono text-[10px] tabular-nums text-white/40">
          {simulatedActivity.playerCount.toLocaleString()} active
        </span>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 items-end justify-between gap-1">
        {heat.map((pct, digit) => (
          <div key={digit} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[9px] tabular-nums text-white/40">{pct}%</span>
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-md bg-white/[0.05]">
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{ height: `${(pct / maxPct) * 100}%`, backgroundColor: DIGIT_COLORS[digit] }}
              />
            </div>
            <span className="font-mono text-xs font-bold tabular-nums text-white/70">{digit}</span>
          </div>
        ))}
      </div>
    </section>
  );
}