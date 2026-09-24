import { describe, it, expect } from 'vitest';
import { ChainsGame } from './engine';
import { JACKPOT_CONTRIBUTION_RATES, INITIAL_JACKPOT_POOLS } from './constants';

describe('ChainsGame — combo betting (engine-level)', () => {
  it('charges total stake for a HIGH COMBO (314 -> 6 possibilities -> $6)', () => {
    const game = new ChainsGame();
    const startingBalance = game.getBalance();
    const result = game.placeBet({
      selections: [{ tier: 'HIGH', digits: [3, 1, 4], isCombo: true }],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(true);
    expect(result.totalStake).toBe(6);
    expect(game.getBalance()).toBeCloseTo(startingBalance - 6, 6);
  });

  it('creates one ticket per unique permutation, deduped for repeated digits', () => {
    const game = new ChainsGame();
    const result = game.placeBet({
      selections: [{ tier: 'HIGH', digits: [1, 1, 2], isCombo: true }],
      jackpotSequence: [0, 0],
    });
    expect(result.success).toBe(true);
    expect(result.ticketIds).toHaveLength(3);
    const active = game.getActiveTickets();
    expect(active).toHaveLength(3);
    const sequences = active.map((t) => t.baseSequence.join('')).sort();
    expect(sequences).toEqual(['112', '121', '211']);
  });

  it('funds the jackpot pool once per possibility (N× contribution)', () => {
    const game = new ChainsGame();
    game.placeBet({
      selections: [{ tier: 'HIGH', digits: [3, 1, 4], isCombo: true }],
      jackpotSequence: [7, 4],
    });
    const expectedGrand = INITIAL_JACKPOT_POOLS.GRAND + JACKPOT_CONTRIBUTION_RATES.HIGH * 6;
    expect(game.getJackpotPools().GRAND).toBeCloseTo(expectedGrand, 6);
  });

  it('rejects a request with more than one tier selection (single-tier-per-round rule)', () => {
    const game = new ChainsGame();
    const result = game.placeBet({
      selections: [
        { tier: 'LOW', digits: [5] },
        { tier: 'MEDIUM', digits: [3, 1] },
      ],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(false);
    expect(result.ticketIds).toHaveLength(0);
    expect(game.getActiveTickets()).toHaveLength(0);
  });
    it('rejects a second bet with a different tier placed in the same still-open round', () => {
    const game = new ChainsGame();
    const first = game.placeBet({ selections: [{ tier: 'LOW', digits: [5] }], jackpotSequence: [7, 4] });
    expect(first.success).toBe(true);

    const second = game.placeBet({ selections: [{ tier: 'HIGH', digits: [1, 2, 3] }], jackpotSequence: [7, 4] });
    expect(second.success).toBe(false);
    expect(game.getActiveTickets().every((t) => t.tier === 'LOW')).toBe(true);
  });

  it('allows a second bet on the SAME tier in the same still-open round', () => {
    const game = new ChainsGame();
    const first = game.placeBet({ selections: [{ tier: 'LOW', digits: [5] }], jackpotSequence: [7, 4] });
    expect(first.success).toBe(true);

    const second = game.placeBet({ selections: [{ tier: 'LOW', digits: [3] }], jackpotSequence: [7, 4] });
    expect(second.success).toBe(true);
    expect(game.getActiveTickets()).toHaveLength(2);
  });
});


describe('ChainsGame — LOW multi-pick (engine-level, Option B)', () => {
  it('places 3 independent $1 LOW tickets in one atomic request', () => {
    const game = new ChainsGame();
    const result = game.placeBet({
      selections: [
        { tier: 'LOW', digits: [1] },
        { tier: 'LOW', digits: [5] },
        { tier: 'LOW', digits: [9] },
      ],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(true);
    expect(result.ticketIds).toHaveLength(3);
    expect(result.totalStake).toBe(3);
    const active = game.getActiveTickets();
    expect(active).toHaveLength(3);
    expect(active.every((t) => t.tier === 'LOW' && t.comboGroupId === null)).toBe(true);
  });

  it('funds MINI once per pick (N× contribution)', () => {
    const game = new ChainsGame();
    game.placeBet({
      selections: [{ tier: 'LOW', digits: [1] }, { tier: 'LOW', digits: [2] }, { tier: 'LOW', digits: [3] }],
      jackpotSequence: [7, 4],
    });
    const expectedMini = INITIAL_JACKPOT_POOLS.MINI + JACKPOT_CONTRIBUTION_RATES.LOW * 3;
    expect(game.getJackpotPools().MINI).toBeCloseTo(expectedMini, 6);
  });

  it('rejects the whole batch atomically on insufficient balance — no tickets created', () => {
    const game = new ChainsGame({ startingBalance: 2 });
    const result = game.placeBet({
      selections: [{ tier: 'LOW', digits: [1] }, { tier: 'LOW', digits: [2] }, { tier: 'LOW', digits: [3] }],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(false);
    expect(result.ticketIds).toHaveLength(0);
    expect(game.getActiveTickets()).toHaveLength(0);
    expect(game.getBalance()).toBe(2);
  });

  it('rejects a batch that would push a repeated digit past the concurrency cap', () => {
   const game = new ChainsGame();
    // 3 picks of the same digit in ONE request already hits the cap of 3;
    // a 4th identical pick in the same batch must fail the whole request.
    const result = game.placeBet({
      selections: [
        { tier: 'LOW', digits: [5] },
        { tier: 'LOW', digits: [5] },
       { tier: 'LOW', digits: [5] },
        { tier: 'LOW', digits: [5] },
     ],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(false);
    expect(game.getActiveTickets()).toHaveLength(0);
  });

  it('rejects combining isCombo with multiple selections in one request', () => {
    const game = new ChainsGame();
    const result = game.placeBet({
      selections: [
        { tier: 'HIGH', digits: [3, 1, 4], isCombo: true },
        { tier: 'HIGH', digits: [1, 2, 3] },
      ],
      jackpotSequence: [7, 4],
    });
    expect(result.success).toBe(false);
    expect(game.getActiveTickets()).toHaveLength(0);
  });
});