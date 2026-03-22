'use client';

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTxWithFreighter, EXPECTED_PASSPHRASE } from './wallet';
import type { Expense, Settlement, TxStatus, Participant } from '@/types';

// ── Environment configuration ─────────────────────────────────────────────────
const CONTRACT_ID  = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';
const RPC_URL      = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASS = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? EXPECTED_PASSPHRASE;

// ── Error code mapping ────────────────────────────────────────────────────────
const ERROR_MESSAGES: Record<number, string> = {
  1: 'Expense not found.',
  2: 'You have already settled this expense.',
  3: 'You are not a participant in this expense.',
  4: 'This expense is already closed.',
  5: 'Invalid amount — must be greater than zero.',
  6: 'Unauthorized.',
  7: 'Duplicate participant address.',
  8: 'Amounts do not sum to total.',
  9: 'Description cannot be empty.',
  10: 'At least one participant is required.',
};

export class ContractError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

function parseContractError(raw: unknown): ContractError {
  const msg = String(raw);
  // Soroban encodes errors like "Error(Contract, #1)"
  const match = msg.match(/#(\d+)/);
  if (match) {
    const code = parseInt(match[1], 10);
    return new ContractError(code, ERROR_MESSAGES[code] ?? `Contract error ${code}`);
  }
  return new ContractError(0, msg);
}

// ── Lazy singleton RPC server & contract ─────────────────────────────────────
function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
}

function getContract(): Contract {
  return new Contract(CONTRACT_ID);
}

// ── Shared transaction lifecycle helper ──────────────────────────────────────
/**
 * Build, sign (via Freighter), submit, and poll a Soroban transaction.
 * Calls onStatus at each stage of the lifecycle.
 * Returns the transaction hash on success.
 */
async function submitTx(
  sourcePublicKey: string,
  operation: xdr.Operation,
  onStatus: (s: TxStatus) => void
): Promise<string> {
  const server = getServer();

  onStatus('building');
  const account = await server.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();

  onStatus('awaiting_signature');
  const signedXdr = await signTxWithFreighter(assembled.toXDR(), NETWORK_PASS);

  onStatus('submitting');
  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASS)
  );
  if (result.status === 'ERROR') {
    throw new Error(result.errorResult?.toString() ?? 'Transaction submission failed');
  }

  onStatus('polling');
  const hash = result.hash;
  for (let i = 0; i < 15; i++) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    const poll = await server.getTransaction(hash);
    if (poll.status === 'SUCCESS') {
      onStatus('success');
      return hash;
    }
    if (poll.status === 'FAILED') {
      throw new Error('Transaction failed on-chain');
    }
  }
  throw new Error('Transaction polling timed out after 30 seconds');
}

// ── Read-only simulation helper ───────────────────────────────────────────────
/**
 * Simulate a read-only contract call without submitting a transaction.
 * No fees are charged.
 */
async function readContract<T>(operation: xdr.Operation): Promise<T> {
  const server = getServer();
  // Use a dummy account for simulation
  const dummyAccount = {
    accountId: () => CONTRACT_ID,
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  };
  const tx = new TransactionBuilder(dummyAccount as Parameters<typeof TransactionBuilder>[0], {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }
  const successSim = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(successSim.result!.retval) as T;
}

// ── XDR encoding helpers ──────────────────────────────────────────────────────
function encodeAddress(addr: string): xdr.ScVal {
  return new Address(addr).toScVal();
}

function encodeString(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

function encodeI128(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'i128' });
}

function encodeU32(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: 'u32' });
}

function encodeAddressVec(addrs: string[]): xdr.ScVal {
  return xdr.ScVal.scvVec(addrs.map((a) => encodeAddress(a)));
}

function encodeI128Vec(amounts: bigint[]): xdr.ScVal {
  return xdr.ScVal.scvVec(amounts.map((a) => encodeI128(a)));
}

// ── XDR decoding helpers ──────────────────────────────────────────────────────
// scValToNative handles nested structs and maps; we parse the resulting JS objects.

function decodeParticipant(raw: Record<string, unknown>): Participant {
  return {
    address: String(raw.address),
    amountOwed: Number(raw.amount_owed),
    amountPaid: Number(raw.amount_paid),
    settled: Boolean(raw.settled),
  };
}

function decodeExpense(raw: Record<string, unknown>): Expense {
  const participants = (raw.participants as Record<string, unknown>[]).map(
    decodeParticipant
  );
  const statusRaw = raw.status as Record<string, unknown> | string;
  const status: 'Open' | 'Closed' =
    typeof statusRaw === 'string'
      ? (statusRaw as 'Open' | 'Closed')
      : 'Open' in (statusRaw as Record<string, unknown>)
        ? 'Open'
        : 'Closed';

  return {
    id: Number(raw.id),
    description: String(raw.description),
    payer: String(raw.payer),
    totalAmount: Number(raw.total_amount),
    participants,
    status,
    createdAt: Number(raw.created_at),
  };
}

function decodeSettlement(raw: Record<string, unknown>): Settlement {
  return {
    expenseId: Number(raw.expense_id),
    settler: String(raw.settler),
    amount: Number(raw.amount),
    settledAt: Number(raw.settled_at),
  };
}

// ── Exported contract functions ───────────────────────────────────────────────

/**
 * Create a new group expense on-chain.
 * Returns the transaction hash and the new expense ID.
 */
export async function createExpense(
  payer: string,
  description: string,
  totalAmountStroops: bigint,
  participantAddresses: string[],
  amountsOwedStroops: bigint[],
  onStatus: (s: TxStatus) => void
): Promise<{ txHash: string; expenseId: number }> {
  const contract = getContract();
  const server = getServer();

  // First simulate to get the return value (new expense ID)
  const operation = contract.call(
    'create_expense',
    encodeAddress(payer),
    encodeString(description),
    encodeI128(totalAmountStroops),
    encodeAddressVec(participantAddresses),
    encodeI128Vec(amountsOwedStroops)
  );

  // Simulate first to capture the returned expense ID
  onStatus('building');
  const account = await server.getAccount(payer);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const successSim = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  const expenseId = Number(scValToNative(successSim.result!.retval));

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();

  onStatus('awaiting_signature');
  const signedXdr = await signTxWithFreighter(assembled.toXDR(), NETWORK_PASS);

  onStatus('submitting');
  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASS)
  );
  if (result.status === 'ERROR') {
    throw new Error(result.errorResult?.toString() ?? 'Transaction submission failed');
  }

  onStatus('polling');
  const hash = result.hash;
  for (let i = 0; i < 15; i++) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    const poll = await server.getTransaction(hash);
    if (poll.status === 'SUCCESS') {
      onStatus('success');
      return { txHash: hash, expenseId };
    }
    if (poll.status === 'FAILED') {
      throw new Error('Transaction failed on-chain');
    }
  }
  throw new Error('Transaction polling timed out');
}

/**
 * Settle a participant's debt for a given expense.
 * Returns the transaction hash.
 */
export async function settleExpense(
  settler: string,
  expenseId: number,
  onStatus: (s: TxStatus) => void
): Promise<string> {
  const contract = getContract();
  const operation = contract.call(
    'settle',
    encodeAddress(settler),
    encodeU32(expenseId)
  );
  return submitTx(settler, operation, onStatus);
}

/**
 * Fetch a single expense by ID.
 */
export async function getExpense(expenseId: number): Promise<Expense> {
  const contract = getContract();
  const operation = contract.call('get_expense', encodeU32(expenseId));
  const raw = await readContract<Record<string, unknown>>(operation);
  return decodeExpense(raw);
}

/**
 * Fetch all expenses stored in the contract.
 */
export async function getAllExpenses(): Promise<Expense[]> {
  const contract = getContract();
  const operation = contract.call('get_all_expenses');
  const raw = await readContract<Record<string, unknown>[]>(operation);
  if (!Array.isArray(raw)) return [];
  return raw.map(decodeExpense);
}

/**
 * Fetch all expenses involving a specific user address.
 */
export async function getUserExpenses(userAddress: string): Promise<Expense[]> {
  const contract = getContract();
  const operation = contract.call(
    'get_user_expenses',
    encodeAddress(userAddress)
  );
  const raw = await readContract<Record<string, unknown>[]>(operation);
  if (!Array.isArray(raw)) return [];
  return raw.map(decodeExpense);
}

/**
 * Get the net balance for a user across all their expenses.
 * Positive = owed to them. Negative = they owe.
 */
export async function getUserBalance(userAddress: string): Promise<bigint> {
  const contract = getContract();
  const operation = contract.call(
    'get_user_balance',
    encodeAddress(userAddress)
  );
  const raw = await readContract<bigint>(operation);
  return BigInt(raw);
}

/**
 * Check if a specific address has settled a specific expense.
 */
export async function isSettled(
  expenseId: number,
  settler: string
): Promise<boolean> {
  const contract = getContract();
  const operation = contract.call(
    'is_settled',
    encodeU32(expenseId),
    encodeAddress(settler)
  );
  return readContract<boolean>(operation);
}

/**
 * Fetch the full settlement audit log for an expense.
 */
export async function getSettlements(expenseId: number): Promise<Settlement[]> {
  const contract = getContract();
  const operation = contract.call('get_settlements', encodeU32(expenseId));
  const raw = await readContract<Record<string, unknown>[]>(operation);
  if (!Array.isArray(raw)) return [];
  return raw.map(decodeSettlement);
}
