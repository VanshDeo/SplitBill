'use client';

import React, { createContext, useContext } from 'react';
import { useWallet } from '../hooks/useWallet';
import type { WalletState } from '../types/index';

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWalletContext(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWalletContext must be used inside a WalletProvider');
  }
  return ctx;
}
