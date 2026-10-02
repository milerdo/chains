import { DEMO_JACKPOT_PRESET } from './constants';
import type { ChainsGame } from './engine';

/** Demo-only. Sets absolute pool values via the existing forceSetPool path. */
export function applyDemoJackpotPreset(game: ChainsGame): void {
  (Object.keys(DEMO_JACKPOT_PRESET) as Array<keyof typeof DEMO_JACKPOT_PRESET>).forEach(
    (tier) => game.forceJackpotPool(tier, DEMO_JACKPOT_PRESET[tier]),
  );
}