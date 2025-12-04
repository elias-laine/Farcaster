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

  // Combined SocialQuest contract address - reads from VITE_CONTRACT_ADDRESS
  CONTRACT_ADDRESS: process.env.VITE_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || "",

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
  // VERIFY OWNER OR DEPOSITOR (Check if wallet can execute lottery)
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

      console.log("[Verify Owner] Checking wallet:", walletAddress);
      console.log("[Verify Owner] Contract:", CONFIG.CONTRACT_ADDRESS);
      console.log("[Verify Owner] RPC URL:", CONFIG.RPC_URL);

      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const contract = new ethers.Contract(
        CONFIG.CONTRACT_ADDRESS,
        SOCIALQUEST_CONTRACT_ABI,
        provider
      );

      console.log("[Verify Owner] Calling contract.owner()...");
      const contractOwner = await contract.owner();
      console.log("[Verify Owner] Got owner:", contractOwner);

      const isOwner = contractOwner.toLowerCase() === walletAddress.toLowerCase();

      // Get depositor address from contract storage (need to query event or direct read)
      // For now, we'll just check if wallet is owner
      // Authorization will be handled by smart contract itself

      // Also check pre-execution conditions
      console.log("[Verify Owner] Getting lottery stats...");
      const [totalParticipants, , , , lotteryDeadline, isActive, isExecuted] = 
        await contract.getLotteryStats();

      const currentTime = Math.floor(Date.now() / 1000);
      const deadlinePassed = currentTime > Number(lotteryDeadline);
      const hasParticipants = Number(totalParticipants) > 0;

      // Check execution conditions (contract will verify owner/depositor authorization)
      const executionErrors = [];
      if (isExecuted) executionErrors.push("Lottery already executed");
      if (!deadlinePassed) executionErrors.push(`Deadline not passed (${Number(lotteryDeadline) - currentTime}s remaining)`);
      if (!hasParticipants) executionErrors.push("No participants registered");

      console.log("[Verify Owner] Results:", { isOwner, deadlinePassed, hasParticipants, isExecuted });

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
      console.error("[Verify Owner] Error details:", errorMsg);
      return res.status(500).json({
        error: "Failed to verify authorization",
        details: errorMsg
      });
    }
  });

  // ============================================
  // GET LOTTERY STATS (from Smart Contract - deadline MUST come from contract)
  // ============================================
  app.get("/api/lottery-stats", async (req, res) => {
    try {
      // Must fetch from blockchain if contract is configured
      if (!CONFIG.CONTRACT_ADDRESS) {
        console.warn("[Lottery Stats] No contract address configured - cannot fetch deadline from blockchain");
        return res.status(400).json({ 
          success: false, 
          message: "Contract not deployed yet. Please deploy and set CONTRACT_ADDRESS." 
        });
      }

      try {
        const blockchainStats = await getLotteryStatsFromBlockchain();
        console.log("[Lottery Stats] Using blockchain data with deadline:", new Date(blockchainStats.deadline * 1000).toISOString());
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
  // GET PRIZE TIERS (from Smart Contract)
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

      // Convert tiers to USD for display
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
  // DEMO: Set sample winners for testing
  // ============================================
  app.post("/api/demo/set-winners", async (req, res) => {
    try {
      const { winners } = req.body;

      if (!winners || !Array.isArray(winners)) {
        return res.status(400).json({
          error: "Invalid request. Expected: { winners: ['0x...', '0x...'] }"
        });
      }

      // Set winners in storage
      await storage.setWinners(winners);

      return res.json({
        success: true,
        message: "Demo winners set successfully",
        winnersCount: winners.length,
        winners: winners,
      });
    } catch (error) {
      console.error("[Demo] Set winners error:", error);
      return res.status(500).json({
        error: "Failed to set winners",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // DEMO: Reset state for fresh testing
  // ============================================
  app.post("/api/demo/reset", async (req, res) => {
    try {
      // Create fresh storage (clears all data)
      const newStorage = new (require("./storage").MemStorage)();

      return res.json({
        success: true,
        message: "Demo state reset successfully - all data cleared",
      });
    } catch (error) {
      console.error("[Demo] Reset error:", error);
      return res.status(500).json({
        error: "Failed to reset state",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // DEMO: Set sample participants and winners for testing
  // ============================================
  app.post("/api/demo/populate-test-data", async (req, res) => {
    try {
      const participantCount = req.body.participantCount || 10;
      const winnersCount = req.body.winnersCount || 3;

      // Generate sample participants
      const participants: string[] = [];
      for (let i = 0; i < participantCount; i++) {
        const address = `0x${Math.random().toString(16).slice(2).padStart(40, '0')}`;
        participants.push(address);
        await storage.addParticipant(address);
      }

      // Select random winners
      const winners = participants.slice(0, winnersCount);
      await storage.setWinners(winners);

      return res.json({
        success: true,
        message: "Test data populated successfully",
        participantsCount: participantCount,
        winnersCount: winnersCount,
        winners: winners,
      });
    } catch (error) {
      console.error("[Demo] Populate test data error:", error);
      return res.status(500).json({
        error: "Failed to populate test data",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // DEBUG: Simple owner check endpoint
  // ============================================
  app.get("/api/debug/owner", async (req, res) => {
    try {
      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({
          error: "Contract address not configured",
        });
      }

      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const contract = new ethers.Contract(
        CONFIG.CONTRACT_ADDRESS,
        EXTENDED_ABI,
        provider
      );

      console.log("[Debug Owner] Attempting to read owner from contract...");
      const owner = await contract.owner();
      console.log("[Debug Owner] Successfully read owner:", owner);

      return res.json({
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        owner,
        rpcUrl: CONFIG.RPC_URL,
      });
    } catch (error) {
      console.error("[Debug] Owner fetch error:", error);
      return res.status(500).json({
        error: "Failed to fetch owner",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // DEBUG: Check contract state directly
  // ============================================
  app.get("/api/debug/contract-state", async (req, res) => {
    try {
      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({
          error: "Contract address not configured",
        });
      }

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

      let winners: string[] = [];
      try {
        winners = await contract.getWinners();
      } catch (e) {
        console.warn("Could not fetch winners:", e);
      }

      return res.json({
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        rpcUrl: CONFIG.RPC_URL,
        totalParticipants: Number(totalParticipants),
        currentWinnersCount: Number(currentWinnersCount),
        currentPrizePerWinner: ethers.formatEther(currentPrizePerWinner),
        lotteryDeadline: Number(lotteryDeadline),
        deadlineDate: new Date(Number(lotteryDeadline) * 1000).toISOString(),
        isActive: active,
        isExecuted: executed,
        winnersCount: winners.length,
        winners: winners,
        blockchainStatus: executed ? "EXECUTED" : (active ? "ACTIVE" : "INACTIVE"),
      });
    } catch (error) {
      console.error("[Debug] Contract state error:", error);
      return res.status(500).json({
        error: "Failed to fetch contract state",
        details: error instanceof Error ? error.message : String(error),
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

// Get ETH/USD price from Chainlink and convert wei to USD
async function weiToUsd(weiAmount: bigint): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const priceFeedAddress = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // Base Mainnet ETH/USD
    const priceFeed = new ethers.Contract(priceFeedAddress, CHAINLINK_FEED_ABI, provider);

    const [, answer] = await priceFeed.latestRoundData();
    // answer is in 8 decimals (e.g., 2500 * 10^8 for $2500)
    const ethPriceInUsd = Number(answer) / 10**8;

    // Convert wei to ETH then to USD
    const ethAmount = parseFloat(ethers.formatEther(weiAmount));
    return ethAmount * ethPriceInUsd;
  } catch (error) {
    console.warn("[weiToUsd] Error converting wei to USD:", error);
    // Fallback: assume $5 USD = 0.002 ETH (at $2500/ETH)
    return parseFloat(ethers.formatEther(weiAmount)) * 2500;
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

    // Always try to get winners (even if not executed yet)
    let winners: string[] | undefined;
    try {
      winners = await contract.getWinners();
      if (winners && winners.length > 0) {
        console.log("[Blockchain] Winners count:", winners.length);
      }
    } catch (e) {
      console.warn("[Blockchain] Could not fetch winners:", e);
    }

    // Convert wei amounts to USD
    const prizePerWinnerUsd = await weiToUsd(currentPrizePerWinner);
    const totalPrizeUsd = await weiToUsd(currentTotalPrize);

    const currentTier = {
      minParticipants: 0,
      maxParticipants: undefined,
      winnersCount: Number(currentWinnersCount),
      prizePerWinner: Math.round(prizePerWinnerUsd * 100) / 100, // Round to 2 decimals
      totalPrize: Math.round(totalPrizeUsd * 100) / 100, // Round to 2 decimals
    };

    const stats = {
      totalParticipants: Number(totalParticipants),
      currentTier,
      deadline: Number(lotteryDeadline),
      isActive: active,
      isExecuted: executed,
      winners: winners && winners.length > 0 ? winners : undefined,
    };

    console.log("[Blockchain] Stats retrieved successfully:", {
      participants: stats.totalParticipants,
      prizePerWinner: `$${currentTier.prizePerWinner} USD`,
      totalPrize: `$${currentTier.totalPrize} USD`,
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
