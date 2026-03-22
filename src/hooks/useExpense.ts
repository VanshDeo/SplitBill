'use client';

import { useState, useCallback } from 'react';
import type { Expense, Settlement, TxState, CreateExpenseParams } from '@/types';
import * as contract from '@/lib/contract';
import { xlmToStroops } from '@/lib/stellar-utils';

interface UseExpenseReturn {
  expense: Expense | null;
  expenses: Expense[];
  userExpenses: Expense[];
  settlements: Settlement[];
  balance: bigint;
  loading: boolean;
  error: string | null;
  txState: TxState;
  fetchExpense: (id: number) => Promise<void>;
  fetchAllExpenses: () => Promise<void>;
  fetchUserExpenses: (addr: string) => Promise<void>;
  fetchBalance: (addr: string) => Promise<void>;
  fetchSettlements: (expenseId: number) => Promise<void>;
  createExpense: (params: CreateExpenseParams, payer: string) => Promise<number>;
  settle: (expenseId: number, settler: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearTxState: () => void;
}

const IDLE_TX: TxState = { status: 'idle', txHash: null, error: null };

/**
 * Hook that provides all expense-related data and actions.
 * Manages the full transaction lifecycle state for mutations.
 */
export function useExpense(): UseExpenseReturn {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userExpenses, setUserExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>(IDLE_TX);
  const [currentExpenseId, setCurrentExpenseId] = useState<number | null>(null);

  const setTxStatus = useCallback(
    (status: TxState['status']) =>
      setTxState((prev) => ({ ...prev, status })),
    []
  );

  const clearTxState = useCallback(() => setTxState(IDLE_TX), []);

  const fetchExpense = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setCurrentExpenseId(id);
    try {
      const data = await contract.getExpense(id);
      setExpense(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expense');
      setExpense(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contract.getAllExpenses();
      setExpenses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserExpenses = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await contract.getUserExpenses(addr);
      setUserExpenses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const data = await contract.getUserBalance(addr);
      setBalance(data);
    } catch {
      setBalance(0n);
    }
  }, []);

  const fetchSettlements = useCallback(async (expenseId: number) => {
    try {
      const data = await contract.getSettlements(expenseId);
      setSettlements(data);
    } catch {
      setSettlements([]);
    }
  }, []);

  const createExpenseAction = useCallback(
    async (params: CreateExpenseParams, payer: string): Promise<number> => {
      setTxState(IDLE_TX);
      const totalStroops = xlmToStroops(params.totalAmount);
      const participantAddresses = params.participants.map((p) => p.address);
      const amountsOwed = params.participants.map((p) => xlmToStroops(p.amountOwed));

      try {
        const { expenseId } = await contract.createExpense(
          payer,
          params.description,
          totalStroops,
          participantAddresses,
          amountsOwed,
          setTxStatus
        );
        return expenseId;
      } catch (e) {
        setTxState({
          status: 'failed',
          txHash: null,
          error: e instanceof Error ? e.message : 'Transaction failed',
        });
        throw e;
      }
    },
    [setTxStatus]
  );

  const settle = useCallback(
    async (expenseId: number, settler: string) => {
      setTxState(IDLE_TX);
      try {
        const hash = await contract.settleExpense(expenseId, settler, setTxStatus);
        setTxState({ status: 'success', txHash: hash, error: null });
        // Re-fetch expense to reflect the update
        await fetchExpense(expenseId);
        await fetchSettlements(expenseId);
      } catch (e) {
        setTxState({
          status: 'failed',
          txHash: null,
          error: e instanceof Error ? e.message : 'Settlement failed',
        });
        throw e;
      }
    },
    [setTxStatus, fetchExpense, fetchSettlements]
  );

  const refresh = useCallback(async () => {
    if (currentExpenseId !== null) {
      await fetchExpense(currentExpenseId);
      await fetchSettlements(currentExpenseId);
    }
  }, [currentExpenseId, fetchExpense, fetchSettlements]);

  return {
    expense,
    expenses,
    userExpenses,
    settlements,
    balance,
    loading,
    error,
    txState,
    fetchExpense,
    fetchAllExpenses,
    fetchUserExpenses,
    fetchBalance,
    fetchSettlements,
    createExpense: createExpenseAction,
    settle,
    refresh,
    clearTxState,
  };
}
