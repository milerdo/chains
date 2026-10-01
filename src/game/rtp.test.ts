import { describe, it, expect } from 'vitest';
import { baseRtp, houseEdge, jackpotHitProbability, overallRtp, totalRtp } from './rtp';

describe('theoretical RTP', () => {
  it('base RTP', () => {
    expect(baseRtp('LOW')).toBeCloseTo(0.9, 10);
    expect(baseRtp('MEDIUM')).toBeCloseTo(0.88, 10);
    expect(baseRtp('HIGH')).toBeCloseTo(0.888, 10);
  });
  it('total RTP = base + contribution (unseeded pools)', () => {
    expect(totalRtp('LOW')).toBeCloseTo(0.96, 10);
    expect(totalRtp('MEDIUM')).toBeCloseTo(0.95, 10);
    expect(totalRtp('HIGH')).toBeCloseTo(0.968, 10);
  });
  it('overall / house edge / jackpot frequency', () => {
    expect(overallRtp()).toBeCloseTo(0.95933, 4);
    expect(houseEdge()).toBeCloseTo(0.04067, 4);
    expect(jackpotHitProbability('HIGH')).toBeCloseTo(1e-5, 12);
  });
});