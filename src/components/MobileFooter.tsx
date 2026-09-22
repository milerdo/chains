// ============================================================================
// CHAINS — MobileFooter
// Replaces the old (non-functional) BET/TABLE/LINKS bottom nav. Sticky bar:
// sound + help on the left, a condensed live chain strip of active links in
// the middle, table chat as a slide-up sheet on the right.
// ============================================================================

import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { isAudioEnabled, playUiClick, toggleAudioEnabled } from '../utils/audio';
import { LinkChain } from './ChainLinks';
import { EmojiChat } from './EmojiChat';

interface MobileFooterProps {
  onOpenHelp: () => void;
}

export function MobileFooter({ onOpenHelp }: MobileFooterProps) {
  const { activeTickets } = useGame();
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

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#141414] px-2 py-2">
        <button
          type="button"
          onClick={handleToggleSound}
          aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button
          type="button"
          onClick={handleOpenHelp}
          aria-label="How to play"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70"
        >
          ?
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pl-1">
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

        <button
          type="button"
          onClick={() => {
            playUiClick();
            setChatOpen(true);
          }}
          aria-label="Open table chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]"
        >
          💬
        </button>
      </div>

      {chatOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Table chat"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="max-h-[75vh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/60">Table Chat</span>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close" className="text-white/50">
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] px-3 pb-3">
              <EmojiChat />
            </div>
          </div>
        </div>
      )}
    </>
  );
}