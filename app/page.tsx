'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useWalletContext } from '../context/WalletContext';
import { useExpense } from '../hooks/useExpense';
import { ExpenseCard } from '../components/ExpenseCard';
import { balanceLabel } from '../lib/stellar-utils';
import { PlusCircle, Wallet, TrendingUp, LayoutGrid } from 'lucide-react';

/** Loading skeleton for expense cards */
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
      <div className="flex justify-between">
        <div className="h-5 w-2/3 rounded bg-slate-800" />
        <div className="h-5 w-14 rounded-full bg-slate-800" />
      </div>
      <div className="h-8 w-1/3 rounded bg-slate-800" />
      <div className="h-3 w-1/2 rounded bg-slate-800" />
    </div>
  );
}

/** Empty state block */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-12 text-center">
      <LayoutGrid size={32} className="mb-3 text-slate-700" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { publicKey, isConnected } = useWalletContext();
  const {
    expenses,
    userExpenses,
    balance,
    loading,
    fetchAllExpenses,
    fetchUserExpenses,
    fetchBalance,
  } = useExpense();

  // Fetch data on mount and when wallet connects
  useEffect(() => {
    fetchAllExpenses();
  }, [fetchAllExpenses]);

  useEffect(() => {
    if (publicKey) {
      fetchUserExpenses(publicKey);
      fetchBalance(publicKey);
    }
  }, [publicKey, fetchUserExpenses, fetchBalance]);

  const { label: balLabelText, color: balLabelColor } = balanceLabel(balance);

  return (
    <div className="space-y-10">
      {/* Hero / balance section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Net Balance
            </p>
            {isConnected ? (
              <p className={`text-3xl font-bold tracking-tight ${balLabelColor}`}>
                {balLabelText}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <Wallet size={16} />
                <span className="text-sm">Connect your wallet to see your balance</span>
              </div>
            )}
            {isConnected && (
              <p className="mt-1 text-xs text-slate-600">
                Across all open expenses on Stellar Testnet
              </p>
            )}
          </div>
          <Link
            href="/create"
            className={`flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white transition-colors ${
              isConnected
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'cursor-not-allowed bg-slate-700 text-slate-500'
            }`}
            aria-disabled={!isConnected}
            onClick={(e) => !isConnected && e.preventDefault()}
          >
            <PlusCircle size={16} />
            Create Expense
          </Link>
        </div>
      </section>

      {/* Your Expenses */}
      {isConnected && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Your Expenses
            </h2>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : userExpenses.length === 0 ? (
            <EmptyState message="No expenses yet. Create your first one to get started." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {userExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  currentUser={publicKey}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* All Expenses */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <LayoutGrid size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            All Expenses
          </h2>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState message="No expenses on-chain yet. Be the first to create one!" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                currentUser={publicKey}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
