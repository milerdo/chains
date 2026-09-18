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