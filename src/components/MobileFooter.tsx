// ============================================================================
// CHAINS — MobileFooter
// Now a clean utility bar only: sound, help, history, chat. Active-links
// strip moved to GameHeader (full width, mobile). Balance is NOT duplicated
// here — already shown in GameHeader on mobile.
// ============================================================================

import { useState } from 'react';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';
import { EmojiChat } from './EmojiChat';
import { Balance } from './Balance';

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
          🕘
        </button>
        <button type="button" onClick={handleToggleDemo} aria-label="Demo panel" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70">
          🛠️
        </button>
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setChatOpen(true);
          }}
          aria-label="Open table chat"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]"
        >
          💬
        </button>

        <div className="flex-1" />

        <Balance balance={balance} />
      </div>

      {chatOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Table chat"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="flex h-[80dvh] max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/60">Table Chat</span>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-white/50">
                ✕
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
              <EmojiChat />
            </div>
          </div>
        </div>
      )}
    </>
  );
}