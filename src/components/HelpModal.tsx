// ============================================================================
// CHAINS — HelpModal
// "HOW TO PLAY" reference. All RTP figures and the RNG disclaimer are
// imported directly from src/game/constants.ts rather than re-typed here,
// so this modal can never silently drift out of sync with the engine's
// actual configured values.
// ============================================================================

import { useEffect, type ReactNode } from 'react';
import { BASE_MULTIPLIERS, RNG_DISCLAIMER } from '../game/constants';
import { houseEdge, overallRtp, totalRtp } from '../game/rtp';
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
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs text-white/50 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-white/70">
          <Section title="How it works">
            <p>
              One shared stream of digits (0–9). Every player sees the same draws. Your link starts on the
              first draw after your bet.
            </p>
          </Section>

          <Section title="Pick your bet">
            <ul className="flex flex-col gap-1.5">
              <li><span className="font-mono font-semibold text-white">LOW</span> — 1 digit · {BASE_MULTIPLIERS.LOW}x</li>
              <li><span className="font-mono font-semibold text-white">MIDI</span> — 2 digits, in order · {BASE_MULTIPLIERS.MEDIUM}x</li>
              <li><span className="font-mono font-semibold text-white">HIGH</span> — 3 digits, in order · {BASE_MULTIPLIERS.HIGH}x</li>
            </ul>
            <p className="mt-2">
              Each link costs $1. One tier per round. <span className="text-white">Combo</span> covers every order of
              your digits, at $1 per order. LOW lets you pick up to 3 different digits.
            </p>
          </Section>

          <Section title="Win or lose">
            <p>
              Each draw must match your next digit. One miss and the link is lost. When the whole sequence matches,
              your payout is credited instantly and can never be taken back.
            </p>
          </Section>

          <Section title="Jackpot">
            <p>
              After a win, the next two draws must match your jackpot pair, in order. Match both and you win the
              pool for your tier (LOW, MIDI or HIGH). Miss and you simply keep your win.
            </p>
          </Section>

          <Section title="Example">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 font-mono text-xs">
              <p className="text-white/50">HIGH 4 → 2 → 3 · Jackpot 7 → 4</p>
              <div className="mt-3 flex flex-col gap-1.5">
                <ExampleRow label="Draw 1" value="4" note="✓ match" tone="win" />
                <ExampleRow label="Draw 2" value="2" note="✓ match" tone="win" />
                <ExampleRow label="Draw 3" value="3" note="✓ WIN — 888x paid" tone="win" />
                <ExampleRow label="Draw 4" value="7" note="✓ jackpot 1/2" tone="win" />
                <ExampleRow label="Draw 5" value="4" note="✓ HIGH JACKPOT WON" tone="jackpot" />
              </div>
            </div>
          </Section>

          <Section title="RTP">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <RtpStat label="LOW" value={formatPercent(totalRtp('LOW'))} />
              <RtpStat label="MIDI" value={formatPercent(totalRtp('MEDIUM'))} />
              <RtpStat label="HIGH" value={formatPercent(totalRtp('HIGH'))} />
              <RtpStat label="Average" value={formatPercent(overallRtp())} highlight />
            </div>
            <p className="mt-2 text-xs text-white/45">
              Includes the jackpot share, funded entirely by bets (no seed). Average house edge: {formatPercent(houseEdge())}.
            </p>
          </Section>

          <Section title="Demo">
            <p className="text-xs text-white/45">{RNG_DISCLAIMER}</p>
            <p className="mt-1.5 text-xs text-white/45">
              Player counts, the heat map and chat are simulated for demonstration.
            </p>
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
