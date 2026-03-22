'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWalletContext } from '../../../context/WalletContext';
import { BalanceTable } from '../../../components/BalanceTable';
import { SettleButton } from '../../../components/SettleButton';
import { getExpense, getSettlements, isSettled } from '../../../lib/contract';
import type { Expense, Settlement } from '../../../types/index';
import { stroopsToXlm, truncateAddress, formatTimestamp } from '../../../lib/stellar-utils';
import { ArrowLeft, User, Clock, DollarSign, History } from 'lucide-react';

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-2/3 rounded bg-slate-800" />
      <div className="h-4 w-1/3 rounded bg-slate-800" />
      <div className="h-40 rounded-xl bg-slate-800" />
      <div className="h-24 rounded-xl bg-slate-800" />
    </div>
  );
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const expenseId = Number(params.id);
  const { publicKey } = useWalletContext();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settled, setSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const exp = await getExpense(expenseId);
      setExpense(exp);
      const settleList = await getSettlements(expenseId);
      setSettlements(settleList);
      if (publicKey) {
        const alreadySettled = await isSettled(expenseId, publicKey);
        setSettled(alreadySettled);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isNaN(expenseId)) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId, publicKey]);

  const isParticipant = publicKey && expense?.participants.some((p) => p.address === publicKey);
  const isOpen = expense?.status === 'Open';

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft size={14} /> Back
        </Link>
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound || !expense) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-lg font-semibold text-slate-300">Expense not found</p>
          <p className="mt-1 text-sm text-slate-500">
            The expense with ID #{expenseId} does not exist on-chain.
          </p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300">
            <ArrowLeft size={13} /> Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-slate-100 text-balance leading-snug flex-1">
            {expense.description}
          </h1>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium ${
              isOpen
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border border-slate-700 bg-slate-700 text-slate-400'
            }`}
          >
            {expense.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <User size={13} />
            Paid by{' '}
            <span className="font-mono text-slate-300">
              {expense.payer === publicKey ? 'you' : truncateAddress(expense.payer)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} />
            {formatTimestamp(expense.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign size={13} />
            <span className="font-mono font-semibold text-slate-200">
              {stroopsToXlm(expense.totalAmount)} XLM
            </span>
            total
          </span>
        </div>
      </div>

      {/* Balance table */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Balances</h2>
        <BalanceTable expense={expense} currentUser={publicKey} />
      </div>

      {/* Settle section */}
      {isParticipant && isOpen && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Your Settlement</h2>
          <SettleButton
            expenseId={expense.id}
            settler={publicKey!}
            settled={settled}
            onSuccess={() => { setSettled(true); loadAll(); }}
          />
        </div>
      )}

      {/* Settlement history */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History size={14} className="text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Settlement History
          </h2>
        </div>
        {settlements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 py-6 text-center text-sm text-slate-600">
            No settlements recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
            {settlements.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-300">
                    {s.settler === publicKey ? 'you' : truncateAddress(s.settler)}
                  </span>
                  <span className="text-xs text-slate-600">settled</span>
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {stroopsToXlm(s.amount)} XLM
                  </span>
                </div>
                <span className="text-xs text-slate-600">{formatTimestamp(s.settledAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
