'use client';

import { useWalletContext } from '@/context/WalletContext';
import { truncateAddress } from '@/lib/stellar-utils';
import { Wallet, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Wallet connection button shown in the nav bar.
 * Shows connect, connected state, or wrong-network warning.
 */
export function ConnectWallet() {
  const { publicKey, isConnected, isCorrectNetwork, connect, disconnect } =
    useWalletContext();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await connect();
    } catch (e) {
      setConnectError(
        e instanceof Error ? e.message : 'Failed to connect wallet'
      );
    } finally {
      setConnecting(false);
    }
  }

  if (isConnected && !isCorrectNetwork) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400">
          <AlertTriangle size={14} />
          <span>Switch to Stellar Testnet in Freighter</span>
        </div>
        <button
          onClick={disconnect}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
        >
          <LogOut size={14} />
          Disconnect
        </button>
      </div>
    );
  }

  if (isConnected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs">{truncateAddress(publicKey)}</span>
        </div>
        <button
          onClick={disconnect}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
          title="Disconnect wallet"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {connecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Wallet size={14} />
        )}
        {connecting ? 'Connecting...' : 'Connect Freighter'}
      </button>
      {connectError && (
        <p className="text-xs text-red-400">{connectError}</p>
      )}
    </div>
  );
}
