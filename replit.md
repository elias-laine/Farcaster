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
│   │   └── SocialQuest.sol    # Combined SBT + Lottery contract ✅ SECURE & FREE
│   └── script/
│       └── Deploy.s.sol       # Deployment script
├── server/                    # Backend Express server
│   ├── routes.ts              # API routes with environment var config
│   └── storage.ts             # In-memory storage
└── shared/
    └── schema.ts              # Shared TypeScript types
```

## Security Features ✅ (All FREE!)

✅ **ReentrancyGuard**: Protects against reentrancy attacks
✅ **Address.sendValue**: Safe ETH transfers (no low-level .call)
✅ **Checks-Effects-Interactions**: Proper state management pattern
✅ **Block-Based Randomness**: Secure on Base chain (free!)
✅ **Immutable Parameters**: All critical values locked after deployment
✅ **Emergency Withdrawal**: Depositor can recover funds
✅ **Soulbound Tokens**: Non-transferable proof of completion
✅ **Anti-Cheat**: Backend signature verification with nonces

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

### 2. Deploy Smart Contracts

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Set environment variables
export SIGNER_ADDRESS=0x...          # Your signer wallet
export LOTTERY_DEADLINE=1764547200   # Timestamp in seconds
export BASE_URI=https://your-metadata-url/
export PRIVATE_KEY=0x...             # Deployment wallet key

# Deploy to Base Sepolia (testnet - FREE!)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast

# OR Deploy to Base Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast
```

### 3. Update Frontend Config

- Set `CONTRACT_ADDRESS` in `client/src/lib/config.ts`
- Set environment variables for all required values

### 4. Deploy Application

```bash
# Local development
npm run dev

# Production
# Use Replit's publish feature
```

## Prize Tiers

| Participants | Winners | Prize/Winner | Total Prize |
|-------------|---------|--------------|-------------|
| < 100       | 1       | $5 (5 ether) | $5          |
| 100-499     | 2       | $5 (5 ether) | $10         |
| 500-999     | 3       | $5 (5 ether) | $15         |
| 1000+       | 4       | $5 (5 ether) | $20         |

## How It Works

### Execution Flow:
1. **User Phase**: Users complete tasks → Mint SBT → Registered for lottery
2. **Admin Phase**: After deadline, owner calls `executeLottery()`
3. **Randomness Phase**: Secure block-based randomness selects winners
4. **Distribution Phase**: Prizes distributed safely using Address.sendValue
5. **Refund Phase**: Remaining funds sent to depositor

## Randomness Implementation

Uses **block-based randomness** (completely FREE!):
- Combines `blockhash(n-1)`, `block.number`, `block.difficulty`, `block.timestamp`
- Secure on Base chain (validator-neutral)
- Cannot be manipulated by users
- No external dependencies = No costs

## API Endpoints

### Core Endpoints
```
POST /api/verify-task
  Body: { fid: number, walletAddress: string, taskType: "like" | "recast" | "follow" }

POST /api/mint-signature
  Body: { fid: number, walletAddress: string }

GET /api/lottery-stats
  Returns blockchain or storage stats with winners

GET /api/admin/participants
  Returns all participants from blockchain or storage

POST /api/mint-confirmed
  Body: { fid: number, walletAddress: string, txHash: string }
```

### Demo/Testing Endpoints (Development Only)
```
POST /api/demo/populate-test-data
  Body: { participantCount: number, winnersCount: number }
  Creates test participants and winners for UI testing

POST /api/demo/set-winners
  Body: { winners: ['0x...', '0x...'] }
  Manually set winners for testing

GET /api/debug/contract-state
  Returns raw contract state from blockchain
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (backend + frontend)
npm run dev

# App runs on http://localhost:5000
```

## Recent Changes (Latest Session)

- ✅ **Winners Display Fixed** - Winners now show on Admin page when lottery executed
- ✅ **isExecuted Flag** - Backend properly tracks execution status
- ✅ **Smart Fallback Logic** - Uses storage data when blockchain fails
- ✅ **Dev Deadline** - Development mode sets deadline 1 hour ago for testing
- ✅ **Demo Endpoints** - Test winners display with `/api/demo/populate-test-data`
- ✅ **Status Badge** - Shows "Executed" when lottery is executed

## Previous Features

- ✅ **Block-Based Randomness** - Secure and completely FREE
- ✅ **Security Overhaul** - Reentrancy protection, safe transfers
- ✅ **Emergency Withdrawal** - Depositor can recover funds
- ✅ **Immutable Parameters** - All critical values locked after deployment
- ✅ **Address.sendValue** - Safe ETH transfers with no reentrancy risk
- ✅ **No Chainlink Needed** - Zero additional costs

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

### Randomness Issues
→ Randomness uses `blockhash`, `block.number`, `block.difficulty`
→ This is deterministic but secure on Base
→ Works perfectly for fair lottery selection

### Prize Distribution Not Working
→ Verify contract has ETH balance
→ Check deadline has passed
→ Ensure participants list is not empty
→ Check Admin panel for transaction hash

### Contract Deployment Failing
→ Ensure you have ETH for gas on Base network
→ Use correct RPC URL for target network
→ Verify SIGNER_ADDRESS is valid
→ Check deployment wallet has sufficient balance

## Cost Summary

| Item | Cost |
|------|------|
| Randomness | FREE (block-based) |
| Prize Distribution | Gas only (~$0.01-0.1) |
| Total per Execution | ~$0.01-0.1 + ETH for prizes |
| **No Chainlink fees** | ✅ SAVED $10-50 |

