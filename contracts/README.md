# Social Quest Smart Contracts

This directory contains the Solidity smart contracts for the Social Quest Farcaster Mini App.

## Contracts

### SocialQuestSBT.sol
Soulbound Token (non-transferable NFT) that users mint after completing all social tasks.

**Key Features:**
- Non-transferable (Soulbound)
- One mint per address
- Signature-based verification (anti-cheat)
- Automatic lottery registration on mint

### SocialQuestLottery.sol
Lottery contract that manages prize distribution based on participant tiers.

**Prize Tiers:**
- Tier 1 (< 100 participants): 1 winner, $5 each
- Tier 2 (100-499 participants): 2 winners, $10 each
- Tier 3 (500-999 participants): 3 winners, $15 each
- Tier 4 (1000+ participants): 4 winners, $20 each

## Deployment

### Prerequisites
1. Install Foundry: https://book.getfoundry.sh/getting-started/installation
2. Install dependencies: `forge install OpenZeppelin/openzeppelin-contracts`

### Environment Variables
Create a `.env` file:
```bash
PRIVATE_KEY=your_deployer_private_key
SIGNER_ADDRESS=your_backend_signer_address
LOTTERY_DEADLINE=1735689600  # Unix timestamp
BASE_URI=https://your-domain.com/api/metadata/
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

### Deploy to Base Sepolia (Testnet)
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
```

### Deploy to Base Mainnet
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_RPC_URL --broadcast --verify
```

## After Deployment

1. Copy the deployed contract addresses
2. Update `client/src/lib/config.ts`:
   - `sbtContractAddress`: SBT contract address
   - `lotteryContractAddress`: Lottery contract address

3. Fund the lottery contract with prize money:
```bash
cast send <LOTTERY_ADDRESS> --value <AMOUNT_IN_WEI> --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY
```

## Security Considerations

1. **Signature Verification**: The SBT contract only mints if a valid backend signature is provided
2. **Nonce Protection**: Each mint signature can only be used once
3. **Soulbound**: Tokens cannot be transferred, only minted and burned
4. **Access Control**: Only owner can execute lottery and update settings
5. **Reentrancy Protection**: Both contracts use ReentrancyGuard

## Testing

```bash
forge test
```

## License

MIT
