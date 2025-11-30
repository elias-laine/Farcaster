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
│   │   └── SocialQuest.sol    # Combined SBT + Lottery contract ✅ MERGED
│   └── script/
│       └── Deploy.s.sol       # Deployment script
├── server/                    # Backend Express server
│   ├── routes.ts              # API routes with environment var config
│   └── storage.ts             # In-memory storage
└── shared/
    └── schema.ts              # Shared TypeScript types
```

## Required Environment Variables

Set these via Replit Secrets (Secrets tab) or `.env` file:

### Critical - MUST SET

```bash
# Neynar API Key (for task verification)
# Get from: https://neynar.com/
NEYNAR_API_KEY=your_neynar_api_key_here

# Backend Signer Private Key
# IMPORTANT: Generate a NEW wallet address for this (not your main wallet)
# Format: 0x followed by 64 hex characters
SIGNER_PRIVATE_KEY=0x...

# Task Configuration
# CAST_HASH: The hash of the cast users must like/recast
# Format: 0x followed by hex characters
CAST_HASH=0x...

# TARGET_FID: Farcaster ID users must follow
# Get from: https://warpcast.com/~/developers/farcaster-id
TARGET_FID=123456

# Combined SocialQuest Contract Address (after deployment on Base)
# This single contract handles both SBT and Lottery
CONTRACT_ADDRESS=0x...
```

### Optional (will use defaults if not set)

```bash
# Defaults to Base Mainnet (8453)
CHAIN_ID=8453

# For Base Sepolia testnet (use 84532)
# CHAIN_ID=84532
```

## Configuration Files to Edit

### 1. Frontend Configuration (`client/src/lib/config.ts`)

```typescript
export const APP_CONFIG = {
  // Cast to like and recast
  castHash: "YOUR_CAST_HASH",           // Must match CAST_HASH env var
  castUrl: "https://warpcast.com/...",  // Full URL of your cast
  
  // Account to follow
  targetFid: 123456,                    // Must match TARGET_FID env var
  targetUsername: "yourhandle",         // Username for display
  
  // Combined SocialQuest Contract address (after deployment)
  contractAddress: "0x...",             // Must match CONTRACT_ADDRESS env var
  
  // Network
  chainId: 8453,  // 8453 = Base Mainnet, 84532 = Base Sepolia
  rpcUrl: "https://mainnet.base.org",   // RPC endpoint for blockchain queries
};
```

### 2. Farcaster Manifest (`client/public/.well-known/farcaster.json`)

After registering your app at https://warpcast.com/~/developers/mini-apps:

```json
{
  "accountAssociation": {
    "header": "YOUR_HEADER",
    "payload": "YOUR_PAYLOAD",
    "signature": "YOUR_SIGNATURE"
  },
  "frame": {
    "version": "1",
    "name": "Social Quest",
    "iconUrl": "https://your-domain.com/icon.png",
    "homeUrl": "https://your-domain.com",
    ...
  }
}
```

## Setup Steps

### 1. Get API Keys

1. **Neynar API Key**:
   - Go to https://neynar.com/
   - Sign up and get your API key
   - Set `NEYNAR_API_KEY` environment variable

2. **Backend Signer**:
   - Generate a NEW wallet (use ethers.js or Remix)
   - Export the private key
   - Set `SIGNER_PRIVATE_KEY` environment variable
   - **⚠️ Keep this private! Never share or commit it!**

### 2. Configure Task Details

1. Create or choose a cast to verify
2. Get its hash (from cast URL or Neynar API)
3. Choose an account to follow and get their FID
4. Set environment variables:
   - `CAST_HASH`
   - `TARGET_FID`

### 3. Deploy Smart Contracts

```bash
cd contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Set environment variables for deployment
export SIGNER_ADDRESS=0x...          # Your signer wallet
export LOTTERY_DEADLINE=1764547200   # Timestamp in seconds
export BASE_URI=https://your-metadata-url/
export PRIVATE_KEY=0x...             # Your deployment wallet private key

# Deploy combined SocialQuest contract to Base Testnet (Sepolia)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast

# OR Deploy to Base Mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast
```

**After deployment, copy the contract address and set:**
- `CONTRACT_ADDRESS` (single merged contract)

### 4. Fund the Lottery

After deployment, send ETH to the lottery contract address:
```bash
# Send funds directly to LOTTERY_CONTRACT_ADDRESS
# Example: Send 1 ETH to cover prizes
# The address that sends ETH will be recorded as the depositor
```

The funds will be held by the contract and automatically distributed when the lottery is executed.

### 5. Update Frontend Config

Update `client/src/lib/config.ts` with:
- Your cast hash and URL
- Target FID and username
- Combined contract address (CONTRACT_ADDRESS)
- Chain ID (8453 for Mainnet, 84532 for Sepolia)

### 6. Deploy Application

**For Local Development**:
```bash
npm run dev
# App runs on http://localhost:5000
```

**For Production**:
- Deploy to Vercel, Netlify, or similar
- Update manifest URL in `farcaster.json`
- Register app at https://warpcast.com/~/developers/mini-apps

## Prize Tiers

| Participants | Winners | Prize/Winner | Total Prize |
|-------------|---------|--------------|-------------|
| < 100       | 1       | $5 (5 ether) | $5          |
| 100-499     | 2       | $5 (5 ether) | $10         |
| 500-999     | 3       | $5 (5 ether) | $15         |
| 1000+       | 4       | $5 (5 ether) | $20         |

## How Automatic Prize Distribution Works

### 1. Funding Phase
- After deployment, send ETH directly to the lottery contract (via `receive()` function)
- The address that sends funds is recorded as the **depositor**
- Example: Send 1 ETH to cover 20 winners × $5 each

### 2. Lottery Execution Phase
- After deadline passes, owner calls `executeLottery()`
- Contract automatically:
  1. Selects random winners from participants
  2. **Transfers prize amount to each winner's wallet**
  3. **Returns remaining funds to the original depositor**

### 3. Transparency
- All transactions are on-chain and visible on block explorer
- Winners can verify their prize transfers immediately
- Depositor can verify refund of unused funds

## Security Features

✅ **Anti-Cheat Protection**:
- All three tasks must be completed before minting
- Backend verifies tasks via Neynar API
- Signature verification prevents unauthorized minting
- Each signature can only be used once (nonce protection)

✅ **Soulbound Tokens**:
- SBTs cannot be transferred (non-transferable)
- One SBT per wallet address
- Proves user completed all tasks

✅ **Deadline Enforcement**:
- Smart contract enforces lottery deadline
- Prevents entry after deadline
- **Immutable deadline** - cannot be changed

✅ **Automatic Prize Distribution**:
- Prizes automatically sent to winners on `executeLottery()`
- Remaining funds automatically refunded to depositor
- No owner withdrawal capabilities - fully transparent

✅ **On-Chain Verification**:
- MintSection checks blockchain to verify if wallet already has SBT
- Admin page fetches participants from smart contract
- Winners list stored on-chain and transparent

✅ **Immutable Parameters**:
- Signer address: **immutable** (cannot be changed)
- Lottery contract: **immutable** (cannot be changed)
- SBT contract: **immutable** (cannot be changed)
- Deadline: **immutable** (cannot be changed)

## API Endpoints

```
POST /api/verify-task
  Body: { fid: number, walletAddress: string, taskType: "like" | "recast" | "follow" }
  Returns: { success: boolean, message: string }

POST /api/mint-signature
  Body: { fid: number, walletAddress: string }
  Returns: { success: boolean, signature: string, nonce: number }

GET /api/lottery-stats
  Returns: { totalParticipants: number, currentTier: {...}, deadline: number, isActive: boolean }

GET /api/user-progress
  Query: ?fid=123&walletAddress=0x...
  Returns: { fid: number, tasks: {...}, allTasksCompleted: boolean, hasMinted: boolean }

GET /api/admin/participants
  Returns: [{ address: string, mintedAt: number, isWinner: boolean }, ...]

POST /api/mint-confirmed
  Body: { fid: number, walletAddress: string, txHash: string }
  Returns: { success: boolean, message: string }
```

## Development

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev

# Server runs on http://localhost:5000
# Frontend hot-reloads on changes
```

## Recent Changes

- ✅ **MAJOR REFACTOR** - Merged SBT + Lottery into single SocialQuest.sol contract
- ✅ **Single deployment** - Now deploys one contract instead of two (cheaper gas)
- ✅ **Updated all references** - Frontend/backend now use `contractAddress` instead of `sbtContractAddress` + `lotteryContractAddress`
- ✅ **Automatic prize distribution** - Prizes sent to winners automatically on `executeLottery()`
- ✅ **Remaining funds refund** - Leftover funds returned to depositor automatically
- ✅ **Immutable parameters** - All critical parameters immutable for security
- ✅ Admin participants list fetches from blockchain
- ✅ MintSection checks on-chain if wallet already minted
- ✅ All environment variables consolidated to use single `CONTRACT_ADDRESS`

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

### "NEYNAR_API_KEY not configured" error
→ Set the `NEYNAR_API_KEY` environment variable in Replit Secrets

### "SIGNER_PRIVATE_KEY not configured" error
→ Generate a private key and set `SIGNER_PRIVATE_KEY` environment variable

### Task verification failing
→ Verify your `CAST_HASH` and `TARGET_FID` are correct
→ Check Neynar API key has correct permissions

### Mint signature failing
→ Ensure all three tasks are marked as completed
→ Check that wallet address and FID are provided

### Contract deployment failing
→ Ensure you have ETH for gas on Base network
→ Use correct RPC URL for your target network

### Participants list empty on admin page
→ Ensure `CONTRACT_ADDRESS` environment variable is set
→ Verify users have minted SBTs on the blockchain

### Prize distribution not working
→ Ensure lottery contract has sufficient ETH balance
→ Verify deadline has passed before executing lottery
→ Check that participants list is not empty

### MintSection not showing correct status
→ Check that `SBT_CONTRACT_ADDRESS` is set in config
→ Verify RPC endpoint is working (`rpcUrl` in config)
