// ============================================================================
// CHAINS — Display Formatting Helpers
// Pure presentation functions only. No game math lives here — see
// src/game/payouts.ts for anything that touches actual credited amounts.
// ============================================================================

/** "$9.00" / "-$1.00" — always shows the sign explicitly for negatives. */
export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/** "+$888.00" — explicitly signed, used for history/ticket win amounts. */
export function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/** "$10,000.00" — thousands-separated, for the large jackpot pools. */
export function formatCompactCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDrawIndex(index: number): string {
  return `#${index}`;
}

export function formatSequence(digits: readonly number[]): string {
  return digits.join(' → ');
}

/** Seconds remaining as a one-decimal string ("10.0", "9.9", "0.0"). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, ms / 1000);
  return totalSeconds.toFixed(1);
}

export function formatPercent(fraction: number, decimals = 2): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}
