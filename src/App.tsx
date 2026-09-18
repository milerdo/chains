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
import { JackpotPanel } from './components/JackpotPanel';
import { Wheel } from './components/Wheel';
import { BettingPanel } from './components/BettingPanel';
import { TicketDrawer } from './components/Ticket';
import { EmojiChat } from './components/EmojiChat';
import { HelpModal } from './components/HelpModal';
import { DemoPanel } from './components/DemoPanel';
import type { GamePhase } from './game/types';

type MobileTab = 'BET' | 'TABLE' | 'TICKETS';

function phaseDefaultTab(phase: GamePhase): MobileTab {
  return phase === 'BETTING_OPEN' ? 'BET' : 'TABLE';
}

function AppShell() {
  const { activeTickets, phase } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => phaseDefaultTab(phase));
  const prevPhaseRef = useRef<GamePhase>(phase);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      setMobileTab(phaseDefaultTab(phase));
    }
  }, [phase]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#121212] text-white/90">
      <GameHeader onOpenHelp={() => setHelpOpen(true)} />

      {/* Desktop: fixed 3-column cabinet, no page scroll */}
      <main className="hidden min-h-0 flex-1 lg:flex lg:flex-col lg:overflow-hidden">
        <JackpotPanel />
        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-[1fr_1.3fr_1fr] gap-4 overflow-hidden px-6 py-4">
          <div className="min-h-0 overflow-y-auto pr-1">
            <BettingPanel />
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
            <Wheel />
          </div>
          <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TicketDrawer tickets={activeTickets} />
            </div>
            <EmojiChat />
          </div>
        </div>
      </main>

      {/* Mobile/tablet: tabbed cabinet */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <JackpotPanel />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {mobileTab === 'BET' && <BettingPanel />}
          {mobileTab === 'TABLE' && <Wheel />}
          {mobileTab === 'TICKETS' && (
            <div className="flex flex-col gap-4">
              <TicketDrawer tickets={activeTickets} />
              <EmojiChat />
            </div>
          )}
        </div>
        <nav className="flex border-t border-white/10 bg-[#141414]">
          <MobileTabButton label="Bet" active={mobileTab === 'BET'} onClick={() => setMobileTab('BET')} />
          <MobileTabButton label="Table" active={mobileTab === 'TABLE'} onClick={() => setMobileTab('TABLE')} />
          <MobileTabButton
            label={`Tickets${activeTickets.length > 0 ? ` (${activeTickets.length})` : ''}`}
            active={mobileTab === 'TICKETS'}
            onClick={() => setMobileTab('TICKETS')}
          />
        </nav>
      </main>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <DemoPanel />
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