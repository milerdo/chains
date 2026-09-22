// ============================================================================
// CHAINS — TicketCard + TicketDrawer
// Renders a single ticket's live progress (base sequence -> jackpot
// qualification -> resolution) and a collapsible drawer listing every
// active ticket. Purely presentational: every value here is read straight
// off the Ticket object the engine produces, never recomputed.
// ============================================================================

import { useState } from 'react';
import type { Ticket, TicketStatus } from '../game/types';
import { formatSignedCurrency } from '../utils/format';
import { LinkChain } from './ChainLinks';

const STATUS_META: Record<TicketStatus, { label: string; tone: string }> = {
  WAITING: { label: 'ACTIVE', tone: 'text-[#eab308]' },
  ACTIVE: { label: 'ACTIVE', tone: 'text-[#eab308]' },
  LOST: { label: 'LOSS', tone: 'text-red-400' },
  BASE_WON: { label: 'JACKPOT QUALIFICATION', tone: 'text-emerald-400' },
  JACKPOT_STEP_1: { label: 'JACKPOT QUALIFICATION', tone: 'text-emerald-400' },
  JACKPOT_STEP_2: { label: 'JACKPOT QUALIFICATION', tone: 'text-emerald-400' },
  JACKPOT_WON: { label: 'JACKPOT WON', tone: 'text-[#eab308]' },
  JACKPOT_LOST: { label: 'JACKPOT MISSED', tone: 'text-white/40' },
};

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const meta = STATUS_META[ticket.status];
  const isLost = ticket.status === 'LOST';
  const isJackpotWon = ticket.status === 'JACKPOT_WON';
  const inQualification = ticket.status === 'BASE_WON' || ticket.status === 'JACKPOT_STEP_1' || ticket.status === 'JACKPOT_STEP_2';
  const jackpotMissed = ticket.status === 'JACKPOT_LOST';

  return (
    <div
      className={[
        'rounded-2xl border p-3.5 transition-colors duration-300',
        isJackpotWon
          ? 'border-[#eab308] bg-[#eab308]/[0.08] shadow-[0_0_28px_-6px_rgba(234,179,8,0.55)]'
          : isLost
            ? 'border-red-400/20 bg-red-400/[0.03]'
            : inQualification || jackpotMissed
              ? 'border-emerald-400/25 bg-emerald-400/[0.04]'
              : 'border-white/[0.08] bg-white/[0.02]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(ticket.status === 'WAITING' || ticket.status === 'ACTIVE') && (
           <span className="font-mono text-[10px] text-white/35">
            STEP {ticket.baseProgress}/{ticket.baseSequence.length}
          </span>
          )}
        </div>
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-2.5">
        <LinkChain ticket={ticket} size="md" />
      </div>

      {(ticket.baseWinAmount !== null) && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-400/10 px-2.5 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300">
            Base Win Locked
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-emerald-300">
            {formatSignedCurrency(ticket.baseWinAmount)}
          </span>
        </div>
      )}

      {isJackpotWon && ticket.jackpotWinAmount !== null && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-[#eab308]/15 px-2.5 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#eab308]">
            {ticket.jackpotTier} JACKPOT
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-[#eab308]">
            {formatSignedCurrency(ticket.jackpotWinAmount)}
          </span>
        </div>
      )}

      {isLost && (
        <p className="mt-2.5 font-mono text-[10px] text-red-300/70">Sequence broken — link closed.</p>
      )}
    </div>
  );
}

export function TicketDrawer({ tickets }: { tickets: Ticket[] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      aria-label="Your active links"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          Your Links{tickets.length > 0 ? ` (${tickets.length})` : ''}
        </span>
        <span className={`text-white/40 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>▾</span>
      </button>

      {!collapsed && (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center font-mono text-xs text-white/30">
              No active links. Place a bet during the next betting window.
            </p>
          ) : (
            tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
          )}
        </div>
      )}
    </section>
  );
}
