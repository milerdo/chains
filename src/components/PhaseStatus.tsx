import { useGame } from '../hooks/useGame';
import { formatCountdown } from '../utils/format';

export function PhaseStatus() {
  const { bettingLocked: locked, timeRemaining, autoBet, stopAutoBet } = useGame();
  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex h-10 shrink-0 items-center justify-center gap-3 rounded-t-3xl border-b border-white/[0.06] bg-[#141414]/95 px-4 backdrop-blur-sm sm:-mx-5 sm:-mt-5 sm:px-5">
      <span className="flex items-center justify-center gap-3">
        <span className={['font-mono text-xs font-semibold uppercase tracking-[0.3em]', locked ? 'text-[#eab308]' : 'text-emerald-400'].join(' ')}>
          {locked ? 'GOOD LUCK' : 'BETTING OPEN'}
        </span>
        <span className={['w-8 font-mono text-sm tabular-nums text-white/70', locked ? 'invisible' : ''].join(' ')}>{formatCountdown(timeRemaining)}s</span>
      </span>
      {autoBet && (
         <span className="absolute right-4 flex shrink-0 items-center gap-2 sm:right-5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#eab308]">
            Auto {autoBet.roundsTotal - autoBet.roundsRemaining}/{autoBet.roundsTotal}
          </span>
          <button
            type="button"
            onClick={stopAutoBet}
            className="rounded-lg border border-[#eab308]/50 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#eab308] transition hover:bg-[#eab308]/20"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}