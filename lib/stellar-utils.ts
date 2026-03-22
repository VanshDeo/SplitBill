/**
 * Convert XLM to stroops (1 XLM = 10,000,000 stroops).
 * Uses BigInt to avoid float precision loss.
 */
export const xlmToStroops = (xlm: number): bigint =>
  BigInt(Math.round(xlm * 10_000_000));

/**
 * Convert stroops to XLM string with 2 decimal places.
 */
export const stroopsToXlm = (stroops: number): string =>
  (stroops / 10_000_000).toFixed(2);

/**
 * Convert a BigInt stroops value to XLM string with 2 decimal places.
 */
export const bigIntStroopsToXlm = (stroops: bigint): string =>
  (Number(stroops) / 10_000_000).toFixed(2);

/**
 * Truncate a Stellar address for display: GABCD...XY12
 */
export const truncateAddress = (address: string): string =>
  address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

/**
 * Format a Unix timestamp (seconds) to a readable local date/time string.
 */
export const formatTimestamp = (ts: number): string =>
  new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Validate a Stellar public key (starts with G, exactly 56 alphanumeric chars).
 */
export const isValidStellarAddress = (addr: string): boolean =>
  /^G[A-Z0-9]{55}$/.test(addr);

/**
 * Returns a human-readable balance label and its CSS color class.
 * Positive = owed to user, Negative = user owes.
 */
export const balanceLabel = (
  stroops: bigint
): { label: string; color: string } => {
  if (stroops > 0n) {
    return {
      label: `+${bigIntStroopsToXlm(stroops)} XLM owed to you`,
      color: 'text-emerald-400',
    };
  }
  if (stroops < 0n) {
    return {
      label: `-${bigIntStroopsToXlm(-stroops)} XLM you owe`,
      color: 'text-red-400',
    };
  }
  return { label: 'All settled up', color: 'text-slate-400' };
};
