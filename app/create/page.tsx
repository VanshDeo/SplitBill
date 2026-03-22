'use client';

import Link from 'next/link';
import { useWalletContext } from '@/context/WalletContext';
import { CreateExpenseForm } from '@/components/CreateExpenseForm';
import { ArrowLeft, Wallet } from 'lucide-react';

export default function CreatePage() {
  const { isConnected } = useWalletContext();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-300"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-lg font-bold text-slate-100">Create New Expense</h1>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
        {!isConnected ? (
          /* Wallet guard */
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
              <Wallet size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Wallet not connected</p>
              <p className="mt-1 text-sm text-slate-500">
                Connect your Freighter wallet to create an expense.
              </p>
            </div>
          </div>
        ) : (
          <CreateExpenseForm />
        )}
      </div>
    </div>
  );
}
