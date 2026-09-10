// ============================================================================
// CHAINS — RNG Abstraction (Section 23)
//
// Every random digit in the game MUST go through this module. No component
// or engine code should call Math.random() directly anywhere else. This
// keeps the system easy to swap for a certified/server-side RNG later
// without touching any game logic.
//
// DISCLAIMER: This is a demonstration-grade PRNG. It is NOT certified for
// real-money gambling use.
// ============================================================================

import { DIGIT_MAX, DIGIT_MIN } from './constants';

export class RNG {
  /** Digits queued by the developer/demo panel (Section 27) that must be
   * consumed, in order, before falling back to normal random generation. */
  private forcedQueue: number[] = [];

  /** Optional deterministic seed. When set, digits are generated from a
   * simple linear congruential generator instead of Math.random(), which
   * makes automated tests fully reproducible. */
  private seed: number | null;

  constructor(seed?: number) {
    this.seed = seed ?? null;
  }

  /**
   * Returns the next digit (0-9) in the stream. Forced digits (from the
   * demo panel) always take priority, then a seeded deterministic sequence
   * if a seed was provided, then Math.random() as the default source.
   */
  generateDigit(): number {
    if (this.forcedQueue.length > 0) {
      const forced = this.forcedQueue.shift();
      // forced is guaranteed defined by the length check above
      return this.clampDigit(forced as number);
    }
    if (this.seed !== null) {
      return this.nextSeededDigit();
    }
    return Math.floor(Math.random() * 10);
  }

  /** Queues a single digit to be returned by the next generateDigit() call
   * (developer "Force" control, Section 27). */
  forceNext(digit: number): void {
    this.forcedQueue.push(this.clampDigit(digit));
  }

  /** Queues an ordered sequence of digits, e.g. to force a jackpot
   * combination to hit for a live demo ("Force Jackpot Sequence"). */
  forceSequence(digits: number[]): void {
    for (const digit of digits) {
      this.forceNext(digit);
    }
  }

  /** Clears any queued forced digits without consuming them. */
  clearForced(): void {
    this.forcedQueue = [];
  }

  hasForced(): boolean {
    return this.forcedQueue.length > 0;
  }

  /** Read-only view of what's currently queued, for the demo panel display. */
  peekForcedQueue(): number[] {
    return [...this.forcedQueue];
  }

  /** Resets the RNG to a fresh state, optionally reseeding it. */
  reset(seed?: number): void {
    this.forcedQueue = [];
    this.seed = seed ?? null;
  }

  private nextSeededDigit(): number {
    // Deterministic LCG (Numerical Recipes parameters), masked to 31 bits.
    this.seed = ((this.seed as number) * 1_103_515_245 + 12_345) & 0x7fffffff;
    return this.seed % 10;
  }

  private clampDigit(digit: number): number {
    if (!Number.isInteger(digit) || digit < DIGIT_MIN || digit > DIGIT_MAX) {
      throw new Error(`Invalid digit: ${digit}. Must be an integer between ${DIGIT_MIN} and ${DIGIT_MAX}.`);
    }
    return digit;
  }
}
