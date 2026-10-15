import { describe, it, expect } from 'vitest';
import { baseRtp, houseEdge, jackpotHitProbability, overallRtp, totalRtp } from './rtp';

describe('theoretical RTP', () => {
  it('base RTP', () => {
    for (const t of ['LOW', 'MEDIUM', 'HIGH'] as const) expect(baseRtp(t)).toBeCloseTo(0.9, 10);
  });
  it('total RTP = base + contribution (unseeded pools)', () => {
    for (const t of ['LOW', 'MEDIUM', 'HIGH'] as const) expect(totalRtp(t)).toBeCloseTo(0.95, 10);
  });
  it('overall / house edge / jackpot frequency', () => {
    expect(overallRtp()).toBeCloseTo(0.95, 10);
    expect(houseEdge()).toBeCloseTo(0.05, 10);
    expect(jackpotHitProbability('HIGH')).toBeCloseTo(6e-6, 12); // 3 distinct digits
    expect(jackpotHitProbability('HIGH', [1, 1, 2])).toBeCloseTo(3e-6, 12);
    expect(jackpotHitProbability('HIGH', [1, 1, 1])).toBeCloseTo(1e-6, 12);
  });
});