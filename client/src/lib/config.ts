// ============================================
// CONFIGURATION FILE - EDIT THESE VALUES
// ============================================

export const APP_CONFIG = {
  // Cast to like and recast
  // Change this to your cast hash (the unique identifier of your cast)
  castHash: "0x28a80f62f8053b21fc247c68c8c62c2b4260ccc6",
  
  // Cast URL for display (clickable link)
  // Change this to the full URL of your cast
  castUrl: "https://farcaster.com/hossein2001/0x28a80f62",
  
  // Account to follow
  // Change this to the Farcaster ID (FID) of the account users should follow
  targetFid: 958667,
  
  // Username of the account to follow (for display)
  targetUsername: "hossein2001",
  
  // ============================================
  // SMART CONTRACT ADDRESSES
  // ============================================
  // After deploying contracts, update these addresses
  
  // SBT Contract address on Base
  sbtContractAddress: "0x0000000000000000000000000000000000000000",
  
  // Lottery Contract address on Base
  lotteryContractAddress: "0x0000000000000000000000000000000000000000",
  
  // ============================================
  // NETWORK CONFIGURATION
  // ============================================
  // Use 8453 for Base Mainnet, 84532 for Base Sepolia (testnet)
  chainId: 8453,
  
  // Chain name for display
  chainName: "Base",
  
  // Block explorer URL
  explorerUrl: "https://basescan.org",
  
  // ============================================
  // LOTTERY CONFIGURATION
  // ============================================
  // Default deadline (timestamp in seconds)
  // This is managed by the smart contract, but shown in UI
  defaultDeadline: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Neynar API base URL
  neynarBaseUrl: "https://api.neynar.com/v2/farcaster",
  
  // Backend endpoints
  verifyTask: "/api/verify-task",
  getMintSignature: "/api/mint-signature",
  getUserProgress: "/api/user-progress",
  getLotteryStats: "/api/lottery-stats",
} as const;

// Export chain configuration for viem
export const BASE_CHAIN = {
  id: APP_CONFIG.chainId,
  name: APP_CONFIG.chainName,
  network: "base",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.base.org"],
    },
    public: {
      http: ["https://mainnet.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: APP_CONFIG.explorerUrl,
    },
  },
} as const;
