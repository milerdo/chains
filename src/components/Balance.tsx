// ============================================================================
// CHAINS — Balance
// Small standalone wallet display. Flashes green/red briefly when the
// balance moves, so a bet, a base win, or a jackpot hit are all felt as
// well as seen.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../utils/format';

interface BalanceProps {
  balance: number;
}

type FlashState = 'up' | 'down' | null;

export function Balance({ balance }: BalanceProps) {
  const previousRef = useRef(balance);
  const [flash, setFlash] = useState<FlashState>(null);

  useEffect(() => {
    if (balance === previousRef.current) return;
    setFlash(balance > previousRef.current ? 'up' : 'down');
    previousRef.current = balance;
    const timeout = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(timeout);
  }, [balance]);

  return (
    <div
      className={[
        'flex flex-col items-end rounded-xl border px-3 py-1.5 transition-colors duration-500',
        flash === 'up'
          ? 'border-emerald-400/40 bg-emerald-400/[0.07]'
          : flash === 'down'
            ? 'border-red-400/40 bg-red-400/[0.07]'
            : 'border-white/10 bg-white/[0.03]',
      ].join(' ')}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Balance</span>
      <span
        className={[
          'font-mono text-base font-semibold tabular-nums transition-colors duration-500 sm:text-lg',
          flash === 'up' ? 'text-emerald-300' : flash === 'down' ? 'text-red-300' : 'text-white',
        ].join(' ')}
      >
        {formatCurrency(balance)}
      </span>
    </div>
  );
}
