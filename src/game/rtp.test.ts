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
    expect(jackpotHitProbability('HIGH')).toBeCloseTo(1e-5, 12);
  });
});