// ============================================================================
// CHAINS — App
// Top-level layout. Wraps the whole tree in <GameProvider> (the single
// ChainsGame engine instance lives there — see hooks/useGame.ts) and
// arranges every Phase 2 component into a responsive dark-mode layout:
// a single stacked column on mobile (matching the flow in the build spec's
// Section 20 mock), widening into a two-column live-table + sidebar
// layout from the lg breakpoint up. No game logic lives here — this file
// only lays components out.
// ============================================================================

import { useState } from 'react';
import { GameProvider, useGame } from './hooks/useGame';
import { GameHeader } from './components/GameHeader';
import { JackpotPanel } from './components/JackpotPanel';
import { Wheel } from './components/Wheel';
import { NumberStream } from './components/NumberStream';
import { BettingPanel } from './components/BettingPanel';
import { TicketDrawer } from './components/Ticket';
import { GameHistory } from './components/GameHistory';
import { MultiplayerSim } from './components/MultiplayerSim';
import { HelpModal } from './components/HelpModal';
import { DemoPanel } from './components/DemoPanel';

function AppShell() {
  const { activeTickets } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#121212] pb-32 text-white/90">
      <GameHeader onOpenHelp={() => setHelpOpen(true)} />

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-6">
        {/* Live table: jackpots, wheel/stream, betting, active tickets */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <JackpotPanel />
          <Wheel />
          <NumberStream />
          <BettingPanel />
          <TicketDrawer tickets={activeTickets} />
        </div>

        {/* Sidebar: table activity + history. Stacks below the live table
            on mobile/tablet, pins alongside it from lg up. */}
        <aside className="flex w-full flex-col gap-5 lg:w-[360px] lg:shrink-0">
          <MultiplayerSim />
          <GameHistory />
        </aside>
      </main>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <DemoPanel />
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
