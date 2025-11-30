// ============================================
// CONFIGURATION - READS FROM ENVIRONMENT VARIABLES
// ============================================
// All values are read from environment variables (VITE_* prefix)
// No need to edit this file - just set environment variables!

const getEnvVar = (name: string, defaultValue: string = ""): string => {
  return import.meta.env[`VITE_${name}`] || defaultValue;
};

const getEnvVarNumber = (name: string, defaultValue: number = 0): number => {
  const value = import.meta.env[`VITE_${name}`];
  return value ? parseInt(value) : defaultValue;
};

export const APP_CONFIG = {
  // Cast to like and recast
  castHash: getEnvVar("CAST_HASH", "0x28a80f62f8053b21fc247c68c8c62c2b4260ccc6"),
  castUrl: getEnvVar("CAST_URL", "https://farcaster.com/hossein2001/0x28a80f62"),
  
  // Account to follow
  targetFid: getEnvVarNumber("TARGET_FID", 958667),
  targetUsername: getEnvVar("TARGET_USERNAME", "hossein2001"),
  
  // ============================================
  // SMART CONTRACT ADDRESSES
  // ============================================
  contractAddress: getEnvVar("CONTRACT_ADDRESS", "0x"),
  
  // ============================================
  // NETWORK CONFIGURATION
  // ============================================
  chainId: getEnvVarNumber("CHAIN_ID", 8453),
  chainName: getEnvVar("CHAIN_NAME", "Base"),
  explorerUrl: getEnvVar("EXPLORER_URL", "https://basescan.org"),
  rpcUrl: getEnvVar("RPC_URL", "https://mainnet.base.org"),
  
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
      http: [APP_CONFIG.rpcUrl],
    },
    public: {
      http: [APP_CONFIG.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: APP_CONFIG.chainName,
      url: APP_CONFIG.explorerUrl,
    },
  },
} as const;
