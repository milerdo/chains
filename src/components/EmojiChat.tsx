import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import type { GamePhase } from '../game/types';

const APPROVED_EMOJIS = [
  '🔥', '😂', '😮', '😢', '🎉', '💰', '🙌', '😎', '🍀', '👏', '😤', '🤞', '💯', '⚡',
  '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣',
];

const GRID_COLS = 7;
const GRID_SIZE = GRID_COLS * 3; // 21, no scroll
const STORAGE_KEY = 'chains-table-chat';

function loadStoredCells(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, GRID_SIZE) : [];
  } catch {
    return [];
  }
}

export function EmojiChat() {
  const { phase } = useGame();
  const [cells, setCells] = useState<string[]>(() => loadStoredCells());
  const [sentThisRound, setSentThisRound] = useState(false);
  const prevPhaseRef = useRef<GamePhase>(phase);

  useEffect(() => {
    if (phase === 'BETTING_OPEN' && prevPhaseRef.current !== 'BETTING_OPEN') {
      setSentThisRound(false);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
    } catch {
      // best-effort — ignore storage failures (private mode, quota, etc.)
    }
  }, [cells]);

  function sendEmoji(emoji: string) {
    if (sentThisRound) return;
    playUiClick();
    setSentThisRound(true);
    // Fills like a snake until full, then starts over from cell 0.
    setCells((prev) => (prev.length >= GRID_SIZE ? [emoji] : [...prev, emoji]));
  }

  return (
    <section
      aria-label="Table chat"
      className="flex flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Table Chat</span>
        <span className="font-mono text-[10px] text-white/30">{sentThisRound ? 'sent this round' : '1 per round'}</span>
      </div>

      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-md bg-white/[0.03] text-sm">
            {cells[i] ?? ''}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-8 gap-1.5">
        {APPROVED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendEmoji(emoji)}
            disabled={sentThisRound}
            aria-label={`Send ${emoji}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sm transition hover:border-[#eab308]/50 hover:bg-[#eab308]/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}