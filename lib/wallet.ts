'use client';

export const EXPECTED_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  'Test SDF Network ; September 2015';

export interface WalletInfo {
  publicKey: string;
  networkPassphrase: string;
  isCorrectNetwork: boolean;
}

/**
 * Connect to Freighter wallet and return wallet info.
 * Throws if Freighter is not installed or the user rejects access.
 */
export async function connectWallet(): Promise<WalletInfo> {
  // Dynamic import so this only runs in the browser
  const freighter = await import('@stellar/freighter-api');

  const connectedResult = await freighter.isConnected();
  const isConnected =
    typeof connectedResult === 'boolean'
      ? connectedResult
      : (connectedResult as { isConnected: boolean }).isConnected;

  if (!isConnected) {
    throw new Error(
      'Freighter extension not found. Please install it from freighter.app'
    );
  }

  await freighter.requestAccess();
  const pkResult = await freighter.getPublicKey();
  const publicKey =
    typeof pkResult === 'string'
      ? pkResult
      : (pkResult as { publicKey: string }).publicKey;

  const details = await freighter.getNetworkDetails();
  const networkPassphrase =
    typeof details === 'string'
      ? details
      : (details as { networkPassphrase: string }).networkPassphrase;

  return {
    publicKey,
    networkPassphrase,
    isCorrectNetwork: networkPassphrase === EXPECTED_PASSPHRASE,
  };
}

/**
 * Check if Freighter is already connected (no user prompt).
 * Returns the public key if connected, or null otherwise.
 */
export async function checkWalletConnection(): Promise<string | null> {
  try {
    const freighter = await import('@stellar/freighter-api');
    const connectedResult = await freighter.isConnected();
    const isConnected =
      typeof connectedResult === 'boolean'
        ? connectedResult
        : (connectedResult as { isConnected: boolean }).isConnected;

    if (!isConnected) return null;

    const pkResult = await freighter.getPublicKey();
    const publicKey =
      typeof pkResult === 'string'
        ? pkResult
        : (pkResult as { publicKey: string }).publicKey;

    return publicKey || null;
  } catch {
    return null;
  }
}

/**
 * Sign a transaction XDR string with Freighter.
 */
export async function signTxWithFreighter(
  txXdr: string,
  networkPassphrase: string
): Promise<string> {
  const freighter = await import('@stellar/freighter-api');
  const result = await freighter.signTransaction(txXdr, { networkPassphrase });
  // Handle both old API (returns string) and new API (returns object)
  if (typeof result === 'string') return result;
  return (result as { signedTxXdr: string }).signedTxXdr;
}
