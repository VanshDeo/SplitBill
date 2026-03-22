'use client';

import { useEffect } from 'react';
import type { TxState } from '@/types';
import {
  Settings,
  PenLine,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

interface TxStatusBannerProps {
  txState: TxState;
  onDismiss?: () => void;
}

const STAGE_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; colorClass: string }
> = {
  building: {
    icon: <Settings size={16} className="animate-spin" />,
    label: 'Building transaction...',
    colorClass: 'border-slate-700 bg-slate-800/80 text-slate-300',
  },
  awaiting_signature: {
    icon: <PenLine size={16} />,
    label: 'Sign in Freighter...',
    colorClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  },
  submitting: {
    icon: <Upload size={16} />,
    label: 'Submitting to Stellar...',
    colorClass: 'border-slate-700 bg-slate-800/80 text-slate-300',
  },
  polling: {
    icon: <RefreshCw size={16} className="animate-spin" />,
    label: 'Confirming on-chain...',
    colorClass: 'border-slate-700 bg-slate-800/80 text-slate-300',
  },
  success: {
    icon: <CheckCircle2 size={16} />,
    label: 'Confirmed!',
    colorClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  failed: {
    icon: <XCircle size={16} />,
    label: 'Failed',
    colorClass: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
};

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

/**
 * Animated banner that shows the current transaction lifecycle stage.
 * Auto-dismisses 5 seconds after a successful transaction.
 */
export function TxStatusBanner({ txState, onDismiss }: TxStatusBannerProps) {
  const { status, txHash, error } = txState;

  // Auto-dismiss on success after 5 seconds
  useEffect(() => {
    if (status === 'success' && onDismiss) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  if (status === 'idle') return null;

  const config = STAGE_CONFIG[status];
  if (!config) return null;

  const expertUrl = txHash
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : null;

  return (
    <div
      className={`mt-3 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${config.colorClass}`}
      role="status"
      aria-live="polite"
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          {status === 'failed' && error
            ? `Failed: ${error}`
            : config.label}
        </span>
        {status === 'success' && expertUrl && (
          <a
            href={expertUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-xs underline opacity-75 hover:opacity-100"
          >
            View on Stellar Expert
            <ExternalLink size={11} />
          </a>
        )}
        {status === 'success' && txHash && !expertUrl && (
          <span className="ml-2 font-mono text-xs opacity-60">
            {txHash.slice(0, 12)}...
          </span>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-current opacity-50 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
