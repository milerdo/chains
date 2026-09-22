// ============================================================================
// CHAINS — GameHeader
// Represents the HOSTING SITE's chrome (e.g. a casino platform embedding
// CHAINS as one of its games), not the game itself — mirrors how a game
// like Crazy Time still shows the host casino's own header above it. The
// CHAINS wordmark lives inside the app now (see App.tsx's ChainsBadge).
// ============================================================================

import { useGame } from '../hooks/useGame';
import { Balance } from './Balance';

export function GameHeader() {
  const { balance } = useGame();
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <HostMark />
        <div className="lg:hidden">
          <Balance balance={balance} />
        </div>
      </div>
    </header>
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