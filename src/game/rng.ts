// ============================================================================
// CHAINS — RNG Abstraction (Section 23)
//
// Every random digit that affects outcomes or defaults goes through this
// module. Purely cosmetic simulation (heat map, fake players) may use
// Math.random. This keeps the system easy to swap for a certified/
// server-side RNG later without touching any game logic.
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
    return this.drawRaw();
  }

  /** Non-draw randomness (jackpot defaults, simulated links). Never
   * consumes the demo panel's forced-digit queue. */
  generateAuxDigit(): number {
    return this.drawRaw();
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

  private drawRaw(): number {
    return this.seed !== null ? this.nextSeededDigit() : this.secureDigit();
  }


/** Unbiased digit from the Web Crypto API (rejection sampling). */
  private secureDigit(): number {
    const buf = new Uint8Array(1);
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= 250);
    return buf[0] % 10;
  }

  private nextSeededDigit(): number {
    // LCG with exact 32-bit multiply (Math.imul), digit from HIGH bits.
    this.seed = (Math.imul(this.seed as number, 1_103_515_245) + 12_345) & 0x7fffffff;
    return Math.floor(((this.seed >>> 8) / 0x800000) * 10);
  }

  private clampDigit(digit: number): number {
    if (!Number.isInteger(digit) || digit < DIGIT_MIN || digit > DIGIT_MAX) {
      throw new Error(`Invalid digit: ${digit}. Must be an integer between ${DIGIT_MIN} and ${DIGIT_MAX}.`);
    }
    return digit;
  }
}
