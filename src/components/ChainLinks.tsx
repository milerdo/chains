import { DIGIT_COLORS } from '../utils/digitColors';
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

/** Whether a ticket's jackpot chain is currently worth showing — before
 * the base win, jackpot digits are irrelevant noise; from BASE_WON
 * onward (qualifying, won, or lost) they're the whole story. */
export function isJackpotRelevant(status: Ticket['status']): boolean {
  return (
    status === 'BASE_WON' ||
    status === 'JACKPOT_STEP_1' ||
    status === 'JACKPOT_STEP_2' ||
    status === 'JACKPOT_WON' ||
    status === 'JACKPOT_LOST'
  );
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
        TEXT[state],
      ].join(' ')}
    >
      {digit}
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
}

export function LinkChain({ ticket, size = 'md', showJackpot = true }: LinkChainProps) {
  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto">
      <span className="flex shrink-0 items-center">
        {ticket.baseSequence.map((digit, i) => (
          <span key={`b-${i}`} className="flex items-center">
            {i > 0 && <Link size={size} />}
            <ChainCircle digit={digit} state={baseCircleState(ticket, i)} size={size} />
          </span>
        ))}
      </span>
      {showJackpot && (
        <span className="flex shrink-0 items-center">
          <Link size={size} />
+          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#eab308]/50 bg-transparent px-1.5 py-0.5">            {/* was: border-[#eab308]/40 bg-[#eab308]/15 — filled amber
              competed visually with the chain circles; outline-only reads
              as a frame around the jackpot progress instead. */}
            {ticket.jackpotSequence.map((digit, i) => (
              <span key={`j-${i}`} className="flex items-center">
                {i > 0 && <Link size={size} />}
                <ChainCircle digit={digit} state={jackpotCircleState(ticket, i)} size={size} />
              </span>
            ))}
            {size !== 'xs' && (
              <span className="ml-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#eab308]">
                {JACKPOT_TIER_DISPLAY[ticket.jackpotTier]}
              </span>
            )}
          </span>
        </span>
      )}
    </div>
  );
}