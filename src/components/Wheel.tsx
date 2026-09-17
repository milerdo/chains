// ============================================================================
// CHAINS — Wheel (rotary dial, per build spec Section 22)
//
// A rotary-telephone-dial-inspired reveal, not a spinning prize wheel:
//   - 10 recessed "finger holes" arranged around a static bezel, one per
//     digit 0-9.
//   - A single FIXED indicator at 12 o'clock — the only position that ever
//     determines the result. It never moves.
//   - The DIAL rotates under the indicator (never a needle sweeping around
//     a static face).
//   - Only the hole currently under the indicator is ever emphasized (and
//     even then, only with a brighter label — not a glow). Glow is
//     reserved exclusively for the single moment of landing.
//
// Engine separation: the actual RNG result is already decided by the
// engine the instant DRAWING begins — this component only reveals it, and
// (per useGame.ts's reveal-delay, see item 1b) it genuinely does not know
// the target digit until the hook says so. That means the dial can't
// animate toward a known target from the start: it spins indefinitely in
// ascending order not knowing the answer (Effect 1), then does a short
// forward-only "final approach" the instant the true digit is revealed
// (Effect 2), landing exactly aligned under the indicator.
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

// --- Dial geometry -----------------------------------------------------
const HOLE_COUNT = 10;
const HOLE_STEP_DEG = 360 / HOLE_COUNT; // 36deg between adjacent holes
const DIAL_SIZE_PX = 208;
const DIAL_RADIUS_PX = 80; // distance from center to each hole's center
const HOLE_SIZE_PX = 32;

// --- Animation timing ----------------------------------------------------
// Indeterminate phase (Effect 1): constant angular speed while the true
// digit is still secret. Final approach (Effect 2): a short, always-forward
// deceleration once the real digit is known.
const SPIN_SPEED_DEG_PER_SEC = 300;
const FINAL_APPROACH_MS = 600;
// If the true digit arrives within this long of the spin starting, treat it
// as a Demo Panel instant-step (no meaningful spin happened yet) and skip
// straight to landing with no animation, matching "Instant Step" semantics.
const INSTANT_THRESHOLD_MS = 60;

/** Which digit's hole currently sits under the fixed indicator, given the
 * disc's cumulative forward rotation. Holes are placed at digit*36deg
 * (clockwise from 12 o'clock) and the disc rotates by -spinAngle, so
 * increasing spinAngle brings digits to the indicator in ascending order
 * (0,1,2,...9,0,1,...) — verified against this exact formula before
 * writing the component. */
function digitAtSpinAngle(spinAngle: number): number {
  const normalized = ((spinAngle % 360) + 360) % 360;
  return Math.floor(normalized / HOLE_STEP_DEG) % 10;
}

export function Wheel() {
  const { phase, currentDraw, speedMultiplier, timeRemaining, streamHistory, drawIndex } = useGame();

  // spinAngle is a cumulative, ALWAYS-INCREASING value — the dial only
  // ever advances forward through ascending digits, across its whole
  // lifetime, never resetting or reversing (matching a real dial's
  // continuous mechanical motion).
  const spinAngleRef = useRef(0);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [currentDigit, setCurrentDigit] = useState(currentDraw?.digit ?? 0);
  const [spinning, setSpinning] = useState(false);
  const [justLanded, setJustLanded] = useState(false);

  const prevPhaseRef = useRef<GamePhase>(phase);
  const prevRevealedDrawIndexRef = useRef<number | undefined>(currentDraw?.drawIndex);
  const spinStartTimeRef = useRef(0);
  const indeterminateRafRef = useRef<number | null>(null);
  const finalApproachRafRef = useRef<number | null>(null);
  // Read via ref (not the effect's dependency array) so a mid-spin speed
  // change from the Demo Panel is picked up on the very next animation
  // frame without restarting (and thereby killing) the in-progress spin.
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  // Effect 1 — the instant we (really) enter DRAWING, start an
  // indeterminate ascending spin. Entering DRAWING is not itself a
  // spoiler (only the digit value is), so this reacts to the raw phase
  // and begins immediately, in sync with the real phase clock — it just
  // doesn't know where it's going yet.
  useEffect(() => {
    const enteredDrawing = phase === 'DRAWING' && prevPhaseRef.current !== 'DRAWING';
    prevPhaseRef.current = phase;
    if (!enteredDrawing) return;

    setSpinning(true);
    setJustLanded(false);
    spinStartTimeRef.current = performance.now();
    let lastFrameTime = spinStartTimeRef.current;
    let lastDigit = digitAtSpinAngle(spinAngleRef.current);

    function step(now: number) {
      const deltaSec = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      spinAngleRef.current += SPIN_SPEED_DEG_PER_SEC * speedMultiplierRef.current * deltaSec;
      setDisplayRotation(spinAngleRef.current);

      const nextDigit = digitAtSpinAngle(spinAngleRef.current);
      if (nextDigit !== lastDigit) {
        lastDigit = nextDigit;
        setCurrentDigit(nextDigit);
        playTick();
      }
      indeterminateRafRef.current = requestAnimationFrame(step);
    }
    indeterminateRafRef.current = requestAnimationFrame(step);

    return () => {
      if (indeterminateRafRef.current !== null) cancelAnimationFrame(indeterminateRafRef.current);
    };
  }, [phase]);

  // Effect 2 — the moment the hook's delayed `currentDraw` actually
  // updates (immediately for an instant step, or after the full reveal
  // delay otherwise), stop the indeterminate spin and do a short,
  // always-forward "final approach" to the true digit, landing it exactly
  // under the indicator. This is the ONLY place the real digit is shown.
  useEffect(() => {
    if (!currentDraw || currentDraw.drawIndex === prevRevealedDrawIndexRef.current) return;
    prevRevealedDrawIndexRef.current = currentDraw.drawIndex;

    if (indeterminateRafRef.current !== null) {
      cancelAnimationFrame(indeterminateRafRef.current);
      indeterminateRafRef.current = null;
    }
    if (finalApproachRafRef.current !== null) {
      cancelAnimationFrame(finalApproachRafRef.current);
      finalApproachRafRef.current = null;
    }

    const targetDigit = currentDraw.digit;
    const wasInstant = performance.now() - spinStartTimeRef.current < INSTANT_THRESHOLD_MS;
    const currentAtStart = digitAtSpinAngle(spinAngleRef.current);
    const rawTicks = (targetDigit - currentAtStart + 10) % 10;
    // Always travel forward by at least one step so there's a visible
    // landing motion, except when instant-stepping (genuinely no
    // animation should play there).
    const ticks = wasInstant ? rawTicks : rawTicks === 0 ? HOLE_COUNT : rawTicks;
    const targetAngle = spinAngleRef.current + ticks * HOLE_STEP_DEG;

    function land() {
      spinAngleRef.current = targetAngle;
      setDisplayRotation(targetAngle);
      setCurrentDigit(targetDigit);
      setSpinning(false);
      setJustLanded(true);
      playDrawSettle();
      window.setTimeout(() => setJustLanded(false), 650);
    }

    if (wasInstant) {
      land();
      return;
    }

    const startAngle = spinAngleRef.current;
    const startTime = performance.now();
    const approachDurationMs = FINAL_APPROACH_MS / speedMultiplierRef.current;
    let lastDigit = digitAtSpinAngle(startAngle);

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / approachDurationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out: decelerates into the landing
      const angle = startAngle + (targetAngle - startAngle) * eased;
      spinAngleRef.current = angle;
      setDisplayRotation(angle);

      const nextDigit = digitAtSpinAngle(angle);
      if (nextDigit !== lastDigit && t < 1) {
        lastDigit = nextDigit;
        setCurrentDigit(nextDigit);
        playTick();
      }

      if (t < 1) {
        finalApproachRafRef.current = requestAnimationFrame(step);
      } else {
        land();
      }
    }
    finalApproachRafRef.current = requestAnimationFrame(step);

    return () => {
      if (finalApproachRafRef.current !== null) cancelAnimationFrame(finalApproachRafRef.current);
    };
  }, [currentDraw]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (indeterminateRafRef.current !== null) cancelAnimationFrame(indeterminateRafRef.current);
      if (finalApproachRafRef.current !== null) cancelAnimationFrame(finalApproachRafRef.current);
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
        <div className="relative" style={{ width: DIAL_SIZE_PX, height: DIAL_SIZE_PX }}>
          {/* Static bezel — flat dark, no gradient (Section 22/31: high
              contrast, minimal, glow reserved for the landing only). */}
          <div
            className={[
              'absolute inset-0 rounded-full border-2 bg-[#141414] transition-colors duration-300',
              spinning ? 'border-white/15' : 'border-white/10',
            ].join(' ')}
          />

          {/* The 10 finger holes. Each is positioned with the standard
              rotate/translate/counter-rotate technique so it orbits the
              center while its own label stays upright — no separately
              rotating wrapper needed. */}
          {Array.from({ length: HOLE_COUNT }, (_, digit) => {
            const angle = digit * HOLE_STEP_DEG - displayRotation;
            const isLit = digit === currentDigit;
            const isLanded = isLit && justLanded;
            return (
              <div
                key={digit}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: HOLE_SIZE_PX,
                  height: HOLE_SIZE_PX,
                  marginLeft: -HOLE_SIZE_PX / 2,
                  marginTop: -HOLE_SIZE_PX / 2,
                  transform: `rotate(${angle}deg) translateY(-${DIAL_RADIUS_PX}px) rotate(${-angle}deg)`,
                }}
              >
                <div
                  className={[
                    'flex h-full w-full items-center justify-center rounded-full',
                    'shadow-[inset_0_2px_5px_rgba(0,0,0,0.65),inset_0_-1px_1px_rgba(255,255,255,0.04)]',
                    isLanded ? 'bg-[#1c1608]' : 'bg-[#101010]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'font-mono font-bold tabular-nums transition-all duration-150',
                      isLanded
                        ? 'scale-125 text-2xl text-[#eab308]'
                        : isLit
                          ? 'text-base text-white/85'
                          : 'text-sm text-white/25',
                    ].join(' ')}
                    style={isLanded ? { textShadow: '0 0 18px rgba(234,179,8,0.7)' } : undefined}
                  >
                    {digit}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Fixed indicator — a distinct mechanical tab/bracket at 12
              o'clock. Never rotates; this is the only position that
              determines the result. Neutral metal tone, not gold — gold
              is reserved for the winning digit itself. */}
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="h-3 w-6 rounded-sm border border-white/25 bg-[#2a2a2a] shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
            <div className="mx-auto -mt-px h-2 w-2 rotate-45 border-b border-r border-white/25 bg-[#2a2a2a]" />
          </div>
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
