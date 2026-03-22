'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletContext } from '@/context/WalletContext';
import { useExpense } from '@/hooks/useExpense';
import { isValidStellarAddress } from '@/lib/stellar-utils';
import { ParticipantRow } from './ParticipantRow';
import { TxStatusBanner } from './TxStatusBanner';
import { PlusCircle, Receipt } from 'lucide-react';
import type { CreateExpenseParams } from '@/types';

interface ParticipantEntry {
  address: string;
  amountOwed: string;
}

const MAX_PARTICIPANTS = 10;

/**
 * Multi-step form for creating a new group expense on-chain.
 * Includes live sum validation and full tx lifecycle feedback.
 */
export function CreateExpenseForm() {
  const router = useRouter();
  const { publicKey } = useWalletContext();
  const { createExpense, txState, clearTxState } = useExpense();

  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [participants, setParticipants] = useState<ParticipantEntry[]>([
    { address: '', amountOwed: '' },
    { address: '', amountOwed: '' },
  ]);

  // ── Live sum validation ──────────────────────────────────────────────────
  const participantSum = useMemo(
    () =>
      participants.reduce((acc, p) => {
        const v = parseFloat(p.amountOwed);
        return acc + (isNaN(v) ? 0 : v);
      }, 0),
    [participants]
  );

  const total = parseFloat(totalAmount) || 0;
  const remainder = Math.round((total - participantSum) * 10_000_000) / 10_000_000;
  const sumsMatch = Math.abs(remainder) < 0.0001;

  // ── Address validation ────────────────────────────────────────────────────
  const allAddressesValid = participants.every(
    (p) => p.address.length > 0 && isValidStellarAddress(p.address)
  );

  const allAmountsValid = participants.every((p) => {
    const v = parseFloat(p.amountOwed);
    return !isNaN(v) && v > 0;
  });

  const hasDuplicateAddresses =
    new Set(participants.map((p) => p.address)).size !== participants.length;

  const canSubmit =
    description.trim().length > 0 &&
    total > 0 &&
    allAddressesValid &&
    allAmountsValid &&
    sumsMatch &&
    !hasDuplicateAddresses &&
    txState.status === 'idle';

  // ── Participant list helpers ──────────────────────────────────────────────
  function updateAddress(index: number, value: string) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, address: value } : p))
    );
  }

  function updateAmount(index: number, value: string) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, amountOwed: value } : p))
    );
  }

  function addParticipant() {
    if (participants.length >= MAX_PARTICIPANTS) return;
    setParticipants((prev) => [...prev, { address: '', amountOwed: '' }]);
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !canSubmit) return;

    const params: CreateExpenseParams = {
      description: description.trim(),
      totalAmount: total,
      participants: participants.map((p) => ({
        address: p.address,
        amountOwed: parseFloat(p.amountOwed),
      })),
    };

    try {
      const expenseId = await createExpense(params, publicKey);
      router.push(`/expense/${expenseId}`);
    } catch {
      // Error already captured in txState
    }
  }

  const inFlight =
    txState.status !== 'idle' &&
    txState.status !== 'success' &&
    txState.status !== 'failed';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-slate-300">
          Description
          <span className="ml-1 text-xs text-slate-500">
            ({description.length}/100)
          </span>
        </label>
        <input
          id="description"
          type="text"
          maxLength={100}
          placeholder='e.g. "Dinner at Park Street Cafe"'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>

      {/* Total Amount */}
      <div className="space-y-1.5">
        <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-300">
          Total Amount (XLM)
        </label>
        <input
          id="totalAmount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>

      {/* Participants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">
            Participants
          </label>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Address</span>
            <span className="w-32 text-right">Amount (XLM)</span>
            <span className="w-8" />
          </div>
        </div>

        <div className="space-y-2">
          {participants.map((p, i) => (
            <ParticipantRow
              key={i}
              index={i}
              address={p.address}
              amountOwed={p.amountOwed}
              onAddressChange={updateAddress}
              onAmountChange={updateAmount}
              onRemove={removeParticipant}
              showRemove={participants.length > 1}
            />
          ))}
        </div>

        {participants.length < MAX_PARTICIPANTS && (
          <button
            type="button"
            onClick={addParticipant}
            className="flex items-center gap-1.5 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
          >
            <PlusCircle size={15} />
            Add Participant
          </button>
        )}

        {hasDuplicateAddresses && (
          <p className="text-xs text-red-400">Duplicate participant addresses detected.</p>
        )}
      </div>

      {/* Live sum validator */}
      {total > 0 && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            sumsMatch
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
              : 'border-red-500/20 bg-red-500/5 text-red-400'
          }`}
        >
          {sumsMatch ? (
            <span>Amounts balance correctly.</span>
          ) : remainder > 0 ? (
            <span>
              Remaining to assign:{' '}
              <strong>{remainder.toFixed(7)} XLM</strong>
            </span>
          ) : (
            <span>
              Over by: <strong>{Math.abs(remainder).toFixed(7)} XLM</strong>
            </span>
          )}
        </div>
      )}

      {/* Transaction status */}
      <TxStatusBanner txState={txState} onDismiss={clearTxState} />

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit || inFlight}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {inFlight ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Processing...
          </>
        ) : (
          <>
            <Receipt size={16} />
            Create Expense
          </>
        )}
      </button>
    </form>
  );
}
