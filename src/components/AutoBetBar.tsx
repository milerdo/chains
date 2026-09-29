interface AutoBetBarProps {
  info: { roundsRemaining: number; roundsTotal: number; stop: () => void } | null;
}

export function AutoBetBar({ info }: AutoBetBarProps) {
  if (!info) return null;
  return (
    <div className="flex shrink-0 items-center justify-between rounded-xl border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#eab308]">
        Auto Bet {info.roundsTotal - info.roundsRemaining}/{info.roundsTotal}
      </span>
      <button
        type="button"
        onClick={info.stop}
        className="rounded-lg border border-[#eab308]/50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#eab308] transition hover:bg-[#eab308]/20"
      >
        Stop
      </button>
    </div>
  );
}