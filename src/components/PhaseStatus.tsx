import { formatCountdown } from '../utils/format';

interface PhaseStatusProps {
  locked: boolean;
  timeRemaining: number;
}

export function PhaseStatus({ locked, timeRemaining }: PhaseStatusProps) {
  return (
    <div className="mb-3 flex shrink-0 items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
      <span
        className={[
          'min-w-[118px] font-mono text-xs font-semibold uppercase tracking-[0.3em]',
          locked ? 'text-[#eab308]' : 'text-emerald-400',
        ].join(' ')}
      >
        {locked ? 'GOOD LUCK' : 'BETTING OPEN'}
      </span>
      {!locked && (
        <span className="font-mono text-sm tabular-nums text-white/70">{formatCountdown(timeRemaining)}s</span>
      )}
    </div>
  );
}