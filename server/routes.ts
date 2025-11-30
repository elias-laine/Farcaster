import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyTaskRequestSchema, mintSignatureRequestSchema } from "@shared/schema";
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
  
  // Combined SocialQuest contract address
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "",
  
  // RPC URL for blockchain queries (Base Mainnet or Sepolia)
  RPC_URL: process.env.RPC_URL || "https://mainnet.base.org",
  
  // Chain ID (8453 = Base Mainnet, 84532 = Base Sepolia)
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "8453"),
};

// Debug log config
console.log("[CONFIG] NEYNAR_API_KEY exists:", !!CONFIG.NEYNAR_API_KEY);
console.log("[CONFIG] CAST_HASH:", CONFIG.CAST_HASH);
console.log("[CONFIG] TARGET_FID:", CONFIG.TARGET_FID);
console.log("[CONFIG] SIGNER_PRIVATE_KEY exists:", !!CONFIG.SIGNER_PRIVATE_KEY);
console.log("[CONFIG] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
console.log("[CONFIG] RPC_URL:", CONFIG.RPC_URL);

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
] as const;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
        return res.status(500).json({ 
          success: false, 
          message: "Failed to verify task. Please try again." 
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

      // Validate required fields
      if (!walletAddress || !fid) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing walletAddress or fid. Both are required." 
        });
      }

      // Ensure signer private key is configured
      if (!CONFIG.SIGNER_PRIVATE_KEY) {
        console.error("SIGNER_PRIVATE_KEY not configured");
        return res.status(500).json({ 
          success: false, 
          message: "Server configuration error. Please contact administrator." 
        });
      }

      // Ensure contract address is configured
      if (!CONFIG.CONTRACT_ADDRESS) {
        console.error("CONTRACT_ADDRESS not configured");
        return res.status(500).json({ 
          success: false, 
          message: "Server configuration error. Please contact administrator." 
        });
      }

      // Get user progress with both fid and walletAddress
      const progress = await storage.getUserProgress(fid, walletAddress);

      if (!progress) {
        return res.status(400).json({ 
          success: false, 
          message: "User progress not found. Please complete all tasks first." 
        });
      }

      // Check if all tasks are completed (anti-cheat check)
      if (!progress.allTasksCompleted) {
        return res.status(403).json({ 
          success: false, 
          message: "You must complete all three tasks before minting. Anti-cheat protection active." 
        });
      }

      // Check if signature was already issued
      if (progress.signatureIssued) {
        return res.status(400).json({ 
          success: false, 
          message: "A mint signature has already been issued for this account." 
        });
      }

      // Check if already minted
      if (progress.mintedAt) {
        return res.status(400).json({ 
          success: false, 
          message: "You have already minted your SBT." 
        });
      }

      // Generate nonce
      const nonce = await storage.generateNonce();

      // Generate signature
      const signature = await generateMintSignature(
        walletAddress,
        nonce,
        CONFIG.CONTRACT_ADDRESS
      );

      // Mark signature as issued
      await storage.markSignatureIssued(progress.fid, walletAddress);

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
  // GET LOTTERY STATS (from Smart Contract or fallback to storage)
  // ============================================
  app.get("/api/lottery-stats", async (req, res) => {
    try {
      // Try to fetch from blockchain first if contract address is set
      if (CONFIG.CONTRACT_ADDRESS) {
        try {
          const blockchainStats = await getLotteryStatsFromBlockchain();
          return res.json(blockchainStats);
        } catch (error) {
          console.warn("Failed to fetch from blockchain, falling back to local storage:", error);
        }
      }
      
      // Fallback to local storage
      const stats = await storage.getLotteryStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error getting lottery stats:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // ADMIN: GET PARTICIPANTS (from Smart Contract or fallback to storage)
  // ============================================
  app.get("/api/admin/participants", async (req, res) => {
    try {
      // Try to fetch from blockchain first if contract address is set
      if (CONFIG.CONTRACT_ADDRESS) {
        try {
          const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
          const contract = new ethers.Contract(
            CONFIG.CONTRACT_ADDRESS,
            SOCIALQUEST_CONTRACT_ABI,
            provider
          );

          const participantAddresses = await contract.getParticipants();
          
          // Get winners for isWinner flag
          let winners: string[] = [];
          try {
            winners = await contract.getWinners();
          } catch {
            // If getWinners fails, just use empty array
          }

          const winnersSet = new Set(winners.map((w: string) => w.toLowerCase()));

          // Map addresses to participant objects
          const participants = participantAddresses.map((address: string) => ({
            address: address.toLowerCase(),
            mintedAt: Math.floor(Date.now() / 1000), // Fallback timestamp
            isWinner: winnersSet.has(address.toLowerCase()),
          }));

          return res.json(participants);
        } catch (error) {
          console.warn("Failed to fetch participants from blockchain, falling back to local storage:", error);
        }
      }
      
      // Fallback to local storage
      const participants = await storage.getParticipants();
      return res.json(participants);
    } catch (error) {
      console.error("Error getting participants:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // ============================================
  // WEBHOOK: Notify when mint is confirmed (called by frontend after successful tx)
  // ============================================
  app.post("/api/mint-confirmed", async (req, res) => {
    try {
      const { fid, walletAddress, txHash } = req.body;

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
// BLOCKCHAIN FUNCTIONS - Read Lottery Stats from Smart Contract
// ============================================

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

    console.log("[Blockchain] Fetching lottery stats from contract:", CONFIG.CONTRACT_ADDRESS);

    // Call getLotteryStats
    const [
      totalParticipants,
      currentWinnersCount,
      currentPrizePerWinner,
      currentTotalPrize,
      lotteryDeadline,
      active,
      executed,
    ] = await contract.getLotteryStats();

    // Get winners if lottery is executed
    let winners: string[] | undefined;
    if (executed) {
      try {
        winners = await contract.getWinners();
        if (winners) {
          console.log("[Blockchain] Winners count:", winners.length);
        }
      } catch (e) {
        console.warn("[Blockchain] Could not fetch winners:", e);
      }
    }

    const currentTier = {
      minParticipants: 0,
      maxParticipants: undefined,
      winnersCount: Number(currentWinnersCount),
      prizePerWinner: parseFloat(ethers.formatEther(currentPrizePerWinner)),
      totalPrize: parseFloat(ethers.formatEther(currentTotalPrize)),
    };

    const stats = {
      totalParticipants: Number(totalParticipants),
      currentTier,
      deadline: Number(lotteryDeadline),
      isActive: active,
      winners: winners && winners.length > 0 ? winners : undefined,
    };

    console.log("[Blockchain] Stats retrieved successfully:", {
      participants: stats.totalParticipants,
      deadline: new Date(stats.deadline * 1000).toISOString(),
      winners: winners?.length || 0,
    });

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
      console.error("[verifyLike] ERROR: NEYNAR_API_KEY is not set!");
      // For testing: allow verification if API key is missing
      console.log("[verifyLike] TEST MODE: Allowing verification without API key");
      return true;
    }
    
    const url = `${NEYNAR_API_URL}/cast?identifier=${castHash}&type=hash&viewer_fid=${fid}`;
    console.log(`[verifyLike] Fetching from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "api_key": CONFIG.NEYNAR_API_KEY,
      },
    });

    console.log(`[verifyLike] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[verifyLike] Neynar API error:", response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log("[verifyLike] API Response:", JSON.stringify(data, null, 2));
    
    // Check viewer_context.liked - this indicates if the current viewer liked the cast
    const hasLiked = data.cast?.viewer_context?.liked === true;
    console.log(`[verifyLike] FID ${fid} has liked: ${hasLiked}`);
    
    return hasLiked;
  } catch (error) {
    console.error("Error verifying like:", error);
    return false;
  }
}

async function verifyRecast(fid: number, castHash: string): Promise<boolean> {
  try {
    console.log(`[verifyRecast] Checking FID ${fid} for cast ${castHash}`);
    
    if (!CONFIG.NEYNAR_API_KEY) {
      console.log("[verifyRecast] TEST MODE: Allowing verification without API key");
      return true;
    }
    
    const response = await fetch(
      `${NEYNAR_API_URL}/cast?identifier=${castHash}&type=hash&viewer_fid=${fid}`,
      {
        headers: {
          "api_key": CONFIG.NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error("Neynar API error:", await response.text());
      return false;
    }

    const data = await response.json();
    
    // Check viewer_context.recasted - this indicates if the current viewer recasted the cast
    const hasRecasted = data.cast?.viewer_context?.recasted === true;
    console.log(`[verifyRecast] FID ${fid} has recasted: ${hasRecasted}`);
    
    return hasRecasted;
  } catch (error) {
    console.error("Error verifying recast:", error);
    return false;
  }
}

async function verifyFollow(fid: number, targetFid: number): Promise<boolean> {
  try {
    console.log(`[verifyFollow] Checking if FID ${fid} follows target FID ${targetFid}`);
    
    if (!CONFIG.NEYNAR_API_KEY) {
      console.log("[verifyFollow] TEST MODE: Allowing verification without API key");
      return true;
    }
    
    const response = await fetch(
      `${NEYNAR_API_URL}/user/bulk?fids=${targetFid}&viewer_fid=${fid}`,
      {
        headers: {
          "api_key": CONFIG.NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error("Neynar API error:", await response.text());
      return false;
    }

    const data = await response.json();
    const user = data.users?.[0];
    console.log("[verifyFollow] User data:", user?.viewer_context);
    
    // Check if the viewer (fid) is following the target user
    const isFollowing = user?.viewer_context?.following === true;
    console.log(`[verifyFollow] FID ${fid} follows target: ${isFollowing}`);
    
    return isFollowing;
  } catch (error) {
    console.error("Error verifying follow:", error);
    return false;
  }
}

// ============================================
// SIGNATURE GENERATION
// ============================================

async function generateMintSignature(
  walletAddress: string,
  nonce: number,
  contractAddress: string
): Promise<string> {
  const wallet = new ethers.Wallet(CONFIG.SIGNER_PRIVATE_KEY);
  
  // Create message hash matching the contract's verification
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "address"],
    [walletAddress, nonce, contractAddress]
  );

  // Sign the message
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));
  
  return signature;
}
