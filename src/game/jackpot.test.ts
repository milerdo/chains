import { describe, it, expect } from 'vitest';
import { JackpotManager } from './jackpot';
import { INITIAL_JACKPOT_POOLS, JACKPOT_CONTRIBUTION_RATES } from './constants';

describe('JackpotManager', () => {
  it('starts unseeded', () => {
    expect(INITIAL_JACKPOT_POOLS).toEqual({ MINI: 0, MIDI: 0, GRAND: 0 });
  });

  it('contributes the configured rate per $1, only to its own pool', () => {
    const jm = new JackpotManager();
    jm.contribute('HIGH', 6);
    expect(jm.getPool('GRAND')).toBeCloseTo(JACKPOT_CONTRIBUTION_RATES.HIGH * 6, 6);
    expect(jm.getPool('MINI')).toBe(0);
    expect(jm.getPool('MIDI')).toBe(0);
  });

  it('pays the full pool to one winner and resets to seed', () => {
    const jm = new JackpotManager();
    for (let i = 0; i < 100; i += 1) jm.contribute('LOW', 1);
    const res = jm.payout('MINI', ['T1'], 10);
    expect(res.perWinnerAmount).toBeCloseTo(6, 2);
    expect(jm.getPool('MINI')).toBe(0);
    expect(jm.getWinHistory()).toHaveLength(1);
  });

  it('splits equally between simultaneous winners', () => {
    const jm = new JackpotManager();
    jm.forceSetPool('GRAND', 100);
    const res = jm.payout('GRAND', ['A', 'B'], 1);
    expect(res.perWinnerAmount).toBe(50);
    expect(res.totalPaid).toBe(100);
  });

  it('does nothing with zero winners', () => {
    const jm = new JackpotManager();
    jm.contribute('LOW', 10);
    const before = jm.getPool('MINI');
    expect(jm.payout('MINI', [], 1).totalPaid).toBe(0);
    expect(jm.getPool('MINI')).toBe(before);
  });

  it('conserves money: paid + remaining == contributed (no house-funded EV)', () => {
    const jm = new JackpotManager();
    let contributed = 0;
    let paid = 0;
    for (let i = 1; i <= 500; i += 1) {
      contributed += jm.contribute('MEDIUM', 1);
      if (i % 37 === 0) paid += jm.payout('MIDI', ['T'], i).totalPaid;
    }
    expect(paid + jm.getPool('MIDI')).toBeCloseTo(contributed, 2);
  });
});