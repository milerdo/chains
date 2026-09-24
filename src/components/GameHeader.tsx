// ============================================================================
// CHAINS — GameHeader
// Desktop: hosts the consolidated control cluster (help / sound / balance /
// history), roulette-style top-right — absorbs LeftColumnControls' job.
// Mobile: top row keeps HostMark + Balance; a new full-width row below shows
// active links (LinkChain), replacing the old cramped MobileFooter strip.
// ============================================================================

import { useState, type ReactNode } from 'react';
import { useGame } from '../hooks/useGame';
import { Balance } from './Balance';
import { LinkChain } from './ChainLinks';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';

interface GameHeaderProps {
  onOpenHelp: () => void;
  /** Wired in Milestone 3 (Bet History view). Button renders and fires this
   * now; the modal/content it opens does not exist yet. */
  onOpenHistory: () => void;
  onToggleDemo: () => void;
}

 export function GameHeader({ onOpenHelp, onOpenHistory, onToggleDemo }: GameHeaderProps) {
  const { balance, activeTickets } = useGame();
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
  function handleOpenHistory() {
    playUiClick();
    onOpenHistory();
  }
  function handleToggleDemo() {
    playUiClick();
    onToggleDemo();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <HostMark />

        {/* Desktop control cluster — retires LeftColumnControls */}
        <div className="hidden items-center gap-2 lg:flex">
          <HeaderIconButton onClick={handleOpenHelp} label="How to play">
            ?
          </HeaderIconButton>
          <HeaderIconButton onClick={handleToggleSound} label={soundOn ? 'Mute sound' : 'Unmute sound'}>
            {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
          </HeaderIconButton>
          <HeaderIconButton onClick={handleOpenHistory} label="Bet history">
            <HistoryIcon />
          </HeaderIconButton>
          <HeaderIconButton onClick={handleToggleDemo} label="Demo panel">
            <DemoIcon />
          </HeaderIconButton>
          <Balance balance={balance} />
        </div>

        {/* Mobile: balance stays up top */}
        <div className="lg:hidden">
          <Balance balance={balance} />
        </div>
      </div>

      {/* Mobile: full-width active links row (was MobileFooter's strip) */}
      <div className="border-t border-white/[0.05] px-4 py-2 lg:hidden">
        <div className="flex items-center gap-3 overflow-x-auto">
          {activeTickets.length === 0 ? (
            <span className="font-mono text-[10px] text-white/25">No active links</span>
          ) : (
            activeTickets.map((ticket) => (
              <div key={ticket.id} className="shrink-0">
                <LinkChain ticket={ticket} size="xs" />
              </div>
            ))
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderIconButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
    >
      {children}
    </button>
  );
}

function SoundOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      <path d="M15.5 8.5l5 7M20.5 8.5l-5 7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function HostMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="9" stroke="#c9a24a" strokeWidth="1.5" />
        <circle cx="11" cy="11" r="3.5" fill="#c9a24a" />
      </svg>
      <span className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/70">
        Milo <span className="text-[#c9a24a]">Casino</span>
      </span>
    </div>
  );
}

export function ChainsMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" stroke="#eab308" strokeWidth="2" />
        <circle cx="17" cy="17" r="5.5" stroke="#eab308" strokeWidth="2" />
      </svg>
      <span className="font-mono text-sm font-bold tracking-[0.15em] text-white">
        CHAIN<span className="text-[#eab308]">S</span>
      </span>
    </div>
  );
}

function DemoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}