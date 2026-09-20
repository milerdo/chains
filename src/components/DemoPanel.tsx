// ============================================================================
// CHAINS — DemoPanel
// Developer / pitch-demonstration toolbar (Section 27 of the build spec).
// NOT part of the normal player interface — every control here maps
// directly to a demo/debug method the engine exposes explicitly for this
// purpose (forceNextDraw, instantStep, setSpeedMultiplier, simulateJackpotWin,
// createSimulatedTicket, reset, resetBalance). No game math lives here.
// ============================================================================

import { useState, type ReactNode } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency, formatDrawIndex } from '../utils/format';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SPEEDS = [1, 5, 20];

export function DemoPanel() {
  const {
    phase,
    drawIndex,
    balance,
    speedMultiplier,
    isPaused,
    isRunning,
    activeTickets,
    forcedQueue,
    forceNextDraw,
    clearForcedDraws,
    instantStep,
    setSpeed,
    pauseGame,
    resumeGame,
    resetGame,
    resetBalance,
  } = useGame();

  const [open, setOpen] = useState(false);

  function withClick<T extends unknown[]>(fn: (...args: T) => void) {
    return (...args: T) => {
      playUiClick();
      fn(...args);
    };
  }

  const handleInstantStep = withClick(instantStep);
  const handleTogglePause = withClick(() => (isPaused ? resumeGame() : pauseGame()));
  const handleResetGame = withClick(() => {
    if (window.confirm('Reset the entire game? Balance, tickets, stream, and jackpots will all return to their starting values.')) {
      resetGame();
    }
  });
  const handleResetBalance = withClick(resetBalance);
  const handleClearForced = withClick(clearForcedDraws);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setOpen((o) => !o);
          }}
          className="mx-auto flex items-center gap-2 rounded-t-xl border border-b-0 border-white/10 bg-[#181818] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 transition hover:text-[#eab308]"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-[#eab308]' : 'bg-white/30'}`} />
          Demo Panel
          <span className="text-white/30">{open ? '▾' : '▴'}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#141414]/98 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-white/45">
              <ReadoutChip label="Phase" value={phase.replace('_', ' ')} />
              <ReadoutChip label="Draw" value={formatDrawIndex(drawIndex)} />
              <ReadoutChip label="Balance" value={formatCurrency(balance)} />
              <ReadoutChip label="Active links" value={String(activeTickets.length)} />
              <ReadoutChip label="Speed" value={`x${speedMultiplier}`} />
              <ReadoutChip label="Engine" value={isRunning ? (isPaused ? 'paused' : 'running') : 'stopped'} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Force Next Draw">
                <div className="grid grid-cols-5 gap-1.5">
                  {DIGITS.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={withClick(() => forceNextDraw(digit))}
                      className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] font-mono text-sm font-bold text-white/80 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-white/35">
                    Queued: {forcedQueue.length > 0 ? forcedQueue.join(' → ') : 'none'}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearForced}
                    disabled={forcedQueue.length === 0}
                    className="font-mono text-[10px] text-white/35 underline decoration-dotted disabled:opacity-30"
                  >
                    clear
                  </button>
                </div>
              </Panel>

              <Panel title="Flow Control">
                <button
                  type="button"
                  onClick={handleInstantStep}
                  className="w-full rounded-lg bg-[#eab308] py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition hover:bg-[#facc15]"
                >
                  Instant Step / Force Draw
                </button>

                <div className="mt-2.5 flex gap-1.5">
                  {SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={withClick(() => setSpeed(speed))}
                      className={[
                        'flex-1 rounded-lg border py-2 font-mono text-xs font-semibold transition',
                        speedMultiplier === speed
                          ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308]'
                          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25',
                      ].join(' ')}
                    >
                      x{speed}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-white/70 transition hover:border-white/25"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </Panel>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3.5">
              <button
                type="button"
                onClick={handleResetBalance}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-white/60 transition hover:border-white/25"
              >
                Reset Balance
              </button>
              <button
                type="button"
                onClick={handleResetGame}
                className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5 font-mono text-[11px] text-red-300 transition hover:bg-red-400/[0.12]"
              >
                Reset Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-3.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">{title}</span>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function ReadoutChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
      <span className="text-white/30">{label}:</span> <span className="font-semibold text-white/70">{value}</span>
    </span>
  );
}
