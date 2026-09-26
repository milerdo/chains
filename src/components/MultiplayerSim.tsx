// ============================================================================
// CHAINS — MultiplayerSim
// Simulated per-digit "table heat" — what % of other (simulated) players
// are betting each digit this round. Sourced entirely from
// engine.getSimulatedActivity().digitPopularity (Section 28 spirit).
// Purely cosmetic: never represents real accounts, never affects the real
// stream, tickets, or payouts, and never predicts or hints at the actual
// upcoming draw.
// ============================================================================

import { useGame } from '../hooks/useGame';
import { DIGIT_COLORS } from '../utils/digitColors';

export function MultiplayerSim() {
  const { simulatedActivity } = useGame();
  const { digitPopularity, playerCount } = simulatedActivity;
  const maxPct = Math.max(...digitPopularity, 1);

  return (
    <section
      aria-label="Simulated bet popularity"
      className="flex h-full min-h-0 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Table Heat</span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
          Simulated
        </span>
      </div>
      <p className="mt-1 shrink-0 font-mono text-[10px] text-white/30">
        {playerCount.toLocaleString()} players this round
      </p>

      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
        {digitPopularity.map((pct, digit) => (
          <div key={digit} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center font-mono text-xs font-bold tabular-nums text-white/70">
              {digit}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(pct / maxPct) * 100}%`, backgroundColor: DIGIT_COLORS[digit] }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/40">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}