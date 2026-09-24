import { describe, it, expect } from 'vitest';
import {
  expandComboPossibilities,
  countComboPossibilities,
  calculateComboStake,
  validateComboDigits,
} from './combo';

describe('expandComboPossibilities', () => {
  it('expands 3 unique digits into 6 permutations (HIGH COMBO 314)', () => {
    const result = expandComboPossibilities([3, 1, 4]);
    expect(result).toHaveLength(6);
    const asStrings = result.map((p) => p.join('')).sort();
    expect(asStrings).toEqual(['134', '143', '314', '341', '413', '431']);
  });

  it('dedups repeated digits into 3 permutations (HIGH COMBO 112)', () => {
    const result = expandComboPossibilities([1, 1, 2]);
    expect(result).toHaveLength(3);
    const asStrings = result.map((p) => p.join('')).sort();
    expect(asStrings).toEqual(['112', '121', '211']);
  });

  it('expands 2 unique digits into 2 permutations (MEDIUM COMBO 31)', () => {
    const result = expandComboPossibilities([3, 1]);
    expect(result).toHaveLength(2);
  });

  it('handles a single digit as one trivial possibility', () => {
    const result = expandComboPossibilities([7]);
    expect(result).toEqual([[7]]);
  });

  it('collapses all-identical digits to a single possibility (777)', () => {
    const result = expandComboPossibilities([7, 7, 7]);
    expect(result).toEqual([[7, 7, 7]]);
  });
});

describe('countComboPossibilities', () => {
  it('matches expandComboPossibilities length for all spec examples', () => {
    expect(countComboPossibilities([3, 1, 4])).toBe(6);
    expect(countComboPossibilities([1, 1, 2])).toBe(3);
    expect(countComboPossibilities([3, 1])).toBe(2);
    expect(countComboPossibilities([7])).toBe(1);
    expect(countComboPossibilities([7, 7, 7])).toBe(1);
  });
});

describe('calculateComboStake', () => {
  it('returns $6 for HIGH COMBO 314', () => {
    expect(calculateComboStake([3, 1, 4])).toBe(6);
  });

  it('returns $3 for HIGH COMBO 112', () => {
    expect(calculateComboStake([1, 1, 2])).toBe(3);
  });

  it('returns $2 for MEDIUM COMBO 31', () => {
    expect(calculateComboStake([3, 1])).toBe(2);
  });
});

describe('validateComboDigits', () => {
  it('accepts a valid 3-digit set for HIGH', () => {
    expect(() => validateComboDigits('HIGH', [3, 1, 4])).not.toThrow();
  });

  it('rejects wrong length for the tier', () => {
    expect(() => validateComboDigits('HIGH', [3, 1])).toThrow();
  });

  it('rejects out-of-range digits', () => {
    expect(() => validateComboDigits('MEDIUM', [3, 11])).toThrow();
  });
});
