// ============================================================================
// CHAINS — ChainLinks
// Shared "chain of circles" visual: base sequence + jackpot sequence as one
// continuous connected chain. Circles turn green as each digit matches;
// gold + pulsing on the current step; red on failure. Jackpot combination
// is always shown (grayed until qualification starts), not just on win.
// Used by TicketCard (full size) and MobileFooter (compact strip).
// ============================================================================

import type { Ticket } from '../game/types';

type CircleState = 'pending' | 'matched' | 'failed' | 'current';

function baseCircleState(ticket: Ticket, index: number): CircleState {
  if (index < ticket.baseProgress) return 'matched';
  if (ticket.status === 'LOST' && index === ticket.baseProgress) return 'failed';
  if ((ticket.status === 'WAITING' || ticket.status === 'ACTIVE') && index === ticket.baseProgress) return 'current';
  return 'pending';
}

function jackpotCircleState(ticket: Ticket, index: number): CircleState {
  if (index < ticket.jackpotProgress) return 'matched';
  if (ticket.status === 'JACKPOT_LOST' && index === ticket.jackpotProgress) return 'failed';
  const isQualifying = ticket.status === 'BASE_WON' || ticket.status === 'JACKPOT_STEP_1' || ticket.status === 'JACKPOT_STEP_2';
  if (isQualifying && index === ticket.jackpotProgress) return 'current';
  return 'pending';
}

const STYLES: Record<CircleState, string> = {
  matched: 'border-emerald-400 bg-emerald-400/20 text-emerald-300',
  failed: 'border-red-400 bg-red-400/15 text-red-300',
  current: 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.18)] animate-pulse',
  pending: 'border-white/15 bg-white/[0.03] text-white/40',
};

interface CircleProps {
  digit: number;
  state: CircleState;
  size?: 'xs' | 'sm' | 'md';
}

export function ChainCircle({ digit, state, size = 'md' }: CircleProps) {
  const dims = size === 'xs' ? 'h-5 w-5 text-[10px]' : size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <span
      className={[
        'flex shrink-0 items-center justify-center rounded-full border font-mono font-bold tabular-nums transition-colors',
        dims,
        STYLES[state],
      ].join(' ')}
    >
      {digit}
    </span>
  );
}

function Link({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  const width = size === 'xs' ? 'w-1.5' : size === 'sm' ? 'w-2' : 'w-3';
  return <span className={`h-[2px] shrink-0 ${width} bg-white/15`} />;
}

interface LinkChainProps {
  ticket: Ticket;
  size?: 'xs' | 'sm' | 'md';
  /** Omit jackpot digits entirely for very tight spaces. Default true. */
  showJackpot?: boolean;
}

export function LinkChain({ ticket, size = 'md', showJackpot = true }: LinkChainProps) {
  return (
    <div className="flex items-center">
      {ticket.baseSequence.map((digit, i) => (
        <span key={`b-${i}`} className="flex items-center">
          {i > 0 && <Link size={size} />}
          <ChainCircle digit={digit} state={baseCircleState(ticket, i)} size={size} />
        </span>
      ))}
      {showJackpot && (
        <>
          <Link size={size} />
          {size !== 'xs' && (
            <span className="mx-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">JP</span>
          )}
          <Link size={size} />
          {ticket.jackpotSequence.map((digit, i) => (
            <span key={`j-${i}`} className="flex items-center">
              {i > 0 && <Link size={size} />}
              <ChainCircle digit={digit} state={jackpotCircleState(ticket, i)} size={size} />
            </span>
          ))}
        </>
      )}
    </div>
  );
}