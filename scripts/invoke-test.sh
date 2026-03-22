#!/usr/bin/env bash
set -euo pipefail

source frontend/.env
CONTRACT_ID=$NEXT_PUBLIC_CONTRACT_ID
DEPLOYER=$(stellar keys address deployer)

echo "Contract: $CONTRACT_ID"
echo "Deployer: $DEPLOYER"

echo ""
echo "1. Creating test expense..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn create_expense \
  -- \
  --payer "$DEPLOYER" \
  --description "Team lunch" \
  --total_amount 100000000 \
  --participant_addresses "[$DEPLOYER]" \
  --amounts_owed "[100000000]"

echo ""
echo "2. Getting expense..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_expense \
  -- --expense_id 0

echo ""
echo "3. Getting user balance..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_user_balance \
  -- --user "$DEPLOYER"

echo ""
echo "4. Settling expense..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn settle \
  -- --settler "$DEPLOYER" --expense_id 0

echo ""
echo "5. Verifying settlement..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn is_settled \
  -- --expense_id 0 --settler "$DEPLOYER"

echo ""
echo "All smoke tests passed"
