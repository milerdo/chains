import { describe, it, expect } from 'vitest';
import { RNG } from './rng';
import { BASE_MULTIPLIERS, BASE_SEQUENCE_LENGTH } from './constants';
import { createTicket, evaluateTicketOnDraw } from './ticket';
import { baseRtp, hitProbability } from './rtp';
import type { TicketTier } from './types';

const BETS = Number(process.env.SIM_BETS ?? 2_000_000);

async function measureBaseRtp(tier: TicketTier, seed: number): Promise<number> {
  const rng = new RNG(seed);
  let returned = 0;
  for (let i = 0; i < BETS; i += 1) {
    // Yield periodically so Vitest's worker can report progress (avoids RPC timeout).
    if (i % 500_000 === 0) await new Promise((r) => setTimeout(r, 0));
    const digits = Array.from({ length: BASE_SEQUENCE_LENGTH[tier] }, () => rng.generateDigit());
    let ticket = createTicket({ tier, digits, jackpotSequence: [0, 0], startDrawIndex: 1, createdAtDrawIndex: 0 });
    let idx = 1;
    while (ticket.status === 'WAITING' || ticket.status === 'ACTIVE') {
      ticket = evaluateTicketOnDraw(ticket, { drawIndex: idx++, digit: rng.generateDigit() });
    }
    returned += ticket.baseWinAmount ?? 0;
  }
  return returned / BETS;
}

describe('Monte Carlo base RTP converges on theory (within 4 sigma)', () => {
  for (const [tier, seed] of [['LOW', 11], ['MEDIUM', 22], ['HIGH', 33]] as const) {
   it(tier, async () => {
      const p = hitProbability(tier);
      const m = BASE_MULTIPLIERS[tier];
      const sigma = Math.sqrt(p * m * m - (p * m) ** 2) / Math.sqrt(BETS);
      const measured = await measureBaseRtp(tier, seed);
      console.log(`${tier}: measured ${(measured * 100).toFixed(3)}% vs theory ${(baseRtp(tier) * 100).toFixed(3)}% (n=${BETS})`);
      expect(Math.abs(measured - baseRtp(tier))).toBeLessThan(4 * sigma);
    }, 180_000);
  }
});

//SIM_BETS=50000000 npx vitest run src/game/sim.test.ts