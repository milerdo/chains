// ============================================================================
// CHAINS — NumberStream
// The shared, continuous stream — every player sees the exact same ribbon.
// Horizontally scrollable so it never breaks the mobile layout, auto-scrolls
// to the newest digit, and gives that digit a brief emphasis pulse.
// ============================================================================

import { useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { formatDrawIndex } from '../utils/format';

const VISIBLE_HISTORY_LENGTH = 15;

export function NumberStream() {
  const { streamHistory, drawIndex } = useGame();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recent = streamHistory.slice(-VISIBLE_HISTORY_LENGTH);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [recent.length]);

  return (
    <section
      aria-label="Recent draw history"
      className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:px-6"
    >
      <span className="hidden shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-white/50 sm:block">
        {formatDrawIndex(drawIndex)}
      </span>
      <div
        ref={scrollRef}
        className="flex flex-1 gap-1.5 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {recent.length === 0 && (
          <span className="whitespace-nowrap font-mono text-xs text-white/30">
            Stream will appear once the first draw resolves…
          </span>
        )}
        {recent.map((draw, i) => {
          const isLatest = i === recent.length - 1;
          return (
            <span
              key={draw.drawIndex}
              title={formatDrawIndex(draw.drawIndex)}
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold tabular-nums transition-all duration-300',
                isLatest
                  ? 'scale-110 bg-[#eab308] text-black shadow-[0_0_16px_-2px_rgba(234,179,8,0.7)]'
                  : 'bg-white/[0.04] text-white/50',
              ].join(' ')}
            >
              {draw.digit}
            </span>
          );
        })}
      </div>
    </section>
  );
}
