'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectWallet, checkWalletConnection, EXPECTED_PASSPHRASE } from '@/lib/wallet';

interface UseWalletReturn {
  publicKey: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook that manages Freighter wallet connection state.
 * Checks for an existing connection on mount.
 */
export function useWallet(): UseWalletReturn {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  // Check for an existing connection on mount
  useEffect(() => {
    checkWalletConnection()
      .then((pk) => {
        if (pk) setPublicKey(pk);
      })
      .catch(() => {
        // Silently fail — Freighter may not be installed
      });
  }, []);

  const connect = useCallback(async () => {
    const info = await connectWallet();
    setPublicKey(info.publicKey);
    setIsCorrectNetwork(info.networkPassphrase === EXPECTED_PASSPHRASE);
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setIsCorrectNetwork(true);
  }, []);

  return {
    publicKey,
    isConnected: publicKey !== null,
    isCorrectNetwork,
    connect,
    disconnect,
  };
}
