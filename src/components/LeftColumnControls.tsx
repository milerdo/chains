import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Balance } from './Balance';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';

interface LeftColumnControlsProps {
  onOpenHelp: () => void;
}

export function LeftColumnControls({ onOpenHelp }: LeftColumnControlsProps) {
  const { balance } = useGame();
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
    <div className="flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
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
          {soundOn ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 9v6h4l5 5V4L8 9H4z" />
              <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 9v6h4l5 5V4L8 9H4z" />
              <path d="M15.5 8.5l5 7M20.5 8.5l-5 7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <Balance balance={balance} />
    </div>
  );
}