// ============================================================================
// CHAINS — BetHistoryModal
// Wraps the existing GameHistory component (defaulted to its "YOURS" tab)
// in a dialog matching HelpModal's structure/pattern, plus a session net
// total computed client-side from resolved tickets. Pure derived display
// math — intentionally NOT an engine field (CLAUDE.md §3/§6: no new
// ChainsGame state for this).
// ============================================================================

import { useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { GameHistory } from './GameHistory';
import { formatSignedCurrency } from '../utils/format';

interface BetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetHistoryModal({ isOpen, onClose }: BetHistoryModalProps) {
  const { history } = useGame();

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Net = sum of (totalReturn - stake) across every resolved ticket this
  // session. totalReturn already folds in both base + jackpot payouts
  // (see ticket.ts / engine.ts); stake is what was debited on placement.
  const netTotal = history.reduce((sum, t) => sum + (t.totalReturn - t.stake), 0);
  const netTone = netTotal > 0 ? 'text-emerald-300' : netTotal < 0 ? 'text-red-300' : 'text-white/70';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bet history"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] p-6 shadow-2xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-bold tracking-[0.1em] text-white">BET HISTORY</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">Session Net</span>
          <span className={`font-mono text-xl font-bold tabular-nums ${netTone}`}>
            {formatSignedCurrency(netTotal)}
          </span>
        </div>

        <div className="mt-5">
          <GameHistory defaultTab="YOURS" />
        </div>
      </div>
    </div>
  );
}