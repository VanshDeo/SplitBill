#!/usr/bin/env bash
set -euo pipefail

echo "Building contract WASM..."
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..

WASM_PATH="contract/target/wasm32-unknown-unknown/release/stellar_split.wasm"

echo "Optimizing WASM..."
stellar contract optimize --wasm "$WASM_PATH"
OPTIMIZED="${WASM_PATH%.wasm}.optimized.wasm"

echo "Deploying to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMIZED" \
  --network testnet \
  --source deployer)

echo "Deployed! Contract ID: $CONTRACT_ID"

# Write to frontend env
mkdir -p frontend
cat > frontend/.env <<EOF
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
EOF

echo "Contract ID saved to frontend/.env"
echo "CONTRACT_ID=$CONTRACT_ID"
