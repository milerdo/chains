// ============================================================================
// CHAINS — Wheel
// The central live-draw display. Purely a reveal: the actual RNG result is
// already decided by the engine the instant the DRAWING phase begins
// (see engine.ts enterPhase). This component only spins through random
// digits for a cosmetic, decelerating interval before settling on whatever
// currentDraw.digit already is — it never influences the outcome.
//
// When the demo panel's instantStep() fires, skipNextAnimation goes true
// for one render and the reveal snaps straight to the result instead of
// playing the multi-second spin.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playDrawSettle, playTick } from '../utils/audio';
import { formatCountdown, formatDrawIndex } from '../utils/format';
import type { GamePhase } from '../game/types';

const PHASE_LABEL: Record<GamePhase, string> = {
  BETTING_OPEN: 'BETTING OPEN',
  BETTING_CLOSED: 'BETTING CLOSED',
  DRAWING: 'DRAWING',
  RESULT: 'RESULT',
};

const MIN_SPIN_DURATION_MS = 1200;

export function Wheel() {
  const { phase, currentDraw, config, timeRemaining, skipNextAnimation, streamHistory, drawIndex } = useGame();

  const [displayDigit, setDisplayDigit] = useState<number | null>(currentDraw?.digit ?? null);
  const [spinning, setSpinning] = useState(false);
  const [justSettled, setJustSettled] = useState(false);

  const prevPhaseRef = useRef<GamePhase>(phase);
  const rafRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const enteredDrawing = phase === 'DRAWING' && prevPhaseRef.current !== 'DRAWING';
    prevPhaseRef.current = phase;
    if (!enteredDrawing || !currentDraw) return;

    const finalDigit = currentDraw.digit;

    function settle() {
      setDisplayDigit(finalDigit);
      setSpinning(false);
      playDrawSettle();
      setJustSettled(true);
      settleTimeoutRef.current = window.setTimeout(() => setJustSettled(false), 500);
    }

    if (skipNextAnimation) {
      settle();
      return;
    }

    setSpinning(true);
    const duration = Math.max(MIN_SPIN_DURATION_MS, config.drawAnimationDurationMs);
    const start = performance.now();
    let lastSwap = start;

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      if (t >= 1) {
        settle();
        return;
      }
      // Swap interval grows from ~45ms to ~525ms as t -> 1, which reads as
      // a natural deceleration into the final digit.
      const swapInterval = 45 + Math.pow(t, 3) * 480;
      if (now - lastSwap >= swapInterval) {
        setDisplayDigit(Math.floor(Math.random() * 10));
        lastSwap = now;
        playTick();
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentDraw, skipNextAnimation, config.drawAnimationDurationMs]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
    },
    [],
  );

  const recentDigits = streamHistory.slice(-6);
  const showCountdown = phase === 'BETTING_OPEN';

  return (
    <section
      aria-label="Live number stream"
      className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Live Stream</span>
        <span className="font-mono text-[11px] tracking-[0.2em] text-white/40">{formatDrawIndex(drawIndex)}</span>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div
          className={[
            'relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 bg-[#0c0c0c] transition-all duration-300 sm:h-28 sm:w-28',
            spinning
              ? 'border-[#eab308]/40'
              : justSettled
                ? 'border-[#eab308] shadow-[0_0_36px_-4px_rgba(234,179,8,0.65)]'
                : 'border-white/10',
          ].join(' ')}
        >
          {spinning && (
            <span className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl border-2 border-[#eab308]/30" />
          )}
          <span
            className={[
              'font-mono text-5xl font-bold tabular-nums transition-transform duration-200 sm:text-6xl',
              justSettled ? 'scale-110 text-[#eab308]' : 'text-white',
            ].join(' ')}
          >
            {displayDigit ?? '–'}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5">
          {recentDigits.length === 0 && (
            <span className="font-mono text-[11px] text-white/25">awaiting first draw…</span>
          )}
          {recentDigits.map((draw, i) => (
            <span
              key={draw.drawIndex}
              className={[
                'flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs tabular-nums',
                i === recentDigits.length - 1 ? 'bg-[#eab308]/15 text-[#eab308]' : 'bg-white/[0.04] text-white/40',
              ].join(' ')}
            >
              {draw.digit}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <span
          className={[
            'font-mono text-xs font-semibold uppercase tracking-[0.3em]',
            phase === 'BETTING_OPEN' ? 'text-emerald-400' : phase === 'DRAWING' ? 'text-[#eab308]' : 'text-white/50',
          ].join(' ')}
        >
          {PHASE_LABEL[phase]}
        </span>
        {showCountdown && (
          <span className="font-mono text-sm tabular-nums text-white/70">00:{formatCountdown(timeRemaining)}</span>
        )}
      </div>
    </section>
  );
}
