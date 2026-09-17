// ============================================================================
// CHAINS — Combo/Link Expansion (Section 5b, 7)
// Pure functions only. Expands a set of chosen digits into every unique
// ordering ("possibility"), each an independent $1 underlying bet.
// Repeated digits do not create duplicate possibilities (e.g. 112 -> 3,
// not 6). Decoupled from BetSelection/engine on purpose — Phase 2 decides
// how a combo request is represented and wires this in.
// ============================================================================

import type { TicketTier } from './types';
import { calculateTotalStake } from './payouts';
import { validateBaseDigits } from './ticket';

/**
 * Expands `digits` into every unique permutation (a "possibility" per
 * Section 5b). Uses a sorted backtracking approach so identical digits are
 * skipped at each recursion level — this is what makes repeated-digit
 * inputs (e.g. [1,1,2]) correctly dedup to 3 results instead of 6, without
 * a post-hoc Set/stringify pass.
 */
export function expandComboPossibilities(digits: number[]): number[][] {
  const results: number[][] = [];
  const sorted = [...digits].sort((a, b) => a - b);
  const used = new Array(sorted.length).fill(false);
  const current: number[] = [];

  function backtrack() {
    if (current.length === sorted.length) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < sorted.length; i += 1) {
      if (used[i]) continue;
      // Skip duplicate digits at this recursion depth: if the identical
      // digit before this one hasn't been used yet, using this one first
      // would just re-produce a permutation we'll generate anyway.
      if (i > 0 && sorted[i] === sorted[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      current.push(sorted[i]);
      backtrack();
      current.pop();
      used[i] = false;
    }
  }

  backtrack();
  return results;
}

/** Same validation a straight ticket's digits require (length + digit
 * range for the tier) — a combo's digit SET must satisfy this before it's
 * expanded, since every possibility is that same tier's sequence length. */
export function validateComboDigits(tier: TicketTier, digits: number[]): void {
  validateBaseDigits(tier, digits);
}

/** Number of unique possibilities a combo digit set expands to, without
 * materializing every permutation (useful for live stake preview UI in
 * Phase 2 without recomputing the full expansion on every keystroke). */
export function countComboPossibilities(digits: number[]): number {
  const counts = new Map<number, number>();
  for (const d of digits) counts.set(d, (counts.get(d) ?? 0) + 1);

  const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
  const numerator = factorial(digits.length);
  let denominator = 1;
  for (const count of counts.values()) denominator *= factorial(count);
  return numerator / denominator;
}

/** Total stake for a combo bet: one $1 (or configured stake) possibility
 * per unique ordering (Section 7). Delegates to the existing generic
 * calculateTotalStake rather than duplicating its rounding logic. */
export function calculateComboStake(digits: number[], stakePerPossibility?: number): number {
  return calculateTotalStake(countComboPossibilities(digits), stakePerPossibility);
}