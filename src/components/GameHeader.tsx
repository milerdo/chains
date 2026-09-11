// ============================================================================
// CHAINS — GameHeader
// Slim, dark, sticky top bar. Wordmark, live-table indicator, sound toggle,
// help trigger, and the wallet balance.
// ============================================================================

import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Balance } from './Balance';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';

interface GameHeaderProps {
  onOpenHelp: () => void;
}

export function GameHeader({ onOpenHelp }: GameHeaderProps) {
  const { balance, simulatedActivity } = useGame();
  const [soundOn, setSoundOn] = useState(() => isAudioEnabled());

  function handleToggleSound() {
    const next = toggleAudioEnabled();
    setSoundOn(next);
    if (next) playUiClick();
  }

  function handleOpenHelp() {
    playUiClick();
    onOpenHelp();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <ChainsMark />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">Live Table</span>
            <span className="mt-0.5 text-[11px] text-white/30">Demo credits only</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-xs text-white/60">
              {simulatedActivity.playerCount.toLocaleString()} playing now
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenHelp}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
            aria-label="How to play"
          >
            ?
          </button>

          <button
            type="button"
            onClick={handleToggleSound}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
          >
            {soundOn ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
          </button>

          <Balance balance={balance} />
        </div>
      </div>
    </header>
  );
}

function ChainsMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" stroke="#eab308" strokeWidth="2" />
        <circle cx="17" cy="17" r="5.5" stroke="#eab308" strokeWidth="2" />
      </svg>
      <span className="font-mono text-lg font-bold tracking-[0.15em] text-white">
        CHAIN<span className="text-[#eab308]">S</span>
      </span>
    </div>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      <path
        d="M15.5 8.5l5 7M20.5 8.5l-5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
