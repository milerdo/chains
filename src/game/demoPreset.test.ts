import { describe, it, expect } from 'vitest';
import { ChainsGame } from './engine';
import { INITIAL_JACKPOT_POOLS, DEMO_JACKPOT_PRESET } from './constants';
import { applyDemoJackpotPreset } from './demoPreset';

describe('demo jackpot preset', () => {
  it('engine defaults stay unseeded', () => {
    expect(Object.values(INITIAL_JACKPOT_POOLS).every((v) => v === 0)).toBe(true);
    const g = new ChainsGame();
    expect(g.getState().jackpotPools).toEqual(INITIAL_JACKPOT_POOLS);
  });

  it('applies only when called, and reset returns to unseeded', () => {
    const g = new ChainsGame();
    applyDemoJackpotPreset(g);
    expect(g.getState().jackpotPools).toMatchObject(DEMO_JACKPOT_PRESET);
    g.reset();
    expect(g.getState().jackpotPools).toEqual(INITIAL_JACKPOT_POOLS);
  });
});