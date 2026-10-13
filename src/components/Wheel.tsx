// ============================================================================
// CHAINS — Wheel (classic mechanical prize wheel, Section 22 / CLAUDE.md §8)
// Rendered entirely in SVG so the disc, pegs, and digits share one
// coordinate space and one rotation 
// ============================================================================

import { memo, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useGame } from '../hooks/useGame';
import { playTick } from '../utils/audio';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { nextExpectedDigit } from '../game/ticket';

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
const PEG_VISUAL_R = 6.5; // raised-bump size — large enough to read as physical
// Bet-marker chips sit in the empty band between hub and digits: [radius, angle offset°] inside the wedge.
const CHIP_SLOTS: ReadonlyArray<readonly [number, number]> = [[56, 0], [42, -7], [42, 7], [70, -8], [70, 8], [30, 0]];
const CHIP_R = 4.6;

import { DIGIT_COLORS as WEDGE_COLORS } from '../utils/digitColors';

// --- Animation timing ----------------------------------------------------
const MAX_SPIN_SPEED_DEG_PER_SEC = 520; // ~1.45 rev/s
const SPIN_ACCEL_TIME_CONSTANT_SEC = 0.25;
const DECEL_MS = 3500;     // deceleration duration at x1
const DECEL_POWER = 3;     // 3 = firm tease, 4 = very long crawl
const SPIN_LEAD_MS = 2000; // spin-up starts this long before betting closes (desktop)
const INSTANT_THRESHOLD_MS = 60;
const FLAPPER_CLICK_MS = 150;

function pt(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

const mod360 = (a: number) => ((a % 360) + 360) % 360;

// Boundary math matches the wedge geometry exactly: wedge i spans
// [i*36-18, i*36+18), so the digit flip must happen at the half-step
// offset, not at raw multiples of 36 (that mismatch was the "digit
// changes before the visual border" bug).
function digitAtSpinAngle(spinAngle: number): number {
  const normalized = ((spinAngle % 360) + 360) % 360;
  return Math.floor((normalized + HOLE_STEP_DEG / 2) / HOLE_STEP_DEG) % 10;
}

// f'(0) = DECEL_POWER, so the decel phase covers v0 * T / DECEL_POWER degrees.
function easeOutPow(t: number): number {
  return 1 - Math.pow(1 - t, DECEL_POWER);
}

const WheelFrame = memo(function WheelFrame({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`frameGrad-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#eecf8a" />
          <stop offset="55%" stopColor="#8a6512" />
          <stop offset="100%" stopColor="#4a3506" />
        </radialGradient>
        <radialGradient id={`hubGrad-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f6e3a8" />
          <stop offset="60%" stopColor="#8a6512" />
          <stop offset="100%" stopColor="#3d2c05" />
        </radialGradient>
        <radialGradient id={`sheenGrad-${uid}`} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`pegGrad-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff3cf" />
          <stop offset="55%" stopColor="#d9c088" />
          <stop offset="100%" stopColor="#6b4f10" />
        </radialGradient>
        <radialGradient id={`flapperGrad-${uid}`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#c7ccd3" />
          <stop offset="55%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#1f2328" />
        </radialGradient>
        <radialGradient id={`specularGrad-${uid}`} cx="42%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={RIM_OUTER_R} fill={`url(#frameGrad-${uid})`} stroke="#2a1c02" strokeWidth={2} />
      {Array.from({ length: RIVET_COUNT }, (_, i) => {
        const p = pt((360 / RIVET_COUNT) * i, RIVET_R);
        return <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#f6e3a8" stroke="#5c4409" strokeWidth={0.5} />;
      })}
    </>
  );
});

function Chip({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#0b0b0b" stroke="#e5e7eb" strokeWidth={0.9} />
      <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke="#eab308" strokeWidth={0.6} strokeDasharray="1.2 1" />
    </>
  );
}

const WheelDisc = memo(function WheelDisc({
  uid, discRef, landedDigit, markerCounts,
}: {
  uid: string;
  discRef: RefObject<SVGGElement | null>;
  landedDigit: number | null;
  markerCounts: readonly number[];
}) {
  return (
    <>
      {/* transform is driven imperatively via discRef; this initial value never changes, so React never overwrites it */}
      <g ref={discRef} transform={`rotate(0 ${CX} ${CY})`}>
        {WEDGE_COLORS.map((color, i) => {
          const p1 = pt(i * HOLE_STEP_DEG - HOLE_STEP_DEG / 2, RIM_INNER_R);
          const p2 = pt(i * HOLE_STEP_DEG + HOLE_STEP_DEG / 2, RIM_INNER_R);
          return (
            <path
              key={`wedge-${i}`}
              d={`M${CX},${CY} L${p1.x},${p1.y} A${RIM_INNER_R},${RIM_INNER_R} 0 0,1 ${p2.x},${p2.y} Z`}
              fill={landedDigit === i ? '#eab308' : color}
              stroke="#2a1c02"
              strokeWidth={3.5}
              style={{ transition: 'fill 150ms ease-out' }}
            />
          );
        })}
        <circle cx={CX} cy={CY} r={RIM_INNER_R} fill={`url(#sheenGrad-${uid})`} />
        {Array.from({ length: HOLE_COUNT }, (_, i) => {
          const p = pt(i * HOLE_STEP_DEG - HOLE_STEP_DEG / 2, PEG_R);
          return (
            <g key={`peg-${i}`}>
              <circle cx={p.x} cy={p.y + 1} r={PEG_VISUAL_R} fill="#1a1200" opacity={0.4} />
              <circle cx={p.x} cy={p.y} r={PEG_VISUAL_R} fill={`url(#pegGrad-${uid})`} stroke="#2a1c02" strokeWidth={1.3} />
            </g>
          );
        })}
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
                {markerCounts.map((count, digit) => {
          if (count === 0) return null;
          const base = digit * HOLE_STEP_DEG;
          if (count > CHIP_SLOTS.length) {
            const p = pt(base, 56);
            return (
              <g key={`chips-${digit}`}>
                <Chip x={p.x} y={p.y} r={7.5} />
                <text
                  x={p.x}
                  y={p.y}
                  transform={`rotate(${base} ${p.x} ${p.y})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="ui-monospace, monospace"
                  fontWeight={800}
                  fontSize={8}
                  fill="#f4e4b8"
                >
                  {count}
                </text>
              </g>
            );
          }
          return (
            <g key={`chips-${digit}`}>
              {CHIP_SLOTS.slice(0, count).map(([r, d], i) => {
                const p = pt(base + d, r);
                return <Chip key={i} x={p.x} y={p.y} r={CHIP_R} />;
              })}
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={HUB_R} fill={`url(#hubGrad-${uid})`} stroke="#2a1c02" strokeWidth={1.5} />
      </g>
      <circle cx={CX} cy={CY} r={RIM_INNER_R} fill={`url(#specularGrad-${uid})`} />
    </>
  );
});

  interface WheelProps {
    /** Smaller SVG + tighter padding for the mobile TABLE panel, where the
     * wheel now shares vertical space with Active Links underneath it.
     * viewBox is unchanged, so this is a pure proportional scale-down. */
    compact?: boolean;
    /** Collapses the SVG to zero height (animated), leaving only the
     * recent-digits strip. Mobile uses this while betting is open. */
    collapsed?: boolean;    
}

export function Wheel({ compact = false, collapsed = false }: WheelProps) {
  const { phase, wheelTargetDraw, speedMultiplier, streamHistory, reportWheelLanded, timeRemaining, activeTickets } = useGame();
  const spinWanted =
    phase === 'BETTING_CLOSED' ||
    phase === 'DRAWING' ||
  (!collapsed && phase === 'BETTING_OPEN' && timeRemaining > 0 && timeRemaining <= SPIN_LEAD_MS);
    // Markers = next digit each live link expects. Recomputed live while betting
  // is open (new bets appear, previous round's markers are replaced); frozen
  // through close/draw/result so they stay visible during the spin.
  const [markerCounts, setMarkerCounts] = useState<number[]>(() => Array(10).fill(0));
  useEffect(() => {
    if (phase !== 'BETTING_OPEN') return;
    const counts: number[] = Array(10).fill(0);
    for (const t of activeTickets) {
      const d = nextExpectedDigit(t);
      if (d !== null) counts[d] += 1;
    }
    setMarkerCounts((prev) => (prev.every((v, i) => v === counts[i]) ? prev : counts));
  }, [phase, activeTickets]);
  const uid = useId();
  const spinAngleRef = useRef(0);
  const discRef = useRef<SVGGElement>(null);
  function setRotation(angle: number) {
    discRef.current?.setAttribute('transform', `rotate(${-angle} ${CX} ${CY})`);
  }
  const [currentDigit, setCurrentDigit] = useState(wheelTargetDraw?.digit ?? 0);
  const [justLanded, setJustLanded] = useState(false);
  const [flapperTick, setFlapperTick] = useState(0);
  const [flapperBounce, setFlapperBounce] = useState(-16);

  const spinDirectionRef = useRef<1 | -1>(1);
// prevRevealedDrawIndexRef init + both effect-2 guards:
  const prevRevealedDrawIndexRef = useRef<number | undefined>(wheelTargetDraw?.drawIndex);
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
  
  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  function fireFlapperClick() {
    setFlapperBounce(spinDirectionRef.current * 16);
    setFlapperTick((t) => t + 1);
    playTick();
  }

  // Effect 1 — enter DRAWING: ease in to cruise speed, then hold. Does not
  // know the target digit yet.
  // Effect 1 — flip direction on every genuine entry into DRAWING, then use
  // it for this whole spin (both the indeterminate phase and landing read
  // the same spinDirectionRef.current, set once per phase entry, so they
  // can never disagree on which way this particular spin is going).
  useEffect(() => {
    if (!spinWanted) return;

    spinDirectionRef.current = spinDirectionRef.current === 1 ? -1 : 1;
    const direction = spinDirectionRef.current;

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
      lastAngularSpeedRef.current = angularSpeed; // magnitude only — direction applied below
      spinAngleRef.current += direction * angularSpeed * deltaSec;
      setRotation(spinAngleRef.current);

      const nextDigit = digitAtSpinAngle(spinAngleRef.current);
      if (nextDigit !== lastDigit) {
        lastDigit = nextDigit;
        fireFlapperClick();
      }
      indeterminateRafRef.current = requestAnimationFrame(step);
    }
    indeterminateRafRef.current = requestAnimationFrame(step);

    return () => {
      if (indeterminateRafRef.current !== null) cancelAnimationFrame(indeterminateRafRef.current);
    };
 }, [spinWanted]);

  // Effect 2 — the true digit is revealed. Decelerate uniformly from the
  // wheel's actual current speed to zero, landing exactly on it, traveling
  // only the minimum forward distance to the target (no artificial extra
  // revolutions — that's what was causing the landing to run too long).
  // This is the ONLY place the real digit is ever shown.
  useEffect(() => {
    if (!wheelTargetDraw) {
      prevRevealedDrawIndexRef.current = undefined; // after Reset
      return;
    }
    if (wheelTargetDraw.drawIndex === prevRevealedDrawIndexRef.current) return;
  prevRevealedDrawIndexRef.current = wheelTargetDraw.drawIndex;

    if (indeterminateRafRef.current !== null) {
      cancelAnimationFrame(indeterminateRafRef.current);
      indeterminateRafRef.current = null;
    }
    if (finalApproachRafRef.current !== null) {
      cancelAnimationFrame(finalApproachRafRef.current);
      finalApproachRafRef.current = null;
    }

    // Physical safety margin from each wedge boundary (peg location). The
    // flapper can only come to rest once past a peg's contact zone, so a
    // landing angle within this margin of either boundary is not physically
    // plausible and must be excluded either side.
    const PEG_SAFE_MARGIN_DEG = 6;


    const targetDigit = wheelTargetDraw!.digit; // see section 2 below for the rename
    const wasInstant = performance.now() - spinStartTimeRef.current < INSTANT_THRESHOLD_MS;
    const direction = spinDirectionRef.current;
    const currentAngle = spinAngleRef.current;
    // Random resting point inside the wedge, but never within
    // PEG_SAFE_MARGIN_DEG of either boundary peg — so the flapper can
    // visibly settle off-center (never robotically dead-center) while
    // never plausibly straddling a peg/border.
    const maxOffset = HOLE_STEP_DEG / 2 - PEG_SAFE_MARGIN_DEG;
    const restOffsetDeg = (Math.random() * 2 - 1) * maxOffset;
    const targetCenterAngle = targetDigit * HOLE_STEP_DEG + restOffsetDeg;

    const v0 = Math.max(60, lastAngularSpeedRef.current); // deg/s, includes speed multiplier
    const decelMs = DECEL_MS / speedMultiplierRef.current;
    const decelDist = (v0 * decelMs) / 1000 / DECEL_POWER;
    const toTarget =
      direction === 1 ? mod360(targetCenterAngle - currentAngle) : mod360(currentAngle - targetCenterAngle);
    const cruiseDist = mod360(toTarget - decelDist); // keep current speed this far, then decelerate
    const distanceDeg = cruiseDist + decelDist;
    const cruiseMs = (cruiseDist / v0) * 1000;
    const totalMs = cruiseMs + decelMs;
    const targetAngle = direction === 1 ? currentAngle + distanceDeg : currentAngle - distanceDeg;


    function land(finalAngle: number) {
      spinAngleRef.current = finalAngle;
      setRotation(finalAngle);
      setCurrentDigit(targetDigit);
      setJustLanded(true);
      reportWheelLanded(); // see section 2 below
      window.setTimeout(() => setJustLanded(false), 650);
    }

    if (wasInstant) {
      land(targetAngle);
      return;
    }

    const startAngle = currentAngle;
    const startTime = performance.now();
    let lastDigit = digitAtSpinAngle(startAngle);

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / totalMs);
      const travelled =
        elapsed < cruiseMs
          ? (v0 * elapsed) / 1000
          : cruiseDist + decelDist * easeOutPow(Math.min(1, (elapsed - cruiseMs) / decelMs));
      const angle = startAngle + direction * Math.min(travelled, distanceDeg);
      spinAngleRef.current = angle;
      setRotation(angle);

      const nextDigit = digitAtSpinAngle(angle);
      if (nextDigit !== lastDigit && t < 1) {
        lastDigit = nextDigit;
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
  }, [wheelTargetDraw, reportWheelLanded]);

  useEffect(
    () => () => {
      if (indeterminateRafRef.current !== null) cancelAnimationFrame(indeterminateRafRef.current);
      if (finalApproachRafRef.current !== null) cancelAnimationFrame(finalApproachRafRef.current);
    },
    [],
  );

  const recentDigits = streamHistory.slice(-10);
  const tall = useMediaQuery('(min-height: 800px)');
  const size = compact ? (tall ? 300 : 260) : 340;

  return (
    <section
      aria-label="Live number stream"
      className={[
        'relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-sm',
        compact ? 'p-3' : 'p-5 sm:p-6',
      ].join(' ')}
    >

      <div className={['flex flex-col items-center', compact ? '' : 'mt-1'].join(' ')}>
        {/* Shadow lives on this static wrapper, NOT on the svg that
            contains the rotating transform — filters recomputed against
            an animating transform is what caused the center "wobble". */}
        <div
          className="flex w-full justify-center overflow-hidden"
          style={{
            height: collapsed ? 0 : size + 10,
            opacity: collapsed ? 0 : 1,
            transition: 'height 300ms ease, opacity 200ms ease',
          }}
        >
        <div className="rounded-full shadow-[0_8px_18px_rgba(0,0,0,0.55)] [&>svg]:block">
          <svg width={size} height={size} viewBox="0 0 300 300">
            <WheelFrame uid={uid} />
            <WheelDisc uid={uid} discRef={discRef} landedDigit={justLanded ? currentDigit : null} markerCounts={markerCounts} />

            <circle cx={CX} cy={22} r={5} fill={`url(#frameGrad-${uid})`} stroke="#2a1c02" strokeWidth={1} />
            <g
              key={flapperTick}
              style={{
                transformOrigin: `${CX}px 19px`,
                animation: `flapper-click ${FLAPPER_CLICK_MS}ms ease-out`,
                ['--flapper-bounce' as string]: `${flapperBounce}deg`,
              }}
            >
              <path
                d={`M${CX - 5},15 Q${CX - 8},29 ${CX - 2},40 Q${CX},43 ${CX + 2},40 Q${CX + 8},29 ${CX + 5},15 Q${CX},12 ${CX - 5},15 Z`}
                fill={`url(#flapperGrad-${uid})`}
                stroke="#14171b"
                strokeWidth={1.2}
              />
              <path d={`M${CX},17 L${CX},38`} stroke="#14171b" strokeWidth={0.75} strokeLinecap="round" opacity={0.4} />
            </g>

            <style>{`
              @keyframes flapper-click {
                0% { transform: rotate(0deg); }
                35% { transform: rotate(var(--flapper-bounce, -18deg)); }
                100% { transform: rotate(0deg); }
              }
            `}</style>
          </svg>
        </div>
      </div>

        <div className={['flex flex-wrap items-center justify-center gap-1.5', compact ? 'mt-1.5' : 'mt-3'].join(' ')}>
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

    </section>
  );
}