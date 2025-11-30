# Social Quest - Farcaster Mini App

A Farcaster Mini App for social task campaigns with SBT minting and decentralized lottery system on Base network with **automatic prize distribution**.

## Overview

This app allows users to:
1. Complete three social tasks (like, recast, follow)
2. Mint a Soulbound Token (SBT) as proof of completion
3. Enter a decentralized lottery with tiered prizes based on participant count
4. **Automatic prize distribution to winners after lottery execution**

## Project Structure

```
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── FarcasterProvider.tsx  # Farcaster SDK wrapper
│   │   │   ├── Header.tsx     # App header with wallet connection
│   │   │   ├── TaskCard.tsx   # Individual task display
│   │   │   ├── ProgressIndicator.tsx  # Task progress bar
│   │   │   ├── MintSection.tsx # SBT minting UI with on-chain verification
│   │   │   └── LotteryStats.tsx # Lottery statistics display
│   │   ├── lib/
│   │   │   ├── config.ts      # ⚠️ EDIT THIS: App configuration
│   │   │   └── farcaster.ts   # Farcaster SDK utilities
│   │   └── pages/
│   │       ├── home.tsx       # Main user-facing page
│   │       └── admin.tsx      # Admin panel for lottery
│   └── public/
│       └── .well-known/
│           └── farcaster.json # ⚠️ EDIT THIS: Farcaster app manifest
├── contracts/                 # Solidity smart contracts (Foundry)
│   ├── src/
│   │   └── SocialQuest.sol    # Combined SBT + Lottery contract with Chainlink VRF ✅ SECURED
│   └── script/
│       └── Deploy.s.sol       # Deployment script with VRF setup
├── server/                    # Backend Express server
│   ├── routes.ts              # API routes with environment var config
│   └── storage.ts             # In-memory storage
└── shared/
    └── schema.ts              # Shared TypeScript types
```

## Recent Security Updates ✅

### Vulnerabilities Fixed:
1. **✅ Weak Randomness** → **Chainlink VRF Integration**
   - Replaced `block.timestamp + block.prevrandao` with Chainlink VRF
   - Guarantees cryptographically secure randomness
   - Cannot be manipulated by miners/validators

2. **✅ Reentrancy Risk** → **Address.sendValue + Checks-Effects-Interactions**
   - Replaced low-level `.call` with `Address.sendValue`
   - Automatic reentrancy protection
   - Prevents recursive attacks

3. **✅ Front-Run Depositor Risk** → **Whitelisted Assignment**
   - First depositor is recorded (only once)
   - Prevents front-running of depositor role

4. **✅ No Emergency Withdrawal** → **Emergency Withdrawal Function**
   - Depositor can withdraw if no participants
   - Prevents fund lockup

5. **✅ Insufficient Checks** → **All Parameters Immutable**
   - Signer address: immutable
   - Lottery deadline: immutable
   - VRF settings: immutable

## Required Environment Variables

Set these via Replit Secrets (Secrets tab):

### Critical - MUST SET

```bash
# Neynar API Key (for task verification)
NEYNAR_API_KEY=your_neynar_api_key_here

# Backend Signer Private Key
# Generate NEW wallet - NEVER use main wallet!
SIGNER_PRIVATE_KEY=0x...

# Task Configuration
CAST_HASH=0x...
TARGET_FID=123456

# Combined SocialQuest Contract Address (after deployment)
CONTRACT_ADDRESS=0x...
```

### Optional (will use defaults if not set)

```bash
# Chain ID (default: 8453 = Base Mainnet, use 84532 for Sepolia)
CHAIN_ID=8453

# RPC URL
RPC_URL=https://mainnet.base.org

# Chainlink VRF Subscription ID (from https://vrf.chain.link)
# Only needed if using actual Chainlink VRF
VRF_SUBSCRIPTION_ID=12345
```

## Configuration Files to Edit

### 1. Frontend Configuration (`client/src/lib/config.ts`)

```typescript
export const APP_CONFIG = {
  castHash: "YOUR_CAST_HASH",
  castUrl: "https://warpcast.com/...",
  targetFid: 123456,
  targetUsername: "yourhandle",
  contractAddress: "0x...",
  chainId: 8453,
  rpcUrl: "https://mainnet.base.org",
};
```

### 2. Farcaster Manifest (`client/public/.well-known/farcaster.json`)

After registering at https://warpcast.com/~/developers/mini-apps:

```json
{
  "accountAssociation": {
    "header": "YOUR_HEADER",
    "payload": "YOUR_PAYLOAD",
    "signature": "YOUR_SIGNATURE"
  },
  "frame": { ... }
}
```

## Setup Steps

### 1. Get API Keys & Configure

1. **Neynar API Key** - https://neynar.com/
2. **Backend Signer** - Generate NEW wallet (ethers.js or Remix)
3. **Chainlink VRF Subscription** - https://vrf.chain.link/
   - Create subscription
   - Get Subscription ID
   - Fund subscription with LINK tokens

### 2. Deploy Smart Contracts

With Chainlink VRF now integrated:

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Set environment variables
export SIGNER_ADDRESS=0x...          # Your signer wallet
export LOTTERY_DEADLINE=1764547200   # Timestamp in seconds
export BASE_URI=https://your-metadata-url/
export PRIVATE_KEY=0x...             # Deployment wallet key
export VRF_SUBSCRIPTION_ID=12345     # From https://vrf.chain.link

# Deploy to Base Sepolia (testnet)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast

# OR Deploy to Base Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast
```

### 3. Post-Deployment Setup

1. **Add Contract to VRF Subscription**
   - Go to https://vrf.chain.link
   - Select your subscription
   - Add the deployed contract address as consumer

2. **Fund the Lottery**
   ```bash
   # Send ETH to contract for prizes
   # Example: 1 ETH for 20 winners × $5
   ```

3. **Update Frontend Config**
   - Set `CONTRACT_ADDRESS` in `client/src/lib/config.ts`
   - Set environment variables for all required values

### 4. Deploy Application

```bash
# Local development
npm run dev

# Production
# Use Replit's publish feature or deploy to Vercel
```

## Prize Tiers

| Participants | Winners | Prize/Winner | Total Prize |
|-------------|---------|--------------|-------------|
| < 100       | 1       | $5 (5 ether) | $5          |
| 100-499     | 2       | $5 (5 ether) | $10         |
| 500-999     | 3       | $5 (5 ether) | $15         |
| 1000+       | 4       | $5 (5 ether) | $20         |

## How It Works Now (With Chainlink VRF)

### Execution Flow:
1. **User Phase**: Users complete tasks → Mint SBT → Registered for lottery
2. **Admin Phase**: After deadline, owner calls `executeLottery()`
3. **VRF Phase**: Contract requests random number from Chainlink
4. **Distribution Phase**: Chainlink callback distributes prizes automatically
5. **Refund Phase**: Remaining funds sent to depositor

## Security Features ✅

✅ **Chainlink VRF**: Cryptographically secure randomness
✅ **Reentrancy Guards**: OpenZeppelin ReentrancyGuard + checks-effects-interactions
✅ **Safe Transfers**: Address.sendValue prevents ETH theft
✅ **Immutable Parameters**: All critical values immutable after deployment
✅ **Emergency Withdrawal**: Depositor can withdraw if needed
✅ **Anti-Cheat**: Backend signature verification with nonces
✅ **Soulbound Tokens**: Non-transferable proof of completion

## API Endpoints

```
POST /api/verify-task
  Body: { fid: number, walletAddress: string, taskType: "like" | "recast" | "follow" }

POST /api/mint-signature
  Body: { fid: number, walletAddress: string }

GET /api/lottery-stats
  Returns blockchain or storage stats

GET /api/admin/participants
  Returns all participants from blockchain

POST /api/mint-confirmed
  Body: { fid: number, walletAddress: string, txHash: string }
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (backend + frontend)
npm run dev

# App runs on http://localhost:5000
```

## Recent Changes

- ✅ **Chainlink VRF Integration** - True randomness instead of block-based
- ✅ **Security Overhaul** - Reentrancy protection, safe transfers
- ✅ **Emergency Withdrawal** - Depositor can recover funds
- ✅ **Immutable Parameters** - All critical values locked after deployment
- ✅ **Address.sendValue** - Safe ETH transfers with no reentrancy risk

## User Preferences

- Primary framework: React + Tailwind CSS
- Backend: Express.js
- Smart contracts: Foundry (Solidity)
- Network: Base (L2)
- Design: Material Design 3 with purple theme
- Data: In-memory storage with blockchain verification fallback
- Language: Persian (Farsi) UI requests, English implementation
- Responsive design with proper spacing and typography

## Troubleshooting

### Chainlink VRF Errors
→ Ensure subscription ID is correct
→ Verify contract is added as consumer in VRF subscription
→ Check LINK tokens are available in subscription
→ Use https://vrf.chain.link to manage subscription

### Compilation Errors
→ Ensure @chainlink/contracts is installed
→ Verify Solidity version is 0.8.20+

### Prize Distribution Not Working
→ Verify contract has ETH balance
→ Check deadline has passed
→ Ensure participants list is not empty
→ Wait for Chainlink callback to complete (can take ~2 minutes)

### Contract Deployment Failing
→ Ensure you have ETH for gas on Base network
→ Use correct RPC URL for target network
→ Verify SIGNER_ADDRESS is valid
→ Check deployment wallet has sufficient balance

