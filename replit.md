# Social Quest - Farcaster Mini App

A Farcaster Mini App for social task campaigns with SBT minting and lottery system on Base network.

## Overview

This app allows users to:
1. Complete three social tasks (like, recast, follow)
2. Mint a Soulbound Token (SBT) as proof of completion
3. Enter a lottery with tiered prizes based on participant count

## Project Structure

```
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── FarcasterProvider.tsx  # Farcaster SDK wrapper
│   │   │   ├── Header.tsx     # App header with wallet connection
│   │   │   ├── TaskCard.tsx   # Individual task display
│   │   │   ├── ProgressIndicator.tsx  # Task progress bar
│   │   │   ├── MintSection.tsx # SBT minting UI
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
│   │   ├── SocialQuestSBT.sol     # Soulbound Token contract
│   │   └── SocialQuestLottery.sol # Lottery contract
│   └── script/
│       └── Deploy.s.sol       # Deployment script
├── server/                    # Backend Express server
│   ├── routes.ts              # ⚠️ EDIT THIS: API routes & config
│   └── storage.ts             # In-memory storage
└── shared/
    └── schema.ts              # Shared TypeScript types
```

## Configuration Files to Edit

### 1. Frontend Configuration (`client/src/lib/config.ts`)

```typescript
export const APP_CONFIG = {
  // Cast to like and recast
  castHash: "YOUR_CAST_HASH",           // Hash of your cast
  castUrl: "https://warpcast.com/...",  // Full URL of your cast
  
  // Account to follow
  targetFid: 123456,                    // Farcaster ID to follow
  targetUsername: "yourhandle",         // Username for display
  
  // Contract addresses (after deployment)
  sbtContractAddress: "0x...",
  lotteryContractAddress: "0x...",
  
  // Network
  chainId: 8453,  // 8453 = Base Mainnet, 84532 = Base Sepolia
};
```

### 2. Backend Configuration (`server/routes.ts`)

```typescript
const CONFIG = {
  NEYNAR_API_KEY: "YOUR_NEYNAR_API_KEY",    // Get from neynar.com
  SIGNER_PRIVATE_KEY: "0x...",               // Backend signer for signatures
  CAST_HASH: "YOUR_CAST_HASH",
  TARGET_FID: 123456,
  SBT_CONTRACT_ADDRESS: "0x...",
};
```

### 3. Farcaster Manifest (`client/public/.well-known/farcaster.json`)

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

## Environment Variables

Set these in your environment or `.env` file:

```bash
# Neynar API (for task verification)
NEYNAR_API_KEY=your_neynar_api_key

# Backend signer (generate a new wallet for this)
SIGNER_PRIVATE_KEY=0x...

# Task configuration
CAST_HASH=0x...
TARGET_FID=123456

# Contract addresses (after deployment)
SBT_CONTRACT_ADDRESS=0x...
LOTTERY_CONTRACT_ADDRESS=0x...
```

## Deployment Steps

### 1. Deploy Smart Contracts

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_RPC_URL --broadcast --verify
```

### 2. Update Configuration

After deploying contracts:
1. Copy contract addresses
2. Update `client/src/lib/config.ts`
3. Update `server/routes.ts` CONFIG

### 3. Deploy Frontend

Deploy to Vercel:
```bash
vercel
```

### 4. Register Farcaster App

1. Go to https://warpcast.com/~/developers/mini-apps
2. Register your app
3. Copy the account association data to `farcaster.json`

## Prize Tiers

| Participants | Winners | Prize/Winner | Total Prize |
|-------------|---------|--------------|-------------|
| < 100       | 1       | $5           | $5          |
| 100-499     | 2       | $10          | $20         |
| 500-999     | 3       | $15          | $45         |
| 1000+       | 4       | $20          | $80         |

## Security Features

1. **Signature Verification**: Backend signs after verifying all tasks
2. **Nonce Protection**: Each signature can only be used once
3. **Soulbound Tokens**: SBTs cannot be transferred
4. **Task Order**: Tasks must be completed in sequence
5. **Deadline Enforcement**: Smart contract enforces lottery deadline

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Recent Changes

- Initial implementation with React frontend
- Farcaster SDK integration
- Smart contracts for SBT and Lottery
- Neynar API integration for task verification
- Admin panel for lottery execution

## User Preferences

- Primary framework: React + Tailwind CSS
- Backend: Express.js
- Smart contracts: Foundry (Solidity)
- Network: Base (L2)
