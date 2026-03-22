'use client';

import { useState } from 'react';
import type { TxState } from '@/types';
import { TxStatusBanner } from './TxStatusBanner';
import { settleExpense } from '@/lib/contract';
import { CheckCircle2, Loader2, CreditCard } from 'lucide-react';

interface SettleButtonProps {
  expenseId: number;
  settler: string;
  settled: boolean;
  onSuccess: () => void;
}

const IDLE_TX: TxState = { status: 'idle', txHash: null, error: null };

/**
 * Button to settle a participant's share of an expense.
 * Shows the full transaction lifecycle via TxStatusBanner.
 */
export function SettleButton({
  expenseId,
  settler,
  settled,
  onSuccess,
}: SettleButtonProps) {
  const [txState, setTxState] = useState<TxState>(IDLE_TX);

  const inFlight =
    txState.status !== 'idle' &&
    txState.status !== 'success' &&
    txState.status !== 'failed';

  async function handleSettle() {
    setTxState(IDLE_TX);
    try {
      const hash = await settleExpense(expenseId, settler, (s) =>
        setTxState((prev) => ({ ...prev, status: s }))
      );
      setTxState({ status: 'success', txHash: hash, error: null });
      onSuccess();
    } catch (e) {
      setTxState({
        status: 'failed',
        txHash: null,
        error: e instanceof Error ? e.message : 'Settlement failed',
      });
    }
  }

  if (settled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-400">
        <CheckCircle2 size={18} />
        <span className="font-medium">You have settled your share</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleSettle}
        disabled={inFlight}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {inFlight ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CreditCard size={16} />
        )}
        {inFlight ? 'Processing...' : 'Settle My Share'}
      </button>

      <TxStatusBanner
        txState={txState}
        onDismiss={() => setTxState(IDLE_TX)}
      />
    </div>
  );
}
