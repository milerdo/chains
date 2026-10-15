import { describe, it, expect } from 'vitest';
import { activateDueTickets, countActiveWithSameSequence, createTicket, evaluateTicketOnDraw, expectedDigits } from './ticket';
import type { JackpotSequence, Ticket, TicketTier } from './types';


const mk = (tier: TicketTier, digits: number[], jp: JackpotSequence = [7, 4, 1]) =>
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

  it('HIGH progresses per digit and pays 900 on completion', () => {
    const mid = run(mk('HIGH', [4, 2, 3]), [4, 2]);
    expect(mid.status).toBe('ACTIVE');
    expect(mid.baseProgress).toBe(2);
    const won = run(mid, [3]);
    expect(won.status).toBe('BASE_WON');
    expect(won.baseWinAmount).toBe(900);
  });

  it('MEDIUM pays 90', () => {
    expect(run(mk('MEDIUM', [3, 1]), [3, 1]).baseWinAmount).toBe(90);
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

describe('jackpot qualification (3 numbers, any order, 3 draws)', () => {
  const base = () => run(mk('HIGH', [4, 2, 3]), [4, 2, 3]);

  it('wins on any ordering of the set', () => {
    for (const order of [[7, 4, 1], [1, 7, 4], [4, 1, 7], [7, 1, 4]]) {
      expect(run(base(), order).status).toBe('JACKPOT_WON');
    }
  });

  it('tracks progress per matched digit', () => {
    const one = run(base(), [4]);
    expect(one.status).toBe('JACKPOT_STEP_1');
    expect(one.jackpotMatched).toEqual([4]);
    const two = run(one, [1]);
    expect(two.status).toBe('JACKPOT_STEP_2');
    expect(two.jackpotProgress).toBe(2);
  });

  it('keeps the base payout when a draw is not in the set', () => {
    for (const draws of [[1, 1], [7, 9], [7, 4, 2], [9]]) {
      const t = run(base(), draws);
      expect(t.status).toBe('JACKPOT_LOST');
      expect(t.baseWinAmount).toBe(900);
      expect(t.totalReturn).toBe(900);
    }
  });

  it('repeating an already-matched digit ends the attempt', () => {
    expect(run(base(), [7, 7]).status).toBe('JACKPOT_LOST');
  });

  it('repeated jackpot digits are a multiset (1,1,2 any order; 111 needs 1,1,1)', () => {
    const lowWon = (jp: JackpotSequence) => run(mk('LOW', [1], jp), [1]);
    for (const order of [[1, 1, 2], [1, 2, 1], [2, 1, 1]]) {
      expect(run(lowWon([1, 1, 2]), order).status).toBe('JACKPOT_WON');
    }
    expect(run(lowWon([1, 1, 2]), [1, 1, 1]).status).toBe('JACKPOT_LOST');
    expect(run(lowWon([1, 1, 1]), [1, 1, 1]).status).toBe('JACKPOT_WON');
    expect(run(lowWon([1, 1, 1]), [1, 1, 2]).status).toBe('JACKPOT_LOST');
  });

  it('enumeration: of 1000 draw triples, 6 win for distinct digits, 3 for 112, 1 for 111', () => {
    const count = (jp: JackpotSequence) => {
      let wins = 0;
      for (let a = 0; a < 10; a += 1)
        for (let b = 0; b < 10; b += 1)
          for (let c = 0; c < 10; c += 1)
            if (run(run(mk('LOW', [5], jp), [5]), [a, b, c]).status === 'JACKPOT_WON') wins += 1;
      return wins;
    };
    expect(count([7, 4, 1])).toBe(6);
    expect(count([1, 1, 2])).toBe(3);
    expect(count([1, 1, 1])).toBe(1);
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
    expect(() => createTicket({ tier: 'LOW', digits: [1], jackpotSequence: [1, 2] as unknown as JackpotSequence, startDrawIndex: 1, createdAtDrawIndex: 0 })).toThrow();
  });
});

describe('expectedDigits', () => {
  it('tracks base, then remaining jackpot digits (distinct), then empty', () => {
    const t = mk('HIGH', [6, 5, 9], [7, 4, 4]);
    expect(expectedDigits(t)).toEqual([6]);
    const mid = run(t, [6]);
    expect(expectedDigits(mid)).toEqual([5]);
    const won = run(mid, [5, 9]);
    expect(expectedDigits(won)).toEqual([7, 4]);
    expect(expectedDigits(run(won, [4]))).toEqual([7, 4]);
    expect(expectedDigits(run(won, [4, 4]))).toEqual([7]);
    expect(expectedDigits(run(won, [1]))).toEqual([]);
    expect(expectedDigits(run(t, [1]))).toEqual([]);
  });
});