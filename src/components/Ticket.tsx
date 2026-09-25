import { useState } from 'react';
import type { Ticket, TicketStatus } from '../game/types';
import { formatSignedCurrency } from '../utils/format';
import { LinkChain } from './ChainLinks';

// WAITING/ACTIVE get no label at all now — the chain circles already show
// live progress. Non-empty labels only for states that add information the
// chain can't (a resolved outcome, or "you're in qualification now").
const STATUS_META: Record<TicketStatus, { label: string; tone: string }> = {
  WAITING: { label: '', tone: '' },
  ACTIVE: { label: '', tone: '' },
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
        'flex h-full min-h-0 flex-col justify-center gap-1 rounded-2xl border px-3.5 py-2 transition-colors duration-300',
        isJackpotWon
          ? 'border-[#eab308] bg-[#eab308]/[0.08] shadow-[0_0_28px_-6px_rgba(234,179,8,0.55)]'
          : isLost
            ? 'border-red-400/20 bg-red-400/[0.03]'
            : inQualification || jackpotMissed
              ? 'border-emerald-400/25 bg-emerald-400/[0.04]'
              : 'border-white/[0.08] bg-white/[0.02]',
      ].join(' ')}
    >
      {meta.label && (
        <span className={`self-end font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${meta.tone}`}>
          {meta.label}
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <LinkChain ticket={ticket} size="sm" />
        {ticket.baseWinAmount !== null && (
          <span
            className={[
              'shrink-0 font-mono text-xs font-bold tabular-nums',
              isJackpotWon ? 'text-[#eab308]' : 'text-emerald-300',
            ].join(' ')}
          >
            {formatSignedCurrency(isJackpotWon && ticket.jackpotWinAmount !== null ? ticket.jackpotWinAmount : ticket.baseWinAmount)}
          </span>
        )}
      </div>
    </div>
  );
}

export function TicketDrawer({ tickets }: { tickets: Ticket[] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      aria-label="Active links"
      className="flex h-full min-h-0 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex w-full shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
          Active Links{tickets.length > 0 ? ` (${tickets.length})` : ''}
        </span>
        <span className={`text-white/40 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>▾</span>
      </button>

      {!collapsed && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center font-mono text-xs text-white/30">
              No active links. Place a bet during the next betting window.
            </p>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="min-h-0 flex-1 max-h-[52px]">
                <TicketCard ticket={ticket} />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}