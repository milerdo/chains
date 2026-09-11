// ============================================================================
// CHAINS — MultiplayerSim
// Purely cosmetic "other players at the table" feel (Section 28 of the
// build spec). Every number and event here comes from
// engine.getSimulatedActivity() and is explicitly simulated — it never
// represents real accounts, and never affects the real stream or payouts.
// ============================================================================

import { useGame } from '../hooks/useGame';
import type { TicketTier } from '../game/types';

const TIER_ORDER: TicketTier[] = ['LOW', 'MEDIUM', 'HIGH'];

export function MultiplayerSim() {
  const { simulatedActivity } = useGame();
  const { playerCount, activeTicketsByTier, recentEvents } = simulatedActivity;

  return (
    <section
      aria-label="Simulated live table activity"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Live Players</span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
          Simulated
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tabular-nums text-white">{playerCount.toLocaleString()}</span>
        <span className="font-mono text-xs text-white/40">players at the table</span>
      </div>

      <div className="mt-3 flex gap-2">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">{tier}</div>
            <div className="font-mono text-sm font-bold tabular-nums text-white/80">
              {activeTicketsByTier[tier]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex max-h-32 flex-col gap-1 overflow-y-auto pr-1">
        {recentEvents.length === 0 ? (
          <p className="font-mono text-[11px] text-white/25">Activity will appear once the table gets going…</p>
        ) : (
          recentEvents.slice(0, 12).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 font-mono text-[11px] odd:bg-white/[0.015]"
            >
              <span className="truncate text-white/45">{event.playerLabel}</span>
              <span className="shrink-0 text-white/30">{event.tier}</span>
              <span
                className={[
                  'shrink-0 font-semibold uppercase tracking-[0.1em]',
                  event.outcome === 'WIN' ? 'text-emerald-400/80' : 'text-white/25',
                ].join(' ')}
              >
                {event.outcome}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
