// ============================================================================
// CHAINS — EmojiChat
// Lightweight, whitelist-only "table talk". Purely local UI state — no
// persistence, no backend, no simulated players, no animation. Tapping an
// approved emoji appends it to a short rolling strip; once full, the oldest
// entry is silently dropped as a new one comes in.
// ============================================================================

import { useState } from 'react';
import { playUiClick } from '../utils/audio';

const APPROVED_EMOJIS = ['🔥', '😂', '😮', '😢', '🎉', '💰', '🙌', '😎', '🍀', '👏', '😤', '🤞', '💯', '⚡'];

const MAX_VISIBLE_MESSAGES = 6;

interface ChatMessage {
  id: number;
  emoji: string;
}

let messageIdCounter = 0;

export function EmojiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function sendEmoji(emoji: string) {
    playUiClick();
    messageIdCounter += 1;
    setMessages((prev) => [...prev, { id: messageIdCounter, emoji }].slice(-MAX_VISIBLE_MESSAGES));
  }

  return (
    <section
      aria-label="Table chat"
      className="flex flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Table Chat</span>

      <div className="mt-3 flex min-h-[2.5rem] flex-wrap items-center gap-1.5">
        {messages.length === 0 ? (
          <span className="font-mono text-[11px] text-white/25">No messages yet.</span>
        ) : (
          messages.map((msg) => (
            <span key={msg.id} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-lg">
              {msg.emoji}
            </span>
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {APPROVED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendEmoji(emoji)}
            aria-label={`Send ${emoji}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-base transition hover:border-[#eab308]/50 hover:bg-[#eab308]/10 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}