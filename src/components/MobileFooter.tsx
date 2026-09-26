// ============================================================================
// CHAINS — MobileFooter
// Utility bar: sound, help, history, socials (chat + heat map). Active-links
// strip is a separate docked bar in App.tsx, not here.
// ============================================================================

import { useState } from 'react';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';
import { EmojiChat } from './EmojiChat';
import { MultiplayerSim } from './MultiplayerSim';
import { Balance } from './Balance';
import { HistoryIcon } from './GameHeader';

interface MobileFooterProps {
  balance: number;
  onOpenHelp: () => void;
  onOpenHistory: () => void;
  onToggleDemo: () => void;
}

export function MobileFooter({ balance, onOpenHelp, onOpenHistory, onToggleDemo }: MobileFooterProps) {
  const [soundOn, setSoundOn] = useState(() => isAudioEnabled());
  const [chatOpen, setChatOpen] = useState(false);

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
    <>
      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#141414] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2">
        <button
          type="button"
          onClick={handleToggleSound}
          aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button
          type="button"
          onClick={handleOpenHelp}
          aria-label="How to play"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70"
        >
          ?
        </button>

        <button
          type="button"
          onClick={handleOpenHistory}
          aria-label="Bet history"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70"
        >
          <HistoryIcon />
        </button>
        <button type="button" onClick={handleToggleDemo} aria-label="Demo panel" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70">
          🛠️
        </button>
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setChatOpen((o) => !o);
          }}
          aria-label="Open socials"
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition',
            chatOpen ? 'border-[#eab308] bg-[#eab308]/20 text-[#eab308]' : 'border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]',
          ].join(' ')}
        >
          <PeopleIcon />
        </button>

        <div className="flex-1" />

        <Balance balance={balance} />
      </div>

      {chatOpen && (
        <div
          className="fixed inset-x-0 top-14 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] z-[55] flex items-end bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Socials"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/60">Socials</span>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-white/50">
                ✕
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
              <div className="h-[29%] min-h-[130px] shrink-0">
                <MultiplayerSim />
              </div>
              <EmojiChat />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Original three-person "socials" glyph. */
function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M2 19c0-3.3 2.7-6 6-6s6 2.7 6 6v1H2v-1z" />
      <circle cx="17.5" cy="8.5" r="2.4" opacity="0.75" />
      <path d="M14.8 13.2c.9-.5 1.9-.8 2.7-.8 2.6 0 4.7 2.1 4.7 4.7V19h-5.4v-1c0-1.8-.7-3.4-2-4.8z" opacity="0.75" />
    </svg>
  );
}