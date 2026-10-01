import { describe, it, expect } from 'vitest';
import { activateDueTickets, countActiveWithSameSequence, createTicket, evaluateTicketOnDraw } from './ticket';
import type { Ticket, TicketTier } from './types';

const mk = (tier: TicketTier, digits: number[], jp: [number, number] = [7, 4]) =>
  createTicket({ tier, digits, jackpotSequence: jp, startDrawIndex: 1, createdAtDrawIndex: 0 });

function run(t: Ticket, digits: number[]): Ticket {
  let cur = t;
  let idx = t.nextDrawIndex;
  for (const digit of digits) cur = evaluateTicketOnDraw(cur, { drawIndex: idx++, digit });
  return cur;
}

describe('base game', () => {
  it('LOW wins 9x on a single match', () => {
    const t = run(mk('LOW', [5]), [5]);
    expect(t.status).toBe('BASE_WON');
    expect(t.baseWinAmount).toBe(9);
    expect(t.totalReturn).toBe(9);
  });

  it('HIGH progresses per digit and pays 888 on completion', () => {
    const mid = run(mk('HIGH', [4, 2, 3]), [4, 2]);
    expect(mid.status).toBe('ACTIVE');
    expect(mid.baseProgress).toBe(2);
    const won = run(mid, [3]);
    expect(won.status).toBe('BASE_WON');
    expect(won.baseWinAmount).toBe(888);
  });

  it('MEDIUM pays 88', () => {
    expect(run(mk('MEDIUM', [3, 1]), [3, 1]).baseWinAmount).toBe(88);
  });

  it('loses immediately on mismatch and ignores later draws', () => {
    const t = run(mk('HIGH', [4, 2, 3]), [5, 2, 3]);
    expect(t.status).toBe('LOST');
    expect(t.resolvedBaseAtDrawIndex).toBe(1);
    expect(t.totalReturn).toBe(0);
  });

  it('supports repeated digits (777)', () => {
    expect(run(mk('HIGH', [7, 7, 7]), [7, 7, 7]).status).toBe('BASE_WON');
  });
});

describe('jackpot qualification', () => {
  const base = () => run(mk('HIGH', [4, 2, 3]), [4, 2, 3]);

  it('wins when both jackpot digits match in order', () => {
    const t = run(base(), [7, 4]);
    expect(t.status).toBe('JACKPOT_WON');
    expect(t.jackpotProgress).toBe(2);
  });

  it('keeps the base payout when the second digit misses', () => {
    const t = run(base(), [7, 2]);
    expect(t.status).toBe('JACKPOT_LOST');
    expect(t.baseWinAmount).toBe(888);
    expect(t.totalReturn).toBe(888);
  });

  it('keeps the base payout when the first digit misses', () => {
    const t = run(base(), [1]);
    expect(t.status).toBe('JACKPOT_LOST');
    expect(t.jackpotProgress).toBe(0);
    expect(t.totalReturn).toBe(888);
  });

  it('supports a repeated-digit jackpot pair (7 -> 7)', () => {
    const t = run(run(mk('LOW', [1], [7, 7]), [1]), [7, 7]);
    expect(t.status).toBe('JACKPOT_WON');
  });

  it('order matters (4 -> 7 does not match 7 -> 4)', () => {
    expect(run(base(), [4, 7]).status).toBe('JACKPOT_LOST');
  });
});

describe('timeline rules', () => {
  it('ignores draws that are not the ticket\'s next index', () => {
    const t = mk('LOW', [5]);
    expect(evaluateTicketOnDraw(t, { drawIndex: 5, digit: 5 })).toBe(t);
  });

  it('never changes a terminal ticket', () => {
    const lost = run(mk('LOW', [5]), [1]);
    expect(evaluateTicketOnDraw(lost, { drawIndex: 2, digit: 5 })).toBe(lost);
  });

  it('activates WAITING tickets only once their start draw is reached', () => {
    const t = mk('LOW', [5]);
    expect(activateDueTickets([t], 0)[0].status).toBe('WAITING');
    expect(activateDueTickets([t], 1)[0].status).toBe('ACTIVE');
  });

  it('counts only non-terminal tickets with the same tier and sequence', () => {
    const live = mk('LOW', [5]);
    const dead = run(mk('LOW', [5]), [1]);
    const other = mk('LOW', [6]);
    expect(countActiveWithSameSequence([live, dead, other], 'LOW', [5])).toBe(1);
  });
});

describe('validation', () => {
  it('rejects wrong digit count and bad jackpot pair', () => {
    expect(() => mk('LOW', [1, 2])).toThrow();
    expect(() => createTicket({ tier: 'LOW', digits: [1], jackpotSequence: [1] as unknown as [number, number], startDrawIndex: 1, createdAtDrawIndex: 0 })).toThrow();
  });
});