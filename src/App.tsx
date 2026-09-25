// ============================================================================
// CHAINS — App
// Cabinet-style layout, no page scroll. Desktop: fixed 3-column grid
// (betting | wheel/jackpot | tickets+chat). Mobile: tabbed BET/TABLE/TICKETS,
// auto-switching on phase change (BETTING_OPEN -> BET, wheel hidden;
// anything else -> TABLE so the player never misses a draw). A manual tap
// wins until the next genuine phase transition (same prevPhaseRef pattern
// used elsewhere — DemoPanel, Wheel.tsx).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { GameProvider, useGame } from './hooks/useGame';
import { GameHeader } from './components/GameHeader';
 // LeftColumnControls retired — its job (help/sound/balance) moved into
 // GameHeader's desktop control cluster.
import { JackpotPanel } from './components/JackpotPanel';
import { Wheel } from './components/Wheel';
import { BettingPanel } from './components/BettingPanel';
import { TicketDrawer } from './components/Ticket';
import { EmojiChat } from './components/EmojiChat';
import { HelpModal } from './components/HelpModal';
import { BetHistoryModal } from './components/BetHistoryModal';
import { DemoPanel } from './components/DemoPanel';
import { JackpotCelebration } from './components/JackpotCelebration';
import { MobileFooter } from './components/MobileFooter';
import { PhaseStatus } from './components/PhaseStatus';
import type { GamePhase } from './game/types';
import { useMediaQuery } from './hooks/useMediaQuery';

function AppShell() {
  const { activeTickets, phase, timeRemaining, hasBetThisRound, balance } = useGame();
  // Drives PhaseStatus on mobile, where there's no lifted per-instance
  // lock signal (BettingPanel's own onLockChange is desktop-only per
  // CLAUDE.md §13). Approximates the same "can the player still bet"
  // condition BettingPanel computes internally.
  const mobileLocked = phase !== 'BETTING_OPEN' || hasBetThisRound;
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); 
  const [demoOpen, setDemoOpen] = useState(false);
  const prevPhaseRef = useRef<GamePhase>(phase);
  const betPanelRef = useRef<HTMLDivElement>(null);
  const tablePanelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // matches Tailwind's `lg`
  const [bettingLocked, setBettingLocked] = useState(false);
  const [autoBetInfo, setAutoBetInfo] = useState<{
    roundsRemaining: number;
    roundsTotal: number;
    stop: () => void;
  } | null>(null);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      const target = phase === 'BETTING_OPEN' ? betPanelRef.current : tablePanelRef.current;
      target?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  }, [phase]);

  return (
    <div className="table-ambience flex h-dvh flex-col overflow-hidden text-white/90">
      <GameHeader
        onOpenHelp={() => setHelpOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onToggleDemo={() => setDemoOpen((o) => !o)}
      />

      {/* Desktop: fixed 3-column cabinet, no page scroll */}
      <main className="hidden min-h-0 flex-1 lg:flex lg:flex-col lg:overflow-hidden">
        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-[1fr_1.3fr_1fr] gap-4 overflow-hidden px-6 py-4">
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <EmojiChat />
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <JackpotPanel />
            {isDesktop && <Wheel />}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
            {autoBetInfo && (
              <div className="mb-2 flex shrink-0 items-center justify-between rounded-xl border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#eab308]">
                  Auto Bet {autoBetInfo.roundsTotal - autoBetInfo.roundsRemaining}/{autoBetInfo.roundsTotal}
                </span>
                <button
                  type="button"
                  onClick={autoBetInfo.stop}
                  className="rounded-lg border border-[#eab308]/50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#eab308] transition hover:bg-[#eab308]/20"
                >
                  Stop
                </button>
              </div>
            )}
            <PhaseStatus locked={bettingLocked} timeRemaining={timeRemaining} />
            <div className={['min-h-0 flex-1 overflow-y-auto pr-1', bettingLocked ? 'hidden' : ''].join(' ')}>
              <BettingPanel onLockChange={setBettingLocked} onAutoBetChange={setAutoBetInfo} />
            </div>
            {bettingLocked && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <TicketDrawer tickets={activeTickets} />
             </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile/tablet: swipeable cabinet (BET / TABLE / LINKS), scroll-snap */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden">
          <div ref={betPanelRef} className="min-h-0 w-full shrink-0 snap-start overflow-y-auto px-4 py-4">
            <PhaseStatus locked={mobileLocked} timeRemaining={timeRemaining} />
            <BettingPanel />
          </div>
          <div ref={tablePanelRef} className="flex min-h-0 w-full shrink-0 snap-start flex-col gap-3 overflow-y-auto px-4 py-4">
            <JackpotPanel />
            {!isDesktop && <Wheel />}
          </div>
          <div className="flex min-h-0 w-full shrink-0 snap-start flex-col overflow-hidden px-4 py-4">
            <PhaseStatus locked={mobileLocked} timeRemaining={timeRemaining} />
            <TicketDrawer tickets={activeTickets} />
          </div>
        </div>
       <MobileFooter
          balance={balance}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onToggleDemo={() => setDemoOpen((o) => !o)}
        />
      </main>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <BetHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <DemoPanel isOpen={demoOpen} />
      <JackpotCelebration />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}