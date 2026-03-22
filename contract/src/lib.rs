#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
};

// ── Expense status ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum ExpenseStatus {
    Open,
    Closed,
}

// ── A single participant entry ──────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct Participant {
    pub address: Address,
    pub amount_owed: i128,
    pub amount_paid: i128,
    pub settled: bool,
}

// ── The full expense record ─────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct Expense {
    pub id: u32,
    pub description: String,
    pub payer: Address,
    pub total_amount: i128,
    pub participants: Vec<Participant>,
    pub status: ExpenseStatus,
    pub created_at: u64,
}

// ── Settlement record (audit trail) ────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct Settlement {
    pub expense_id: u32,
    pub settler: Address,
    pub amount: i128,
    pub settled_at: u64,
}

// ── Storage keys ────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    ExpenseCount,
    Expense(u32),
    UserExpenses(Address),
    Settlement(u32, Address),
    Settlements(u32),
}

// ── Error types ─────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum SplitError {
    ExpenseNotFound      = 1,
    AlreadySettled       = 2,
    NotParticipant       = 3,
    ExpenseClosed        = 4,
    InvalidAmount        = 5,
    Unauthorized         = 6,
    DuplicateParticipant = 7,
    AmountMismatch       = 8,
    EmptyDescription     = 9,
    NoParticipants       = 10,
}

#[contract]
pub struct BillSplitContract;

#[contractimpl]
impl BillSplitContract {

    /// Create a new group expense. The payer has already paid the bill;
    /// participants owe their respective shares.
    pub fn create_expense(
        env: Env,
        payer: Address,
        description: String,
        total_amount: i128,
        participant_addresses: Vec<Address>,
        amounts_owed: Vec<i128>,
    ) -> u32 {
        payer.require_auth();

        // Validate description non-empty
        if description.len() == 0 {
            panic!("{}", SplitError::EmptyDescription as u32);
        }

        // Validate at least one participant
        if participant_addresses.len() == 0 {
            panic!("{}", SplitError::NoParticipants as u32);
        }

        // Validate parallel arrays match
        if participant_addresses.len() != amounts_owed.len() {
            panic!("{}", SplitError::AmountMismatch as u32);
        }

        // Validate all amounts positive and compute sum
        let mut sum: i128 = 0;
        for i in 0..amounts_owed.len() {
            let amt = amounts_owed.get(i).unwrap();
            if amt <= 0 {
                panic!("{}", SplitError::InvalidAmount as u32);
            }
            sum += amt;
        }

        // Validate sum matches total
        if sum != total_amount {
            panic!("{}", SplitError::AmountMismatch as u32);
        }

        // Validate no duplicate participants
        for i in 0..participant_addresses.len() {
            for j in (i + 1)..participant_addresses.len() {
                if participant_addresses.get(i).unwrap() == participant_addresses.get(j).unwrap() {
                    panic!("{}", SplitError::DuplicateParticipant as u32);
                }
            }
        }

        // Allocate expense ID
        let id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::ExpenseCount)
            .unwrap_or(0u32);

        env.storage()
            .persistent()
            .set(&DataKey::ExpenseCount, &(id + 1));

        // Build participants Vec
        let mut participants: Vec<Participant> = Vec::new(&env);
        for i in 0..participant_addresses.len() {
            participants.push_back(Participant {
                address: participant_addresses.get(i).unwrap(),
                amount_owed: amounts_owed.get(i).unwrap(),
                amount_paid: 0,
                settled: false,
            });
        }

        // Build and save expense
        let expense = Expense {
            id,
            description,
            payer: payer.clone(),
            total_amount,
            participants,
            status: ExpenseStatus::Open,
            created_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Expense(id), &expense);

        // Append to payer's expense list
        let mut payer_expenses: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserExpenses(payer.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        payer_expenses.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::UserExpenses(payer), &payer_expenses);

        // Append to each participant's expense list
        for i in 0..expense.participants.len() {
            let participant_addr = expense.participants.get(i).unwrap().address;
            let mut user_expenses: Vec<u32> = env
                .storage()
                .persistent()
                .get(&DataKey::UserExpenses(participant_addr.clone()))
                .unwrap_or_else(|| Vec::new(&env));
            user_expenses.push_back(id);
            env.storage()
                .persistent()
                .set(&DataKey::UserExpenses(participant_addr), &user_expenses);
        }

        id
    }

    /// Settle a participant's debt for a given expense.
    pub fn settle(env: Env, settler: Address, expense_id: u32) {
        settler.require_auth();

        // Load expense
        let mut expense: Expense = env
            .storage()
            .persistent()
            .get(&DataKey::Expense(expense_id))
            .unwrap_or_else(|| panic!("{}", SplitError::ExpenseNotFound as u32));

        // Check expense is open
        if expense.status != ExpenseStatus::Open {
            panic!("{}", SplitError::ExpenseClosed as u32);
        }

        // Check not already settled (idempotency lock)
        if env
            .storage()
            .persistent()
            .has(&DataKey::Settlement(expense_id, settler.clone()))
        {
            panic!("{}", SplitError::AlreadySettled as u32);
        }

        // Find participant and update
        let mut found = false;
        let mut settled_amount: i128 = 0;
        let mut updated_participants: Vec<Participant> = Vec::new(&env);

        for i in 0..expense.participants.len() {
            let mut p = expense.participants.get(i).unwrap();
            if p.address == settler {
                found = true;
                settled_amount = p.amount_owed;
                p.settled = true;
                p.amount_paid = p.amount_owed;
            }
            updated_participants.push_back(p);
        }

        if !found {
            panic!("{}", SplitError::NotParticipant as u32);
        }

        expense.participants = updated_participants;

        // Build and append Settlement record
        let settlement_record = Settlement {
            expense_id,
            settler: settler.clone(),
            amount: settled_amount,
            settled_at: env.ledger().timestamp(),
        };

        let mut settlements: Vec<Settlement> = env
            .storage()
            .persistent()
            .get(&DataKey::Settlements(expense_id))
            .unwrap_or_else(|| Vec::new(&env));
        settlements.push_back(settlement_record);
        env.storage()
            .persistent()
            .set(&DataKey::Settlements(expense_id), &settlements);

        // Write idempotency lock
        env.storage()
            .persistent()
            .set(&DataKey::Settlement(expense_id, settler), &true);

        // Auto-close if all participants settled
        let all_settled = expense
            .participants
            .iter()
            .all(|p| p.settled);
        if all_settled {
            expense.status = ExpenseStatus::Closed;
        }

        // Save updated expense
        env.storage()
            .persistent()
            .set(&DataKey::Expense(expense_id), &expense);
    }

    /// Get a single expense by ID.
    pub fn get_expense(env: Env, expense_id: u32) -> Expense {
        env.storage()
            .persistent()
            .get(&DataKey::Expense(expense_id))
            .unwrap_or_else(|| panic!("{}", SplitError::ExpenseNotFound as u32))
    }

    /// Get all expenses stored in the contract.
    pub fn get_all_expenses(env: Env) -> Vec<Expense> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::ExpenseCount)
            .unwrap_or(0u32);
        let mut expenses: Vec<Expense> = Vec::new(&env);
        for i in 0..count {
            if let Some(expense) = env.storage().persistent().get(&DataKey::Expense(i)) {
                expenses.push_back(expense);
            }
        }
        expenses
    }

    /// Get all expenses for a specific user (as payer or participant).
    pub fn get_user_expenses(env: Env, user: Address) -> Vec<Expense> {
        let ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserExpenses(user))
            .unwrap_or_else(|| Vec::new(&env));
        let mut expenses: Vec<Expense> = Vec::new(&env);
        for i in 0..ids.len() {
            let id = ids.get(i).unwrap();
            if let Some(expense) = env.storage().persistent().get(&DataKey::Expense(id)) {
                expenses.push_back(expense);
            }
        }
        expenses
    }

    /// Get net balance for a user across all their expenses.
    /// Positive = owed to them (they paid for others).
    /// Negative = they owe (they haven't settled yet).
    pub fn get_user_balance(env: Env, user: Address) -> i128 {
        let ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserExpenses(user.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        if ids.len() == 0 {
            return 0;
        }

        let mut balance: i128 = 0;
        for i in 0..ids.len() {
            let id = ids.get(i).unwrap();
            if let Some(expense) = env.storage().persistent().get::<DataKey, Expense>(&DataKey::Expense(id)) {
                if expense.payer == user {
                    // Sum up unsettled amounts owed to this user
                    for j in 0..expense.participants.len() {
                        let p = expense.participants.get(j).unwrap();
                        if !p.settled {
                            balance += p.amount_owed;
                        }
                    }
                }
                // If user is a participant and unsettled, subtract their debt
                for j in 0..expense.participants.len() {
                    let p = expense.participants.get(j).unwrap();
                    if p.address == user && !p.settled {
                        balance -= p.amount_owed;
                    }
                }
            }
        }
        balance
    }

    /// Returns true if a specific address has settled a specific expense.
    pub fn is_settled(env: Env, expense_id: u32, settler: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Settlement(expense_id, settler))
    }

    /// Returns the full settlement audit log for an expense.
    pub fn get_settlements(env: Env, expense_id: u32) -> Vec<Settlement> {
        env.storage()
            .persistent()
            .get(&DataKey::Settlements(expense_id))
            .unwrap_or_else(|| Vec::new(&env))
    }
}

// ── Unit Tests ──────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn create_env() -> Env {
        Env::default()
    }

    fn make_string(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    #[test]
    fn test_create_expense_basic() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        let id = client.create_expense(
            &payer,
            &make_string(&env, "Team lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        assert_eq!(id, 0);
        let expense = client.get_expense(&0);
        assert_eq!(expense.status, ExpenseStatus::Open);
        assert_eq!(expense.participants.len(), 1);
        assert_eq!(expense.total_amount, 100_000_000);
    }

    #[test]
    #[should_panic]
    fn test_create_expense_amount_mismatch_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant);
        let mut amounts = Vec::new(&env);
        amounts.push_back(50_000_000i128); // Sum ≠ total

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );
    }

    #[test]
    #[should_panic]
    fn test_create_expense_empty_description_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant);
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, ""),
            &100_000_000i128,
            &addresses,
            &amounts,
        );
    }

    #[test]
    #[should_panic]
    fn test_create_expense_no_participants_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &Vec::new(&env),
            &Vec::new(&env),
        );
    }

    #[test]
    #[should_panic]
    fn test_create_expense_duplicate_participant_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        addresses.push_back(participant.clone()); // Duplicate
        let mut amounts = Vec::new(&env);
        amounts.push_back(50_000_000i128);
        amounts.push_back(50_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Dinner"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );
    }

    #[test]
    fn test_settle_success() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Dinner"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&participant, &0);

        assert!(client.is_settled(&0, &participant));
        let expense = client.get_expense(&0);
        assert_eq!(expense.participants.get(0).unwrap().amount_paid, 100_000_000);
    }

    #[test]
    fn test_settle_closes_expense() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let p1 = Address::generate(&env);
        let p2 = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(p1.clone());
        addresses.push_back(p2.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(50_000_000i128);
        amounts.push_back(50_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Group dinner"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&p1, &0);
        client.settle(&p2, &0);

        let expense = client.get_expense(&0);
        assert_eq!(expense.status, ExpenseStatus::Closed);
    }

    #[test]
    #[should_panic]
    fn test_settle_duplicate_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&participant, &0);
        client.settle(&participant, &0); // Should panic
    }

    #[test]
    #[should_panic]
    fn test_settle_non_participant_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);
        let outsider = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&outsider, &0); // Should panic
    }

    #[test]
    #[should_panic]
    fn test_settle_closed_expense_fails() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&participant, &0); // Expense closes
        client.settle(&participant, &0); // Should panic (AlreadySettled / ExpenseClosed)
    }

    #[test]
    fn test_get_user_expenses() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let user_a = Address::generate(&env);

        for _ in 0..2 {
            let mut addresses = Vec::new(&env);
            addresses.push_back(user_a.clone());
            let mut amounts = Vec::new(&env);
            amounts.push_back(100_000_000i128);
            client.create_expense(
                &payer,
                &make_string(&env, "Expense"),
                &100_000_000i128,
                &addresses,
                &amounts,
            );
        }

        let expenses = client.get_user_expenses(&user_a);
        assert_eq!(expenses.len(), 2);
    }

    #[test]
    fn test_get_user_balance_positive() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let p1 = Address::generate(&env);
        let p2 = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(p1.clone());
        addresses.push_back(p2.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(50_000_000i128);
        amounts.push_back(50_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Dinner"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        let balance = client.get_user_balance(&payer);
        assert!(balance > 0);
        assert_eq!(balance, 100_000_000);
    }

    #[test]
    fn test_get_user_balance_negative() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        let balance = client.get_user_balance(&participant);
        assert!(balance < 0);
        assert_eq!(balance, -100_000_000);
    }

    #[test]
    fn test_get_user_balance_zero_after_settle() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&participant, &0);

        let balance = client.get_user_balance(&participant);
        assert_eq!(balance, 0);
    }

    #[test]
    fn test_get_settlements_log() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let p1 = Address::generate(&env);
        let p2 = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(p1.clone());
        addresses.push_back(p2.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(50_000_000i128);
        amounts.push_back(50_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Dinner"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        client.settle(&p1, &0);
        client.settle(&p2, &0);

        let settlements = client.get_settlements(&0);
        assert_eq!(settlements.len(), 2);
    }

    #[test]
    fn test_is_settled_false() {
        let env = create_env();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, BillSplitContract);
        let client = BillSplitContractClient::new(&env, &contract_id);

        let payer = Address::generate(&env);
        let participant = Address::generate(&env);

        let mut addresses = Vec::new(&env);
        addresses.push_back(participant.clone());
        let mut amounts = Vec::new(&env);
        amounts.push_back(100_000_000i128);

        client.create_expense(
            &payer,
            &make_string(&env, "Lunch"),
            &100_000_000i128,
            &addresses,
            &amounts,
        );

        assert!(!client.is_settled(&0, &participant));
    }
}
