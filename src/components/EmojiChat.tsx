// ============================================================================
// CHAINS — EmojiChat
// Local, per-browser "table chat". Not real multiplayer — persisted to
// localStorage only (see CLAUDE.md log). Each message is identified by its
// own send time (hh:mm:ss) rather than a player name, per design decision.
// Up to MAX_SENDS_PER_ROUND emoji/messages per betting round.
// ============================================================================

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import type { GamePhase } from '../game/types';

const APPROVED_EMOJIS = [
  '🔥', '😂', '😮', '😢', '🎉', '💰', '🙌', '😎', '🍀', '👏', '😤', '🤞', '💯', '⚡',
];

const MAX_SENDS_PER_ROUND = 5;
const MAX_MESSAGE_LENGTH = 60;
const MAX_STORED_MESSAGES = 100;
const STORAGE_KEY = 'chains-table-chat';

interface ChatMessage {
  id: string;
  text: string;
  sentAt: number;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((m): m is ChatMessage => !!m && typeof m.text === 'string' && typeof m.sentAt === 'number')
          .slice(-MAX_STORED_MESSAGES)
      : [];
  } catch {
    return [];
  }
}

export function EmojiChat() {
  const { phase, simulatedActivity } = useGame();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages());
  const [draft, setDraft] = useState('');
  const [sentThisRound, setSentThisRound] = useState(0);
  const prevPhaseRef = useRef<GamePhase>(phase);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'BETTING_OPEN' && prevPhaseRef.current !== 'BETTING_OPEN') {
      setSentThisRound(0);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {
      // best-effort — ignore storage failures (private mode, quota, etc.)
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const canSend = sentThisRound < MAX_SENDS_PER_ROUND;

  function pushMessage(text: string) {
    if (!canSend || !text.trim()) return;
    playUiClick();
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, sentAt: Date.now() },
    ]);
    setSentThisRound((n) => n + 1);
  }

  function handleSubmitMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = draft.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;
    pushMessage(trimmed);
    setDraft('');
  }

  return (
    <section
      aria-label="Table chat"
      className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {simulatedActivity.playerCount.toLocaleString()} playing now
        </span>
        <span className="font-mono text-[10px] text-white/30">
          {sentThisRound}/{MAX_SENDS_PER_ROUND} this round
        </span>
      </div>

      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center font-mono text-xs text-white/25">
            No messages yet — say hi to the table.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2 rounded-lg px-2 py-1 font-mono text-xs odd:bg-white/[0.02]">
                <span className="shrink-0 tabular-nums text-white/30">{formatTimestamp(m.sentAt)}</span>
                <span className="break-words text-white/70">{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap gap-1.5">
        {APPROVED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => pushMessage(emoji)}
            disabled={!canSend}
            aria-label={`Send ${emoji}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sm transition hover:border-[#eab308]/50 hover:bg-[#eab308]/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {emoji}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmitMessage} className="mt-2 flex shrink-0 items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          disabled={!canSend}
          placeholder={canSend ? 'Say something…' : 'Chat limit reached this round'}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-white placeholder:text-white/25 focus:border-[#eab308]/50 focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!canSend || !draft.trim()}
          className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#eab308] transition hover:bg-[#eab308]/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Send
        </button>
      </form>
    </section>
  );
}