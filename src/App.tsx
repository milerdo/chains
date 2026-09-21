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
import { GameHeader, ChainsMark } from './components/GameHeader';
import { LeftColumnControls } from './components/LeftColumnControls';
import { JackpotPanel } from './components/JackpotPanel';
import { Wheel } from './components/Wheel';
import { BettingPanel } from './components/BettingPanel';
import { TicketDrawer } from './components/Ticket';
import { EmojiChat } from './components/EmojiChat';
import { HelpModal } from './components/HelpModal';
import { DemoPanel } from './components/DemoPanel';
import { JackpotCelebration } from './components/JackpotCelebration';
import type { GamePhase } from './game/types';

type MobileTab = 'BET' | 'TABLE' | 'TICKETS';

function phaseDefaultTab(phase: GamePhase): MobileTab {
  return phase === 'BETTING_OPEN' ? 'BET' : 'TABLE';
}

import { useMediaQuery } from './hooks/useMediaQuery';

function AppShell() {
  const { activeTickets, phase } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => phaseDefaultTab(phase));
  const prevPhaseRef = useRef<GamePhase>(phase);
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
      setMobileTab(phaseDefaultTab(phase));
    }
  }, [phase]);

  return (
    <div className="table-ambience flex h-dvh flex-col overflow-hidden text-white/90">
      <GameHeader />

      {/* Desktop: fixed 3-column cabinet, no page scroll */}
      <main className="hidden min-h-0 flex-1 lg:flex lg:flex-col lg:overflow-hidden">
        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-[1fr_1.3fr_1fr] gap-4 overflow-hidden px-6 py-4">
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <EmojiChat />
            </div>
            <LeftColumnControls onOpenHelp={() => setHelpOpen(true)} />
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex shrink-0 justify-center">
+              <ChainsMark />
+            </div>
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
            <div className={['min-h-0 flex-1 overflow-y-auto pr-1', bettingLocked ? 'hidden' : ''].join(' ')}>
              <BettingPanel onLockChange={setBettingLocked} onAutoBetChange={setAutoBetInfo} />
            </div>
            {bettingLocked && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <TicketDrawer tickets={activeTickets} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile/tablet: tabbed cabinet */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {mobileTab === 'BET' && <BettingPanel />}
          {mobileTab === 'TABLE' && (
        <div className="flex flex-col gap-3">
          <JackpotPanel />
          {!isDesktop && <Wheel />}
        </div>
      )}
          {mobileTab === 'TICKETS' && (
            <div className="flex flex-col gap-4">
              <TicketDrawer tickets={activeTickets} />
              <div className="flex h-[420px] flex-col">
                <EmojiChat />
              </div>
            </div>
          )}
        </div>
        <nav className="flex border-t border-white/10 bg-[#141414]">
          <MobileTabButton label="Bet" active={mobileTab === 'BET'} onClick={() => setMobileTab('BET')} />
          <MobileTabButton label="Table" active={mobileTab === 'TABLE'} onClick={() => setMobileTab('TABLE')} />
          <MobileTabButton
            label={`Links${activeTickets.length > 0 ? ` (${activeTickets.length})` : ''}`}
            active={mobileTab === 'TICKETS'}
            onClick={() => setMobileTab('TICKETS')}
          />
        </nav>
      </main>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <DemoPanel />
      <JackpotCelebration />
    </div>
  );
}

function MobileTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition',
        active ? 'text-[#eab308]' : 'text-white/40',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}