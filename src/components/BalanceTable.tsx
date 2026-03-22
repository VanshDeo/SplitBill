'use client';

import type { Expense } from '@/types';
import { stroopsToXlm, truncateAddress } from '@/lib/stellar-utils';
import { CheckCircle2, Circle } from 'lucide-react';

interface BalanceTableProps {
  expense: Expense;
  currentUser: string | null;
}

/**
 * Table showing all participants, their amounts owed, and settlement status.
 * Highlights the current user's row.
 */
export function BalanceTable({ expense, currentUser }: BalanceTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              Participant
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
              Amount Owed
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {expense.participants.map((participant, i) => {
            const isCurrentUser = participant.address === currentUser;
            return (
              <tr
                key={participant.address}
                className={`transition-colors ${
                  isCurrentUser ? 'bg-slate-800/50' : i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-300">
                      {truncateAddress(participant.address)}
                    </span>
                    {isCurrentUser && (
                      <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-xs text-indigo-400 border border-indigo-500/20">
                        you
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono font-medium text-slate-200">
                    {stroopsToXlm(participant.amountOwed)} XLM
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {participant.settled ? (
                    <span className="inline-flex items-center justify-end gap-1.5 text-emerald-400">
                      <CheckCircle2 size={14} />
                      <span className="text-xs font-medium">Settled</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-end gap-1.5 text-red-400">
                      <Circle size={14} />
                      <span className="text-xs font-medium">Unpaid</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-700 bg-slate-800/40">
            <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total
            </td>
            <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
              {stroopsToXlm(expense.totalAmount)} XLM
            </td>
            <td className="px-4 py-3 text-right text-xs text-slate-500">
              {expense.participants.filter((p) => p.settled).length}/
              {expense.participants.length} settled
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
