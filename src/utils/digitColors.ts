// ============================================================================
// CHAINS — Shared Digit Color Map
// Single source of truth for digit -> color, used by the Wheel wedges AND
// the betting digit pad/slots so they always agree. Change a color here and
// every consumer updates together.
// ============================================================================
export const DIGIT_COLORS: readonly string[] = [
  '#1e6b3e', '#8a1f1f', '#1f3f82', '#8a1f1f', '#1e6b3e',
  '#1f3f82', '#8a1f1f', '#1e6b3e', '#1f3f82', '#8a1f1f',
];