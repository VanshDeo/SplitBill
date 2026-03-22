#!/usr/bin/env bash
set -euo pipefail

DEPLOYER_KEY=$(stellar keys address deployer 2>/dev/null || (stellar keys generate deployer --network testnet && stellar keys address deployer))
echo "Deployer: $DEPLOYER_KEY"

echo "Funding account via Friendbot..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER_KEY" | grep -q '"successful": true' && echo "Funded successfully" || echo "Already funded or error (may already have funds)"
