import type { Ticket } from '../game/types';
import { LinkChain } from './ChainLinks';

export function TicketCard({ ticket, dense = false }: { ticket: Ticket; dense?: boolean }) {
  const isLost = ticket.status === 'LOST';
  const isJackpotWon = ticket.status === 'JACKPOT_WON';
  const inQualification = ticket.status === 'BASE_WON' || ticket.status === 'JACKPOT_STEP_1' || ticket.status === 'JACKPOT_STEP_2';
  const jackpotMissed = ticket.status === 'JACKPOT_LOST';

  return (
    <div
      className={[
        'flex h-full min-h-0 flex-col justify-center rounded-2xl border px-3.5 py-2 transition-colors duration-300',
        dense ? '!px-1.5 items-center' : '',
        isJackpotWon
          ? 'border-[#eab308] bg-[#eab308]/[0.08] shadow-[0_0_28px_-6px_rgba(234,179,8,0.55)]'
          : isLost
            ? 'border-red-400/20 bg-red-400/[0.03]'
            : inQualification
              ? 'border-[#eab308]/60 bg-[#eab308]/[0.12]'
              : jackpotMissed
                ? 'border-emerald-400/25 bg-emerald-400/[0.04]'
                : 'border-white/[0.08] bg-white/[0.02]',
      ].join(' ')}
    >
    <LinkChain ticket={ticket} size={dense ? 'xs' : 'sm'} />
    </div>
  );
}

export function TicketDrawer({ tickets, compact = false, grid = false }: { tickets: Ticket[]; compact?: boolean; grid?: boolean }) {
  return (
    <section
      aria-label="Active links"
      className={[
        'flex min-h-0 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-sm',
        compact ? 'shrink p-2' : 'h-full p-3',
      ].join(' ')}
    >
      <div
        className={[
          'min-h-0 flex-1',
          grid
            ? 'grid grid-cols-3 content-start gap-1.5 overflow-y-auto pr-1'
            : compact
              ? 'grid grid-cols-2 min-[380px]:grid-cols-3 content-start gap-1.5 overflow-y-auto pr-1'
              : 'flex flex-col gap-2 overflow-y-auto pr-1',
        ].join(' ')}
      >
        {tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center font-mono text-xs text-white/30">
            No active bets.
          </p>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="h-[52px] shrink-0">
              <TicketCard ticket={ticket} dense={grid || compact} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}