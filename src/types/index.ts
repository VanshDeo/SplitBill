// ── Expense status ───────────────────────────────────────────────────────────
export type ExpenseStatus = 'Open' | 'Closed';

// ── A single participant in an expense ──────────────────────────────────────
export interface Participant {
  address: string;
  amountOwed: number;   // in stroops (1 XLM = 10,000,000 stroops)
  amountPaid: number;   // in stroops
  settled: boolean;
}

// ── The full expense record ──────────────────────────────────────────────────
export interface Expense {
  id: number;
  description: string;
  payer: string;
  totalAmount: number;  // in stroops
  participants: Participant[];
  status: ExpenseStatus;
  createdAt: number;    // Unix seconds
}

// ── Settlement record (audit trail) ─────────────────────────────────────────
export interface Settlement {
  expenseId: number;
  settler: string;
  amount: number;       // in stroops
  settledAt: number;    // Unix seconds
}

// ── Transaction lifecycle state ──────────────────────────────────────────────
export type TxStatus =
  | 'idle'
  | 'building'
  | 'awaiting_signature'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'failed';

export interface TxState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
}

// ── Create expense form params ────────────────────────────────────────────────
export interface CreateExpenseParams {
  description: string;
  totalAmount: number;  // in XLM (converted to stroops before sending)
  participants: {
    address: string;
    amountOwed: number; // in XLM
  }[];
}

// ── Wallet state ─────────────────────────────────────────────────────────────
export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}
