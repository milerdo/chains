// ============================================================================
// CHAINS — Wheel (classic mechanical prize wheel, Section 22 / CLAUDE.md §8)
// Rendered entirely in SVG so the disc, pegs, and digits share one
// coordinate space and one rotation — no parent/child CSS transform
// composition to get subtly out of sync (see conversation history: that
// was the root cause of the previous alignment bugs).
//
// Rotation convention (derive once, use everywhere):
//   - Rotating group transform = rotate(-spinAngle, 150, 150)
//   - Digit i's UNROTATED center sits at angle i*36° clockwise-from-top
//   - After rotation, digit under the fixed top pointer satisfies
//     i*36 - spinAngle ≡ 0 (mod 360)  =>  i = floor(norm(spinAngle)/36)
//   - digitAtSpinAngle() below implements exactly that, unnegated, and
//     spinAngleRef.current is used directly (no sign flip at call sites)
//     for both the live display digit AND the landing-target math, so the
//     two can never disagree.
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

// --- Geometry (SVG viewBox 0 0 300 300, center 150,150) -----------------
const HOLE_COUNT = 10;
const HOLE_STEP_DEG = 360 / HOLE_COUNT;
const CX = 150;
const CY = 150;
const RIM_OUTER_R = 144;
const RIM_INNER_R = 126; // wedges drawn out to here
const PEG_R = 120; // just inside the rim, at wedge BOUNDARIES (not digit centers)
const DIGIT_R = 92;
const HUB_R = 20;
const RIVET_R = 136;
const RIVET_COUNT = 26;

// Digit -> wedge color, matching the reference wheel's G/R/B sector pattern.
const WEDGE_COLORS = ['#1e6b3e', '#8a1f1f', '#1f3f82', '#8a1f1f', '#1e6b3e', '#1f3f82', '#8a1f1f', '#1e6b3e', '#1f3f82', '#8a1f1f'];

// --- Animation timing ----------------------------------------------------
const MAX_SPIN_SPEED_DEG_PER_SEC = 280; // ~0.78 rev/sec cruise — brisk but mechanical, not frantic
const SPIN_ACCEL_TIME_CONSTANT_SEC = 0.35;
const LANDING_TARGET_MS = 2800; // desired natural landing feel at 1x speed
const MIN_APPROACH_MS = 900;
const INSTANT_THRESHOLD_MS = 60;
const FLAPPER_CLICK_MS = 150;

function pt(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function digitAtSpinAngle(spinAngle: number): number {
  const normalized = ((spinAngle % 360) + 360) % 360;
  return Math.floor(normalized / HOLE_STEP_DEG) % 10;
}

// Linear deceleration to exactly zero: eased'(0) = 2 * (distance/duration),
// which is what lets the landing phase start at the wheel's true current
// speed (see effect 2) instead of jumping.
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function Wheel() {
  const { phase, currentDraw, speedMultiplier, timeRemaining, streamHistory, drawIndex } = useGame();

  const spinAngleRef = useRef(0);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [currentDigit, setCurrentDigit] = useState(currentDraw?.digit ?? 0);
  const [justLanded, setJustLanded] = useState(false);
  const [flapperTick, setFlapperTick] = useState(0);

  const prevPhaseRef = useRef<GamePhase>(phase);
  const prevRevealedDrawIndexRef = useRef<number | undefined>(currentDraw?.drawIndex);
  const spinStartTimeRef = useRef(0);
  const accelStartTimeRef = useRef(0);
  // Tracks the wheel's actual last-measured angular speed, so the landing
  // phase can start from the REAL current velocity rather than a
  // theoretical max — this is what guarantees no speed jump at handoff,
  // correct even under the demo panel's speed multiplier.
  const lastAngularSpeedRef = useRef(MAX_SPIN_SPEED_DEG_PER_SEC);
  const indeterminateRafRef = useRef<number | null>(null);
  const finalApproachRafRef = useRef<number | null>(null);
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  function fireFlapperClick() {
    setFlapperTick((t) => t + 1);
    playTick();
  }

  // Effect 1 — enter DRAWING: ease in to cruise speed, then hold. Does not
  // know the target digit yet.
  useEffect(() => {
    const enteredDrawing = phase === 'DRAWING' && prevPhaseRef.current !== 'DRAWING';
    prevPhaseRef.current = phase;
    if (!enteredDrawing) return;

    setJustLanded(false);
    spinStartTimeRef.current = performance.now();
    accelStartTimeRef.current = spinStartTimeRef.current;
    let lastFrameTime = spinStartTimeRef.current;
    let lastDigit = digitAtSpinAngle(spinAngleRef.current);

    function step(now: number) {
      const deltaSec = (now - lastFrameTime) / 1000;
      const accelElapsedSec = (now - accelStartTimeRef.current) / 1000;
      lastFrameTime = now;

      const speedFraction = 1 - Math.exp(-accelElapsedSec / SPIN_ACCEL_TIME_CONSTANT_SEC);
      const angularSpeed = MAX_SPIN_SPEED_DEG_PER_SEC * speedFraction * speedMultiplierRef.current;
      lastAngularSpeedRef.current = angularSpeed;
      spinAngleRef.current += angularSpeed * deltaSec;
      setDisplayRotation(spinAngleRef.current);

      const nextDigit = digitAtSpinAngle(spinAngleRef.current);
      if (nextDigit !== lastDigit) {
        lastDigit = nextDigit;
        setCurrentDigit(nextDigit);
        fireFlapperClick();
      }
      indeterminateRafRef.current = requestAnimationFrame(step);
    }
    indeterminateRafRef.current = requestAnimationFrame(step);

    return () => {
      if (indeterminateRafRef.current !== null) cancelAnimationFrame(indeterminateRafRef.current);
    };
  }, [phase]);

  // Effect 2 — the true digit is revealed. Decelerate uniformly from the
  // wheel's actual current speed to zero, landing exactly on it. This is
  // the ONLY place the real digit is ever shown.
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
    const baseTicks = rawTicks === 0 ? HOLE_COUNT : rawTicks;

    function land(finalAngle: number) {
      spinAngleRef.current = finalAngle;
      setDisplayRotation(finalAngle);
      setCurrentDigit(targetDigit);
      setJustLanded(true);
      fireFlapperClick();
      playDrawSettle();
      window.setTimeout(() => setJustLanded(false), 650);
    }

    if (wasInstant) {
      land(spinAngleRef.current + baseTicks * HOLE_STEP_DEG);
      return;
    }

    // Pick a number of extra full revolutions so the total distance, at
    // the wheel's REAL current speed, takes close to LANDING_TARGET_MS —
    // then recompute the exact duration from that distance so velocity
    // continuity (see easeOutQuad) is exact, not approximate.
    const v0 = Math.max(60, lastAngularSpeedRef.current);
    const targetMs = LANDING_TARGET_MS / speedMultiplierRef.current;
    const idealDistanceDeg = (v0 * (targetMs / 1000)) / 2;
    const idealTicks = idealDistanceDeg / HOLE_STEP_DEG;
    const extraRevolutions = Math.max(1, Math.round((idealTicks - baseTicks) / HOLE_COUNT));
    const ticks = baseTicks + extraRevolutions * HOLE_COUNT;
    const distanceDeg = ticks * HOLE_STEP_DEG;
    const approachDurationMs = Math.max(MIN_APPROACH_MS, (2 * distanceDeg) / v0 * 1000);
    const targetAngle = spinAngleRef.current + distanceDeg;

    const startAngle = spinAngleRef.current;
    const startTime = performance.now();
    let lastDigit = digitAtSpinAngle(startAngle);

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / approachDurationMs);
      const eased = easeOutQuad(t);
      const angle = startAngle + distanceDeg * eased;
      spinAngleRef.current = angle;
      setDisplayRotation(angle);

      const nextDigit = digitAtSpinAngle(angle);
      if (nextDigit !== lastDigit && t < 1) {
        lastDigit = nextDigit;
        setCurrentDigit(nextDigit);
        fireFlapperClick();
      }

      if (t < 1) {
        finalApproachRafRef.current = requestAnimationFrame(step);
      } else {
        land(targetAngle);
      }
    }
    finalApproachRafRef.current = requestAnimationFrame(step);

    return () => {
      if (finalApproachRafRef.current !== null) cancelAnimationFrame(finalApproachRafRef.current);
    };
  }, [currentDraw]);

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
        <svg
          width={260}
          height={260}
          viewBox="0 0 300 300"
          style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.55))' }}
        >
          <defs>
            <radialGradient id="frameGrad" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#eecf8a" />
              <stop offset="55%" stopColor="#8a6512" />
              <stop offset="100%" stopColor="#4a3506" />
            </radialGradient>
            <radialGradient id="hubGrad" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#f6e3a8" />
              <stop offset="60%" stopColor="#8a6512" />
              <stop offset="100%" stopColor="#3d2c05" />
            </radialGradient>
            <radialGradient id="sheenGrad" cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Fixed outer frame — never rotates */}
          <circle cx={CX} cy={CY} r={RIM_OUTER_R} fill="url(#frameGrad)" />
          <circle cx={CX} cy={CY} r={RIM_OUTER_R} fill="none" stroke="#2a1c02" strokeWidth={2} />

          {/* Fixed rivets */}
          {Array.from({ length: RIVET_COUNT }, (_, i) => {
            const p = pt((360 / RIVET_COUNT) * i, RIVET_R);
            return <circle key={`rivet-${i}`} cx={p.x} cy={p.y} r={2.4} fill="#f6e3a8" stroke="#5c4409" strokeWidth={0.5} />;
          })}

          {/* Rotating disc — wedges, pegs, and digits share ONE transform,
              so they can never drift out of sync with each other. */}
          <g transform={`rotate(${-displayRotation} ${CX} ${CY})`}>
            {WEDGE_COLORS.map((color, i) => {
              const start = i * HOLE_STEP_DEG - HOLE_STEP_DEG / 2;
              const end = i * HOLE_STEP_DEG + HOLE_STEP_DEG / 2;
              const p1 = pt(start, RIM_INNER_R);
              const p2 = pt(end, RIM_INNER_R);
              const isLanded = justLanded && i === currentDigit;
              return (
                <path
                  key={`wedge-${i}`}
                  d={`M${CX},${CY} L${p1.x},${p1.y} A${RIM_INNER_R},${RIM_INNER_R} 0 0,1 ${p2.x},${p2.y} Z`}
                  fill={isLanded ? '#eab308' : color}
                  stroke="#d4af5a"
                  strokeWidth={1.5}
                  style={{ transition: 'fill 150ms ease-out' }}
                />
              );
            })}

            {/* Subtle sheen overlay for depth, no isolated "shine spot" */}
            <circle cx={CX} cy={CY} r={RIM_INNER_R} fill="url(#sheenGrad)" />

            {/* Pegs at wedge BOUNDARIES, not on digits */}
            {Array.from({ length: HOLE_COUNT }, (_, i) => {
              const angle = i * HOLE_STEP_DEG - HOLE_STEP_DEG / 2;
              const p = pt(angle, PEG_R);
              return (
                <circle key={`peg-${i}`} cx={p.x} cy={p.y} r={4} fill="#d9c088" stroke="#5c4409" strokeWidth={0.6} />
              );
            })}

            {/* Digits — large, bold, radially tilted like the reference */}
            {Array.from({ length: HOLE_COUNT }, (_, i) => {
              const angle = i * HOLE_STEP_DEG;
              const p = pt(angle, DIGIT_R);
              return (
                <text
                  key={`digit-${i}`}
                  x={p.x}
                  y={p.y}
                  transform={`rotate(${angle} ${p.x} ${p.y})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="ui-monospace, 'SFMono-Regular', monospace"
                  fontWeight={800}
                  fontSize={36}
                  fill="#f4e4b8"
                  stroke="#2a1a00"
                  strokeWidth={1.5}
                  paintOrder="stroke"
                >
                  {i}
                </text>
              );
            })}

            {/* Hub */}
            <circle cx={CX} cy={CY} r={HUB_R} fill="url(#hubGrad)" stroke="#2a1c02" strokeWidth={1.5} />
          </g>

          {/* Fixed pivot + flapper — always at top, never orbits. Tip
              touches the rim at angle 0 by construction (SVG coordinates,
              not CSS flex layout), so it can't drift off-center. */}
          <circle cx={CX} cy={22} r={5} fill="url(#frameGrad)" stroke="#2a1c02" strokeWidth={1} />
          <g
            key={flapperTick}
            style={{
              transformOrigin: `${CX}px 22px`,
              animation: `flapper-click ${FLAPPER_CLICK_MS}ms ease-out`,
            }}
          >
            <polygon
              points={`${CX - 10},4 ${CX + 10},4 ${CX},${RIM_OUTER_R - RIM_INNER_R + 26}`}
              fill="#c9971f"
              stroke="#5c4409"
              strokeWidth={1}
            />
          </g>

          <style>{`
            @keyframes flapper-click {
              0% { transform: rotate(0deg); }
              35% { transform: rotate(-18deg); }
              100% { transform: rotate(0deg); }
            }
          `}</style>
        </svg>

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