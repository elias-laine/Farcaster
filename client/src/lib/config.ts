import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyTaskRequestSchema } from "@shared/schema";
import { ethers } from "ethers";

// ============================================
// CONFIGURATION - MUST BE SET VIA ENVIRONMENT VARIABLES
// ============================================
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`Warning: ${name} environment variable is not set. Using placeholder.`);
    return "";
  }
  return value;
}

const CONFIG = {
  // Neynar API key (get from https://neynar.com)
  NEYNAR_API_KEY: getRequiredEnv("NEYNAR_API_KEY"),

  // Backend signer private key for generating mint signatures
  // IMPORTANT: Keep this secret! Must be set via environment variable
  SIGNER_PRIVATE_KEY: getRequiredEnv("SIGNER_PRIVATE_KEY"),

  // Cast hash to verify like/recast
  CAST_HASH: process.env.CAST_HASH || "",

  // Target FID to verify follow
  TARGET_FID: parseInt(process.env.TARGET_FID || "0"),

  // Combined SocialQuest contract address - reads from VITE_CONTRACT_ADDRESS
  CONTRACT_ADDRESS: process.env.VITE_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || "",

  // RPC URL for blockchain queries (Base Mainnet or Sepolia)
  // Fallback to VITE_RPC_URL if RPC_URL is not set (useful for frontend-focused envs)
  RPC_URL: process.env.RPC_URL || process.env.VITE_RPC_URL || "https://mainnet.base.org",

  // Chain ID (8453 = Base Mainnet, 84532 = Base Sepolia)
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "8453"),
};

// Debug log config
console.log("==================================================");
console.log("[CONFIG] NEYNAR_API_KEY exists:", !!CONFIG.NEYNAR_API_KEY);
console.log("[CONFIG] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
console.log("[CONFIG] RPC_URL in use:", CONFIG.RPC_URL);
console.log("==================================================");

// Neynar API base URL
const NEYNAR_API_URL = "https://api.neynar.com/v2/farcaster";

// SocialQuest Contract ABI (combined SBT + Lottery)
const SOCIALQUEST_CONTRACT_ABI = [
  {
    name: "getLotteryStats",
    type: "function",
    inputs: [],
    outputs: [
      { name: "totalParticipants", type: "uint256" },
      { name: "currentWinnersCount", type: "uint256" },
      { name: "currentPrizePerWinner", type: "uint256" },
      { name: "currentTotalPrize", type: "uint256" },
      { name: "lotteryDeadline", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "executed", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    name: "getWinners",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    name: "getParticipants",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getAllPrizeTiers",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "minParticipants", type: "uint256" },
          { name: "maxParticipants", type: "uint256" },
          { name: "winnersCount", type: "uint256" },
          { name: "prizePerWinner", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

// Extended ABI just for reading owner
const EXTENDED_ABI = [
  ...SOCIALQUEST_CONTRACT_ABI,
  {
    name: "owner",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================
  // GET APP CONFIG (Frontend needs this)
  // ============================================
  app.get("/api/app-config", async (req, res) => {
    try {
      return res.json({
        castHash: CONFIG.CAST_HASH,
        targetFid: CONFIG.TARGET_FID,
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        chainId: CONFIG.CHAIN_ID,
        rpcUrl: CONFIG.RPC_URL,
      });
    } catch (error) {
      console.error("Error getting app config:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // CHECK MINT STATUS (Backend queries contract)
  // ============================================
  app.post("/api/check-mint-status", async (req, res) => {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing walletAddress" 
        });
      }

      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.json({ 
          hasMinted: false,
          message: "Contract not configured" 
        });
      }

      try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const contract = new ethers.Contract(
          CONFIG.CONTRACT_ADDRESS,
          SOCIALQUEST_CONTRACT_ABI,
          provider
        );

        const balance = await contract.balanceOf(walletAddress);
        const hasMinted = balance > BigInt(0);

        console.log(`[Check Mint Status] Wallet ${walletAddress} balance: ${balance.toString()}`);

        return res.json({ 
          success: true,
          hasMinted,
          balance: balance.toString(),
        });
      } catch (error) {
        console.error("[Check Mint Status] Contract error:", error);
        return res.json({ 
          success: false,
          hasMinted: false,
          message: "Failed to check mint status" 
        });
      }
    } catch (error) {
      console.error("Error checking mint status:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // GET USER PROGRESS
  // ============================================
  app.get("/api/user-progress", async (req, res) => {
    try {
      const fid = parseInt(req.query.fid as string);
      const walletAddress = req.query.walletAddress as string;

      if (!fid || !walletAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing fid or walletAddress" 
        });
      }

      let progress = await storage.getUserProgress(fid, walletAddress);

      if (!progress) {
        progress = await storage.createUserProgress(fid, walletAddress);
      }

      return res.json(progress);
    } catch (error) {
      console.error("Error getting user progress:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // VERIFY TASK
  // ============================================
  app.post("/api/verify-task", async (req, res) => {
    try {
      const parseResult = verifyTaskRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid request body",
          errors: parseResult.error.errors 
        });
      }

      const { taskType, fid, walletAddress } = parseResult.data;

      // Get or create user progress
      let progress = await storage.getUserProgress(fid, walletAddress);
      if (!progress) {
        progress = await storage.createUserProgress(fid, walletAddress);
      }

      // Check if task is already verified
      const existingTask = progress.tasks.find(t => t.type === taskType);
      if (existingTask?.status === "verified") {
        return res.json({ 
          success: true, 
          message: "Task already verified",
          task: existingTask 
        });
      }

      // Verify task with Neynar API
      let verified = false;
      let message = "";

      try {
        if (taskType === "like") {
          verified = await verifyLike(fid, CONFIG.CAST_HASH);
          message = verified ? "Like verified!" : "Cast not liked yet. Please like the cast first.";
        } else if (taskType === "recast") {
          verified = await verifyRecast(fid, CONFIG.CAST_HASH);
          message = verified ? "Recast verified!" : "Cast not recasted yet. Please recast first.";
        } else if (taskType === "follow") {
          verified = await verifyFollow(fid, CONFIG.TARGET_FID);
          message = verified ? "Follow verified!" : "Not following yet. Please follow the account first.";
        }
      } catch (error) {
        console.error(`Error verifying ${taskType}:`, error);

        if (error instanceof Error && error.message.includes("Missing configuration")) {
            return res.status(500).json({
                success: false,
                message: `Server Error: ${error.message}`
            });
        }

        return res.status(500).json({ 
          success: false, 
          message: "Failed to verify task due to an unexpected server error. Please try again." 
        });
      }

      if (verified) {
        const updatedProgress = await storage.updateTaskStatus(
          fid, 
          walletAddress, 
          taskType, 
          "verified"
        );

        const task = updatedProgress?.tasks.find(t => t.type === taskType);
        return res.json({ 
          success: true, 
          message,
          task 
        });
      }

      return res.json({ 
        success: false, 
        message 
      });
    } catch (error) {
      console.error("Error verifying task:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // GET MINT SIGNATURE
  // ============================================
  app.post("/api/mint-signature", async (req, res) => {
    try {
      const { walletAddress, fid } = req.body;

      if (!walletAddress || !fid) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing walletAddress or fid. Both are required." 
        });
      }

      if (!CONFIG.SIGNER_PRIVATE_KEY) {
        console.error("SIGNER_PRIVATE_KEY not configured");
        return res.status(500).json({ 
          success: false, 
          message: "Server configuration error. Please contact administrator." 
        });
      }

      if (!CONFIG.CONTRACT_ADDRESS) {
        console.error("CONTRACT_ADDRESS not configured");
        return res.status(500).json({ 
          success: false, 
          message: "Server configuration error. Please contact administrator." 
        });
      }

      const progress = await storage.getUserProgress(fid, walletAddress);

      if (!progress) {
        return res.status(400).json({ 
          success: false, 
          message: "User progress not found. Please complete all tasks first." 
        });
      }

      if (!progress.allTasksCompleted) {
        return res.status(403).json({ 
          success: false, 
          message: "You must complete all three tasks before minting. Anti-cheat protection active." 
        });
      }

      // 💡 UX FIX: We ONLY check if they have actually minted on-chain.
      // We removed the `signatureIssued` check to allow retries if tx is cancelled.
      if (progress.mintedAt) {
        return res.status(400).json({ 
          success: false, 
          message: "You have already minted your SBT." 
        });
      }

      // Generate a fresh nonce for every attempt
      const nonce = await storage.generateNonce();

      // Generate signature
      const signature = await generateMintSignature(
        walletAddress,
        nonce,
        CONFIG.CONTRACT_ADDRESS
      );

      return res.json({ 
        success: true, 
        signature,
        nonce,
        message: "Signature generated successfully" 
      });
    } catch (error) {
      console.error("Error generating mint signature:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // VERIFY OWNER OR DEPOSITOR
  // ============================================
  app.post("/api/verify-owner", async (req, res) => {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: "Missing walletAddress" });
      }

      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({ error: "Contract address not configured" });
      }

      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const contract = new ethers.Contract(
        CONFIG.CONTRACT_ADDRESS,
        SOCIALQUEST_CONTRACT_ABI,
        provider
      );

      const contractOwner = await contract.owner();
      const isOwner = contractOwner.toLowerCase() === walletAddress.toLowerCase();

      const [totalParticipants, , , , lotteryDeadline, isActive, isExecuted] = 
        await contract.getLotteryStats();

      const currentTime = Math.floor(Date.now() / 1000);
      const deadlinePassed = currentTime > Number(lotteryDeadline);
      const hasParticipants = Number(totalParticipants) > 0;

      const executionErrors = [];
      if (isExecuted) executionErrors.push("Lottery already executed");
      if (!deadlinePassed) executionErrors.push(`Deadline not passed (${Number(lotteryDeadline) - currentTime}s remaining)`);
      if (!hasParticipants) executionErrors.push("No participants registered");

      return res.json({
        walletAddress,
        contractOwner,
        isOwner,
        totalParticipants: Number(totalParticipants),
        deadlinePassed,
        hasParticipants,
        isActive,
        isExecuted,
        executionErrors,
        canExecute: !isExecuted && deadlinePassed && hasParticipants
      });
    } catch (error) {
      console.error("[Verify Owner] Error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        error: "Failed to verify authorization",
        details: errorMsg
      });
    }
  });

  // ============================================
  // GET LOTTERY STATS
  // ============================================
  app.get("/api/lottery-stats", async (req, res) => {
    try {
      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({ 
          success: false, 
          message: "Contract not deployed yet. Please deploy and set CONTRACT_ADDRESS." 
        });
      }

      try {
        const blockchainStats = await getLotteryStatsFromBlockchain();
        return res.json(blockchainStats);
      } catch (error) {
        console.error("[Lottery Stats] Failed to fetch from blockchain:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to fetch lottery deadline from blockchain",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error("Error getting lottery stats:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // GET PRIZE TIERS
  // ============================================
  app.get("/api/prize-tiers", async (req, res) => {
    try {
      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({ 
          success: false, 
          message: "Contract not deployed yet" 
        });
      }

      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const contract = new ethers.Contract(
        CONFIG.CONTRACT_ADDRESS,
        SOCIALQUEST_CONTRACT_ABI,
        provider
      );

      const tiers = await contract.getAllPrizeTiers();

      const tiersWithUsd = await Promise.all(
        tiers.map(async (tier: any) => {
          const prizeInUsd = await weiToUsd(tier.prizePerWinner);
          return {
            minParticipants: Number(tier.minParticipants),
            maxParticipants: Number(tier.maxParticipants),
            winnersCount: Number(tier.winnersCount),
            prizePerWinner: tier.prizePerWinner.toString(),
            prizePerWinnerUsd: Math.round(prizeInUsd * 100) / 100,
          };
        })
      );

      return res.json({
        success: true,
        tiers: tiersWithUsd,
      });
    } catch (error) {
      console.error("Error getting prize tiers:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch prize tiers",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // WEBHOOK: MINT CONFIRMED
  // ============================================
  app.post("/api/mint-confirmed", async (req, res) => {
    try {
      const { fid, walletAddress } = req.body;

      if (!fid || !walletAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing fid or walletAddress" 
        });
      }

      await storage.markUserMinted(fid, walletAddress);

      return res.json({ 
        success: true, 
        message: "Mint confirmed" 
      });
    } catch (error) {
      console.error("Error confirming mint:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  return httpServer;
}

// ============================================
// BLOCKCHAIN FUNCTIONS
// ============================================

// Chainlink price feed ABI for reading ETH/USD price
const CHAINLINK_FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
  },
] as const;

async function weiToUsd(weiAmount: bigint): Promise<number> {
  const FALLBACK_ETH_PRICE = 3100;

  try {
    // 💡 IMPORTANT: To avoid Rate Limit issues with public RPCs when Oracle fails,
    // we are temporarily bypassing the Oracle call and using a fixed price.
    // Uncomment the block below to restore Oracle functionality if you have a premium RPC.

    /*
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const priceFeedAddress = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // Base Mainnet ETH/USD
    const priceFeed = new ethers.Contract(priceFeedAddress, CHAINLINK_FEED_ABI, provider);
    const [, answer] = await priceFeed.latestRoundData();
    const ethPriceInUsd = Number(answer) / 10**8;
    const ethAmount = parseFloat(ethers.formatEther(weiAmount));
    return ethAmount * ethPriceInUsd;
    */

    // USING FALLBACK DIRECTLY FOR STABILITY
    console.log("[weiToUsd] Using fallback price logic to prevent Rate Limit");
    return parseFloat(ethers.formatEther(weiAmount)) * FALLBACK_ETH_PRICE;

  } catch (error) {
    console.warn("[weiToUsd] Error (using fallback):", error);
    return parseFloat(ethers.formatEther(weiAmount)) * FALLBACK_ETH_PRICE;
  }
}

async function getLotteryStatsFromBlockchain() {
  if (!CONFIG.CONTRACT_ADDRESS) {
    throw new Error("Contract address not configured");
  }

  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const contract = new ethers.Contract(
      CONFIG.CONTRACT_ADDRESS,
      SOCIALQUEST_CONTRACT_ABI,
      provider
    );

    const [
      totalParticipants,
      currentWinnersCount,
      currentPrizePerWinner,
      currentTotalPrize,
      lotteryDeadline,
      active,
      executed,
    ] = await contract.getLotteryStats();

    let winners: string[] | undefined;
    try {
      winners = await contract.getWinners();
    } catch (e) {
      console.warn("[Blockchain] Could not fetch winners:", e);
    }

    const prizePerWinnerUsd = await weiToUsd(currentPrizePerWinner);
    const totalPrizeUsd = await weiToUsd(currentTotalPrize);

    const currentTier = {
      minParticipants: 0,
      maxParticipants: undefined,
      winnersCount: Number(currentWinnersCount),
      prizePerWinner: Math.round(prizePerWinnerUsd * 100) / 100, 
      totalPrize: Math.round(totalPrizeUsd * 100) / 100, 
    };

    const stats = {
      totalParticipants: Number(totalParticipants),
      currentTier,
      deadline: Number(lotteryDeadline),
      isActive: active,
      isExecuted: executed,
      winners: winners && winners.length > 0 ? winners : undefined,
    };

    return stats;
  } catch (error) {
    console.error("[Blockchain] Error fetching stats:", error);
    throw error;
  }
}

// ============================================
// NEYNAR API VERIFICATION FUNCTIONS
// ============================================

async function verifyLike(fid: number, castHash: string): Promise<boolean> {
  try {
    console.log(`[verifyLike] Checking FID ${fid} for cast ${castHash}`);
    console.log(`[verifyLike] Using API Key: ${CONFIG.NEYNAR_API_KEY ? 'YES' : 'NO'}`);

    if (!CONFIG.NEYNAR_API_KEY) {
      console.warn("[verifyLike] NEYNAR_API_KEY not set. Test mode active.");
      return true;
    }

    const url = `${NEYNAR_API_URL}/cast?identifier=${castHash}&type=hash&viewer_fid=${fid}`;

    const response = await fetch(url, {
      headers: {
        "api_key": CONFIG.NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
        console.error(`[verifyLike] Neynar API error: ${response.status}`);
        return false;
    }

    const data = await response.json();
    return data.cast.viewer_context?.liked === true;

  } catch (error) {
    console.error("[verifyLike] Fetch error:", error);
    return false;
  }
}

async function verifyRecast(fid: number, castHash: string): Promise<boolean> {
  try {
    console.log(`[verifyRecast] Checking FID ${fid} for recast of ${castHash}`);

    if (!CONFIG.NEYNAR_API_KEY) {
      console.warn("[verifyRecast] NEYNAR_API_KEY not set. Test mode active.");
      return true;
    }

    const url = `${NEYNAR_API_URL}/cast?identifier=${castHash}&type=hash&viewer_fid=${fid}`;

    const response = await fetch(url, {
      headers: {
        "api_key": CONFIG.NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
        console.error(`[verifyRecast] Neynar API error: ${response.status}`);
        return false;
    }

    const data = await response.json();
    return data.cast.viewer_context?.recasted === true;

  } catch (error) {
    console.error("[verifyRecast] Fetch error:", error);
    return false;
  }
}

async function verifyFollow(fid: number, targetFid: number): Promise<boolean> {
  try {
    console.log(`[verifyFollow] Checking if FID ${fid} follows target ${targetFid}`);

    if (!CONFIG.NEYNAR_API_KEY) {
      console.warn("[verifyFollow] NEYNAR_API_KEY not set. Test mode active.");
      return true;
    }

    if (!targetFid || targetFid === 0) {
      console.error("[verifyFollow] Target FID is 0 or missing.");
      return false;
    }

    const url = `${NEYNAR_API_URL}/user/bulk?fids=${targetFid}&viewer_fid=${fid}`;

    const response = await fetch(url, {
        headers: { "api_key": CONFIG.NEYNAR_API_KEY },
    });

    if (!response.ok) {
        console.error(`[verifyFollow] Neynar API error: ${response.status}`);
        return false;
    }

    const data = await response.json();
    return data.users[0]?.viewer_context?.following === true; 

  } catch (error) {
    console.error("[verifyFollow] Fetch error:", error);
    return false;
  }
}

async function generateMintSignature(
    walletAddress: string,
    nonce: string,
    contractAddress: string
): Promise<string> {
    const wallet = new ethers.Wallet(CONFIG.SIGNER_PRIVATE_KEY);

    // Matches keccak256(abi.encodePacked(msg.sender, nonce, address(this))) in Solidity
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "address"],
      [walletAddress, nonce, contractAddress]
    );

    // Ethers v6 wallet.signMessage automatically adds the Ethereum prefix
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    return signature;
}