'use client';

import { isValidStellarAddress } from '../lib/stellar-utils';
import { X } from 'lucide-react';

interface ParticipantRowProps {
  index: number;
  address: string;
  amountOwed: string;
  onAddressChange: (index: number, value: string) => void;
  onAmountChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}

export function ParticipantRow({
  index,
  address,
  amountOwed,
  onAddressChange,
  onAmountChange,
  onRemove,
  showRemove,
}: ParticipantRowProps) {
  const addressInvalid = address.length > 0 && !isValidStellarAddress(address);

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <input
          type="text"
          placeholder="GABCD... (Stellar address)"
          value={address}
          onChange={(e) => onAddressChange(index, e.target.value)}
          className={`w-full rounded-md border bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            addressInvalid ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700'
          }`}
          aria-label={`Participant ${index + 1} address`}
        />
        {addressInvalid && (
          <p className="text-xs text-red-400">Must be a valid Stellar address (G... 56 chars)</p>
        )}
      </div>
      <div className="w-32 shrink-0">
        <input
          type="number"
          placeholder="0.00"
          value={amountOwed}
          min="0.01"
          step="0.01"
          onChange={(e) => onAmountChange(index, e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={`Participant ${index + 1} amount`}
        />
      </div>
      <div className="w-8 shrink-0 pt-2">
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            aria-label={`Remove participant ${index + 1}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
