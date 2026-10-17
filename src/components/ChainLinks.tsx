import { DIGIT_COLORS } from '../utils/digitColors';
import type { Ticket } from '../game/types';
import { isJackpotRelevant } from '../game/ticket';

type CircleState = 'pending' | 'matched' | 'failed' | 'current';

function baseCircleState(ticket: Ticket, index: number): CircleState {
  if (index < ticket.baseProgress) return 'matched';
  if (ticket.status === 'LOST' && index === ticket.baseProgress) return 'failed';
  if ((ticket.status === 'WAITING' || ticket.status === 'ACTIVE') && index === ticket.baseProgress) return 'current';
  return 'pending';
}

/** Per-circle states for the 3 jackpot numbers (any-order, multiset match). */
function jackpotCircleStates(ticket: Ticket): CircleState[] {
  const pool = [...ticket.jackpotMatched];
  const states = ticket.jackpotSequence.map<CircleState>((digit) => {
    const i = pool.indexOf(digit);
    if (i === -1) return 'pending';
    pool.splice(i, 1);
    return 'matched';
  });
  if (ticket.status === 'JACKPOT_LOST') {
    const first = states.indexOf('pending');
    if (first !== -1) states[first] = 'failed';
    return states;
  }
  const qualifying = ticket.status === 'BASE_WON' || ticket.status === 'JACKPOT_STEP_1' || ticket.status === 'JACKPOT_STEP_2';
  return qualifying ? states.map<CircleState>((s) => (s === 'pending' ? 'current' : s)) : states;
}

const JACKPOT_TIER_DISPLAY: Record<string, string> = { MINI: 'LOW', MIDI: 'MIDI', GRAND: 'HIGH' };

/** Background stays tinted to the digit's own wheel color at every state
 * (that's the "match the wheel" identity); border/ring carries the
 * match-progress signal (pending/current/matched/failed) on top of it. */
function circleColors(digit: number, state: CircleState): { bg: string; border: string } {
  const c = DIGIT_COLORS[digit];
  switch (state) {
    case 'matched':
      return { bg: `${c}80`, border: '#34d399' };
    case 'failed':
      return { bg: `${c}40`, border: '#f87171' };
    case 'current':
      return { bg: `${c}80`, border: '#eab308' };
    default:
      return { bg: `${c}33`, border: `${c}66` };
  }
}

const TEXT: Record<CircleState, string> = {
  matched: 'text-white',
  failed: 'text-red-100',
  current: 'text-white',
  pending: 'text-white/55',
};

interface CircleProps {
  digit: number;
  state: CircleState;
  size?: 'xs' | 'sm' | 'md';
}

export function ChainCircle({ digit, state, size = 'md' }: CircleProps) {
  const dims = size === 'xs' ? 'h-6 w-6 text-[11px]' : size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-sm';
  const { bg, border } = circleColors(digit, state);
  return (
    <span
      style={{ backgroundColor: bg, borderColor: border }}
      className={[
        'relative flex shrink-0 items-center justify-center rounded-full border font-mono font-bold tabular-nums transition-colors',
        dims,
        state === 'current' ? 'border-[3px] shadow-[0_0_0_3px_rgba(234,179,8,0.18)] animate-pulse' : '',
        state === 'matched' ? 'border-[3px]' : '',
        TEXT[state],
      ].join(' ')}
    >
      {digit}
      {state === 'matched' && (
        <span className={[
          'absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-emerald-400 font-black leading-none text-black',
        size === 'xs' ? 'h-3 w-3 text-[8px]' : 'h-3.5 w-3.5 text-[11px]',
      ].join(' ')}>✓</span>
    )}
      {state === 'failed' && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-sm font-black text-red-400">
          ✕
        </span>
      )}
    </span>
  );
}

function Link({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  const width = size === 'xs' ? 'w-2' : size === 'sm' ? 'w-2' : 'w-3';
  return <span className={`h-[2px] shrink-0 ${width} bg-white/15`} />;
}

interface LinkChainProps {
  ticket: Ticket;
  size?: 'xs' | 'sm' | 'md';
  showJackpot?: boolean;
  labelled?: boolean;
}

export function LinkChain({ ticket, size = 'md', showJackpot = true, labelled = false }: LinkChainProps) {
  if (showJackpot && isJackpotRelevant(ticket.status)) {
    return <JackpotChain ticket={ticket} size={size} labelled={labelled} />;
  }
  return (
    <div className="flex flex-nowrap items-center">
      <BaseChain ticket={ticket} size={size} />
    </div>
  );
}

/** Bonus jackpot bet: only shown once the base sequence is won. No arrows to
 * a pill; the whole card is gold-tinted (see Ticket.tsx). */
function JackpotChain({ ticket, size, labelled = false }: { ticket: Ticket; size: 'xs' | 'sm' | 'md'; labelled?: boolean }) {
  const states = jackpotCircleStates(ticket);
  const tier = JACKPOT_TIER_DISPLAY[ticket.jackpotTier];
  const circles = (
    <span className="flex shrink-0 items-center">
      {ticket.jackpotSequence.map((digit, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <Link size={size} />}
          <ChainCircle digit={digit} state={states[i]} size={size} />
        </span>
      ))}
    </span>
  );
  if (size === 'xs' && labelled) {
    return (
      <div className="flex flex-col items-center">
        <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.05em] text-[#eab308]">
          Jackpot {tier}
        </span>
        {circles}
      </div>
    );
  }
  return (
    <div className="flex flex-nowrap items-center gap-2">
      {circles}
      {size !== 'xs' && (
        <span className="flex shrink-0 flex-col font-mono font-bold uppercase leading-none text-[#eab308]">
          <span className="text-[8px] tracking-[0.2em] opacity-70">Jackpot</span>
          <span className="mt-0.5 text-[11px] tracking-[0.1em]">{tier}</span>
        </span>
      )}
    </div>
  );
}

/** Links share one jackpot pill when their jackpot state is identical.
 * Links not yet in qualification all fall into one pill-less 'base' group. */
function jackpotGroupKey(t: Ticket): string {
  return isJackpotRelevant(t.status)
    ? `${t.jackpotTier}|${t.jackpotSequence.join(',')}|${[...t.jackpotMatched].sort().join(',')}|${t.status}`
    : 'base';
}

function BaseChain({ ticket, size }: { ticket: Ticket; size: 'xs' | 'sm' | 'md' }) {
  return (
    <span className="flex shrink-0 items-center">
      {ticket.baseSequence.map((digit, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <Link size={size} />}
          <ChainCircle digit={digit} state={baseCircleState(ticket, i)} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Always-rendered, fixed-height (h-10) single-row summary of active links,
 * shown above the betting panel on mobile. Fixed height + no wrap means it
 * never moves the layout when links appear/resolve. The leading count stays
 * accurate if the row clips; full cards live in TicketDrawer once locked. */
export function LinkStrip({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) return null;
  const groups = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const key = jackpotGroupKey(t);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  return (
    <div
      aria-label="Active links"
      className="flex h-10 shrink-0 items-center gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5"
    >
      <>
          <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-white/40">{tickets.length}</span>
          {[...groups.entries()].map(([key, group]) => (
            <span key={key} className="flex shrink-0 items-center gap-1.5">
              {key === 'base' ? (
                group.map((t) => <BaseChain key={t.id} ticket={t} size="xs" />)
              ) : (
                <>
                  <span className="flex shrink-0 items-center rounded-md border border-[#eab308]/60 bg-[#eab308]/[0.14] px-1.5 py-0.5">
                    <JackpotChain ticket={group[0]} size="xs" />
                  </span>
                  {group.length > 1 && (
                    <span className="font-mono text-[11px] font-bold text-[#eab308]">×{group.length}</span>
                  )}
                </>
              )}
            </span>
          ))}
        </>
    </div>
  );
}