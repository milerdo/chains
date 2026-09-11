// ============================================================================
// CHAINS — HelpModal
// "HOW TO PLAY" reference. All RTP figures and the RNG disclaimer are
// imported directly from src/game/constants.ts rather than re-typed here,
// so this modal can never silently drift out of sync with the engine's
// actual configured values.
// ============================================================================

import { useEffect, type ReactNode } from 'react';
import { BASE_MULTIPLIERS, RNG_DISCLAIMER, THEORETICAL_RTP } from '../game/constants';
import { formatPercent } from '../utils/format';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] p-6 shadow-2xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-bold tracking-[0.1em] text-white">HOW TO PLAY</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-white/70">
          <Section title="The shared live stream">
            <p>
              One continuous stream of digits (0–9) drives every ticket at the table. Every player watches the
              exact same draws — but your own ticket only starts counting from the first draw after your bet
              is placed, so two tickets can be at completely different points in their own sequence at once.
            </p>
          </Section>

          <Section title="Choose your tiers">
            <ul className="flex flex-col gap-1.5">
              <li>
                <span className="font-mono font-semibold text-white">LOW</span> — predict 1 digit ({BASE_MULTIPLIERS.LOW}x total return)
              </li>
              <li>
                <span className="font-mono font-semibold text-white">MEDIUM</span> — predict 2 digits, in exact order ({BASE_MULTIPLIERS.MEDIUM}x total return)
              </li>
              <li>
                <span className="font-mono font-semibold text-white">HIGH</span> — predict 3 digits, in exact order ({BASE_MULTIPLIERS.HIGH}x total return)
              </li>
            </ul>
            <p className="mt-2">
              Each tier you select is its own independent $1 ticket — play any combination of LOW, MEDIUM, and
              HIGH in the same round, from $1 up to $3.
            </p>
          </Section>

          <Section title="One miss ends the ticket">
            <p>
              If a draw doesn't match the next digit you need, the ticket loses immediately. It never waits for
              a second chance at that digit, never restarts, and never uses a later draw to catch up.
            </p>
          </Section>

          <Section title="Base win → jackpot qualification">
            <p>
              The instant your full sequence matches, the base payout is credited and locked in permanently —
              nothing that happens afterward can take it back. Your ticket then enters{' '}
              <span className="font-semibold text-white">Jackpot Qualification</span>: the next two draws are
              checked against your chosen 2-digit jackpot combination. Miss either one and qualification ends,
              but your base payout stays exactly as credited.
            </p>
          </Section>

          <Section title="Worked example">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 font-mono text-xs">
              <p className="text-white/50">Your ticket: HIGH — 4 → 2 → 3 · Jackpot: 7 → 4</p>
              <div className="mt-3 flex flex-col gap-1.5">
                <ExampleRow label="Draw 1" value="4" note="✓ matches" tone="win" />
                <ExampleRow label="Draw 2" value="2" note="✓ matches" tone="win" />
                <ExampleRow label="Draw 3" value="3" note="✓ BASE WIN — 888x credited" tone="win" />
                <ExampleRow label="Draw 4" value="7" note="✓ jackpot step 1" tone="win" />
                <ExampleRow label="Draw 5" value="4" note="✓ jackpot step 2 — GRAND JACKPOT WON" tone="jackpot" />
              </div>
            </div>
          </Section>

          <Section title="MINI · MIDI · GRAND">
            <p>
              Each tier feeds a different progressive pool: LOW tickets qualify for MINI, MEDIUM for MIDI, and
              HIGH for GRAND. Pools grow with every bet placed and reset to their seed value the moment they're
              won. If more than one ticket qualifies on the exact same draw, the pool splits evenly between
              them.
            </p>
          </Section>

          <Section title="RTP">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <RtpStat label="LOW" value={formatPercent(THEORETICAL_RTP.LOW)} />
              <RtpStat label="MEDIUM" value={formatPercent(THEORETICAL_RTP.MEDIUM)} />
              <RtpStat label="HIGH" value={formatPercent(THEORETICAL_RTP.HIGH)} />
              <RtpStat label="Overall target" value={formatPercent(THEORETICAL_RTP.overall)} highlight />
            </div>
            <p className="mt-2 text-xs text-white/45">
              Progressive jackpot contributions add further expected value on top of the base-game figures
              above. House edge: {formatPercent(THEORETICAL_RTP.houseEdge)}.
            </p>
          </Section>

          <Section title="Demo disclaimer">
            <p className="text-xs text-white/45">{RNG_DISCLAIMER}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#eab308]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ExampleRow({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'win' | 'jackpot';
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-white/40">{label}</span>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] font-bold text-white">
        {value}
      </span>
      <span className={tone === 'jackpot' ? 'font-semibold text-[#eab308]' : 'text-emerald-300'}>{note}</span>
    </div>
  );
}

function RtpStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2 text-center',
        highlight ? 'border-[#eab308]/40 bg-[#eab308]/[0.06]' : 'border-white/[0.07] bg-white/[0.02]',
      ].join(' ')}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className={['mt-0.5 font-mono text-sm font-bold', highlight ? 'text-[#eab308]' : 'text-white'].join(' ')}>
        {value}
      </div>
    </div>
  );
}
