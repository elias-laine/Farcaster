// ============================================
// CONFIGURATION FILE - EDIT THESE VALUES
// ============================================

export const APP_CONFIG = {
  // Cast to like and recast
  castHash: "0x28a80f62f8053b21fc247c68c8c62c2b4260ccc6",
  castUrl: "https://farcaster.com/hossein2001/0x28a80f62",
  
  // Account to follow
  targetFid: 958667,
  targetUsername: "hossein2001",
  
  // ============================================
  // SMART CONTRACT ADDRESSES
  // ============================================
  contractAddress: "0x72D7eC7607FF89c83c151d006BddA48101629987",
  
  // ============================================
  // NETWORK CONFIGURATION
  // ============================================
  chainId: 8453,
  chainName: "Base",
  explorerUrl: "https://basescan.org",
  rpcUrl: "https://mainnet.base.org",
  
  // ============================================
  // CHAINLINK VRF CONFIGURATION
  // ============================================
  // Subscription ID for Chainlink VRF (get from https://vrf.chain.link)
  vrfSubscriptionId: import.meta.env.VITE_VRF_SUBSCRIPTION_ID || "0",
  
  // VRF Coordinator address (Base Mainnet)
  vrfCoordinatorAddress: "0x5C210eF41CD1dBA2D1B6Cc2ab2CF7980f03edfB5",
  
  // ============================================
  // LOTTERY CONFIGURATION
  // ============================================
  defaultDeadline: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
} as const;

export const API_ENDPOINTS = {
  neynarBaseUrl: "https://api.neynar.com/v2/farcaster",
  verifyTask: "/api/verify-task",
  getMintSignature: "/api/mint-signature",
  getUserProgress: "/api/user-progress",
  getLotteryStats: "/api/lottery-stats",
} as const;

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
