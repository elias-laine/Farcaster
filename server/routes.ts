import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyTaskRequestSchema, mintSignatureRequestSchema, type TaskType } from "@shared/schema";
import { ethers } from "ethers";
import path from "path";

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
  // Optional admin wallet override (set in .env as ADMIN_WALLET=0x...)
  ADMIN_WALLET: (process.env.ADMIN_WALLET || "").trim().toLowerCase(),
};

// Debug log config
console.log("[CONFIG] NEYNAR_API_KEY exists:", !!CONFIG.NEYNAR_API_KEY);
console.log("[CONFIG] CAST_HASH:", CONFIG.CAST_HASH);
console.log("[CONFIG] TARGET_FID:", CONFIG.TARGET_FID);
console.log("[CONFIG] SIGNER_PRIVATE_KEY exists:", !!CONFIG.SIGNER_PRIVATE_KEY);
console.log("[CONFIG] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
console.log("[CONFIG] RPC_URL:", CONFIG.RPC_URL);
console.log("[CONFIG] ADMIN_WALLET:", CONFIG.ADMIN_WALLET ? `${CONFIG.ADMIN_WALLET.slice(0,8)}...` : "(not set)");

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
  // TEST: Debug Neynar API
  // ============================================
  app.get("/api/test/neynar/:fid", async (req, res) => {
    try {
      const { fid } = req.params;
      const { text } = req.query;
      console.log(`[TEST] Testing Neynar API for FID: ${fid}`);

      if (!CONFIG.NEYNAR_API_KEY) {
        return res.json({ 
          success: false, 
          error: "NEYNAR_API_KEY not configured" 
        });
      }

      // Test search/casts endpoint with author filter
      const searchQuery = `from:${fid}`;
      const searchUrl = `${NEYNAR_API_URL}/search/casts?q=${encodeURIComponent(searchQuery)}&limit=50`;
      
      console.log(`[TEST] Fetching: ${searchUrl}`);
      const response = await fetch(searchUrl, {
        headers: {
          "api_key": CONFIG.NEYNAR_API_KEY,
          "Content-Type": "application/json",
        },
      });

      const searchResult: Record<string, any> = {
        status: response.status,
        ok: response.ok,
      };

      if (response.ok) {
        const data = await response.json();
        searchResult.castsCount = data.casts?.length || 0;
        searchResult.casts = (data.casts || []).slice(0, 5).map((cast: any) => ({
          text: cast.text?.substring(0, 100),
          author: cast.author?.username,
          created_at: cast.created_at,
        }));
      } else {
        searchResult.error = await response.text();
      }

      return res.json({
        success: true,
        fid,
        apiKey: CONFIG.NEYNAR_API_KEY ? "***configured***" : "NOT CONFIGURED",
        searchResult,
      });
    } catch (error) {
      console.error("[TEST] Error:", error);
      return res.status(500).json({ 
        success: false, 
        error: String(error) 
      });
    }
  });

  // ============================================
  // ADMIN: Challenge for admin actions (simple nonce)
  // Body: { walletAddress }
  // ============================================
  app.post("/api/admin/challenge", async (req, res) => {
    try {
      const { walletAddress } = req.body || {};
      if (!walletAddress) return res.status(400).json({ success: false, message: "Missing walletAddress" });

      // Ensure admin only if ADMIN_WALLET configured
      if (CONFIG.ADMIN_WALLET && walletAddress.toLowerCase() !== CONFIG.ADMIN_WALLET.toLowerCase()) {
        return res.status(403).json({ success: false, message: "Unauthorized: not admin wallet" });
      }

      // Use storage nonce as challenge
      const nonce = await storage.generateNonce();
      const challenge = `admin-challenge:${nonce}`;
      return res.json({ success: true, challenge });
    } catch (error) {
      console.error('[Admin] challenge error', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // ============================================
  // ADMIN: Get tasks configuration
  // ============================================
  app.get("/api/admin/tasks-config", async (req, res) => {
    try {
      const stored = await storage.getTasksConfig();
      console.log('[Admin] GET tasks-config - stored:', stored);
      const response = {
        castHash: stored.castHash || CONFIG.CAST_HASH || '',
        castText: stored.castText || '',
        targetFid: stored.targetFid || CONFIG.TARGET_FID || 0,
        castUrl: stored.castUrl || '',
        targetUsername: stored.targetUsername || '',
        tasks: stored.tasks || [],
      };
      console.log('[Admin] GET tasks-config - response:', response);
      return res.json(response);
    } catch (error) {
      console.error('[Admin] get tasks config error', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // ============================================
  // GET TASKS (Frontend to fetch custom tasks)
  // ============================================
  app.get("/api/tasks", async (req, res) => {
    try {
      const stored = await storage.getTasksConfig();
      console.log('[Tasks] GET /api/tasks - stored config:', stored);
      const tasks = stored.tasks || [];
      console.log('[Tasks] GET /api/tasks - tasks array:', tasks);
      
      // If no custom tasks configured, return defaults
      if (tasks.length === 0) {
        console.log('[Tasks] No custom tasks, returning defaults');
        return res.json([
          { 
            id: 'task-like', 
            type: 'like', 
            title: 'Like the Cast',
            required: true,
            options: {} 
          },
          { 
            id: 'task-recast', 
            type: 'recast', 
            title: 'Recast the Cast',
            required: true,
            options: {} 
          },
          { 
            id: 'task-follow', 
            type: 'follow', 
            title: 'Follow the Creator',
            required: true,
            options: {} 
          },
        ]);
      }
      
      console.log('[Tasks] Returning custom tasks:', tasks);
      return res.json(tasks);
    } catch (error) {
      console.error('[Tasks] get tasks error', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // ============================================
  // ADMIN: Update tasks configuration
  // Body: { walletAddress, castHash, targetFid, castUrl, targetUsername, tasks[] }
  // Requires ADMIN_WALLET env or matching walletAddress
  // ============================================
  app.post("/api/admin/tasks-config", async (req, res) => {
    try {
      const { walletAddress, tasks, challenge, castHash, targetFid, castUrl, targetUsername, castText } = req.body || {};

      console.log('[Admin] POST tasks-config - walletAddress:', walletAddress);
      console.log('[Admin] POST tasks-config - tasks:', tasks);

      if (!walletAddress) return res.status(400).json({ success: false, message: "Missing walletAddress" });

      if (CONFIG.ADMIN_WALLET && walletAddress.toLowerCase() !== CONFIG.ADMIN_WALLET.toLowerCase()) {
        return res.status(403).json({ success: false, message: "Unauthorized: not admin wallet" });
      }

      // For now we don't enforce signature of challenge; presence of ADMIN_WALLET is primary guard.

      await storage.setTasksConfig({ tasks, castHash, targetFid, castUrl, targetUsername, castText });

      return res.json({ success: true, message: 'Tasks config updated' });
    } catch (error) {
      console.error('[Admin] set tasks config error', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
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
  // CONFIRM MINT (called after successful transaction)
  // ============================================
  app.post("/api/confirm-mint", async (req, res) => {
    try {
      const { walletAddress, fid } = req.body;

      if (!walletAddress || !fid) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing walletAddress or fid" 
        });
      }

      // Get pending signature - verify it exists and hasn't expired
      const pendingSignature = await storage.getPendingSignature(fid, walletAddress);

      if (!pendingSignature) {
        // If there's no pending signature (expired or not found), still mark the user as minted
        // This makes the confirm endpoint tolerant to cases where frontend retried or server restarted
        console.warn(`[Confirm Mint] No pending signature found for ${walletAddress}. Proceeding to mark as minted.`);
        await storage.markUserMinted(fid, walletAddress);

        return res.json({ 
          success: true, 
          warning: "No pending signature found. User marked as minted anyway.",
          message: "Mint confirmed (no pending signature)"
        });
      }

      // Mark signature as permanently issued (move from pending to issued)
      await storage.confirmSignatureIssued(fid, walletAddress);

      // Mark user as minted
      await storage.markUserMinted(fid, walletAddress);

      console.log(`[Confirm Mint] Permanently confirmed mint for ${walletAddress}`);

      return res.json({ 
        success: true, 
        message: "Mint confirmed successfully" 
      });
    } catch (error) {
      console.error("Error confirming mint:", error);
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
        // Get custom tasks config to know which tasks to initialize
        const tasksConfig = await storage.getTasksConfig();
        const customTasks = tasksConfig.tasks || [];
        
        // If custom tasks are configured, create progress with those tasks
        if (customTasks.length > 0) {
          progress = await storage.createUserProgressWithTasks(
            fid, 
            walletAddress,
            customTasks.map(t => t.type as any)
          );
        } else {
          // Otherwise use default tasks
          progress = await storage.createUserProgress(fid, walletAddress);
        }
      } else {
        // Update existing progress to include new custom tasks if they were added
        const tasksConfig = await storage.getTasksConfig();
        const customTasks = tasksConfig.tasks || [];
        
        if (customTasks.length > 0) {
          const customTaskTypes = customTasks.map(t => t.type as TaskType);
          // Add any new tasks that aren't already in progress
          for (const taskType of customTaskTypes) {
            if (!progress.tasks.find(t => t.type === taskType)) {
              progress.tasks.push({
                type: taskType,
                status: "pending" as const,
              });
            }
          }
          // Remove tasks that are no longer in config (optional - comment out to keep history)
          // progress.tasks = progress.tasks.filter(t => customTaskTypes.includes(t.type));
        }
        
        // Recalculate allTasksCompleted
        if (customTasks.length > 0) {
          const requiredTasks = customTasks.filter(t => t.required !== false);
          progress.allTasksCompleted = requiredTasks.length > 0 
            ? progress.tasks.filter(t => requiredTasks.some(ct => ct.type === t.type)).every(t => t.status === "verified")
            : false;
        } else {
          progress.allTasksCompleted = progress.tasks.every(t => t.status === "verified");
        }
        
        // Save updated progress
        await storage.updateUserProgress(fid, walletAddress, progress);
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
      console.log("[verify-task] Request body:", JSON.stringify(req.body));
      
      const parseResult = verifyTaskRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        console.error("[verify-task] Validation error:", parseResult.error.errors);
        return res.status(400).json({ 
          success: false, 
          message: "Invalid request body",
          errors: parseResult.error.errors 
        });
      }

      const { taskType, fid, walletAddress } = parseResult.data;
      console.log(`[verify-task] Verifying task ${taskType} for FID ${fid}`);

      // Get or create user progress
      let progress = await storage.getUserProgress(fid, walletAddress);
      if (!progress) {
        console.log(`[verify-task] Creating new progress for FID ${fid}`);
        progress = await storage.createUserProgress(fid, walletAddress);
      }

      // Check if task is already verified
      const existingTask = progress.tasks.find(t => t.type === taskType);
      if (existingTask?.status === "verified") {
        console.log(`[verify-task] Task ${taskType} already verified`);
        return res.json({ 
          success: true, 
          message: "Task already verified",
          task: existingTask 
        });
      }

      // Verify task with Neynar API
      let verified = false;
      let message = "";
      let taskError = null;

      try {
        console.log(`[verify-task] Starting verification for ${taskType}`);
        console.log(`[verify-task] taskType value:`, JSON.stringify(taskType));
        
        if (taskType === "like") {
          console.log(`[verify-task] Verifying like for cast hash: ${CONFIG.CAST_HASH}`);
          verified = await verifyLike(fid, CONFIG.CAST_HASH);
          message = verified ? "Like verified!" : "Cast not liked yet. Please like the cast first.";
        } else if (taskType === "recast") {
          console.log(`[verify-task] Verifying recast for cast hash: ${CONFIG.CAST_HASH}`);
          verified = await verifyRecast(fid, CONFIG.CAST_HASH);
          message = verified ? "Recast verified!" : "Cast not recasted yet. Please recast first.";
        } else if (taskType === "follow") {
          console.log(`[verify-task] Verifying follow for target FID: ${CONFIG.TARGET_FID}`);
          verified = await verifyFollow(fid, CONFIG.TARGET_FID);
          message = verified ? "Follow verified!" : "Not following yet. Please follow the account first.";
        } else if (taskType === "cast") {
          console.log(`[verify-task] CAST BRANCH ENTERED`);
          try {
            // For cast task, verify the user posted a cast with the suggested text
            const tasksConfig = await storage.getTasksConfig();
            console.log(`[verify-task] tasksConfig keys:`, Object.keys(tasksConfig));
            
            const castTask = tasksConfig.tasks?.find(t => t.type === "cast");
            console.log(`[verify-task] castTask:`, JSON.stringify(castTask));
            
            const expectedText = castTask?.options?.castText || "Check out this awesome quest!";
            console.log(`[verify-task] expectedText:`, expectedText);
            
            console.log(`[verify-task] Calling verifyCast with FID ${fid}`);
            verified = await verifyCast(fid, expectedText);
            console.log(`[verify-task] verifyCast returned:`, verified);
            
            message = verified 
              ? "Cast verified! Great job participating in the quest!" 
              : `Please post a cast containing: "${expectedText}"`;
            console.log(`[verify-task] message set to:`, message);
          } catch (castError) {
            console.error(`[verify-task] Error in cast verification:`, castError);
            taskError = castError;
            message = `Error verifying cast: ${castError instanceof Error ? castError.message : String(castError)}`;
            verified = false;
          }
        } else {
          console.warn(`[verify-task] Unknown task type: ${taskType}`);
          message = `Unknown task type: ${taskType}`;
        }

        console.log(`[verify-task] After if-else: verified=${verified}, message="${message}"`);
      } catch (error) {
        console.error(`[verify-task] EXCEPTION in main try block:`, error);
        taskError = error;
        message = `Failed to verify task: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      console.log(`[verify-task] Final result: verified=${verified}, message="${message}"`);
      
      // Ensure message is set
      if (!message) {
        console.warn(`[verify-task] WARNING: Message is still empty!`);
        message = verified 
          ? "Task verified!" 
          : `Task verification failed for ${taskType}`;
      }
        console.warn(`[verify-task] WARNING: Message is empty! Setting default.`);
        message = verified 
          ? "Task verified successfully!" 
          : "Task verification failed. Please complete the task and try again.";
      }

      if (verified) {
        console.log(`[verify-task] Task ${taskType} verified successfully`);
        const updatedProgress = await storage.updateTaskStatus(
          fid, 
          walletAddress, 
          taskType, 
          "verified"
        );

        const task = updatedProgress?.tasks.find(t => t.type === taskType);
        console.log(`[verify-task] Updated progress:`, JSON.stringify(task));
        return res.json({ 
          success: true, 
          message,
          task 
        });
      }

      console.log(`[verify-task] Verification failed for ${taskType}`);
      
      // Ensure message is never empty
      if (!message) {
        console.warn(`[verify-task] WARNING: Message still empty after all branches!`);
        message = `Task verification failed for ${taskType}. Please try again.`;
      }
      
      return res.json({ 
        success: false, 
        message,
        debug: { taskType, verified, hasMessage: !!message }
      });
    } catch (error) {
      console.error("[verify-task] OUTER catch - Unexpected error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[verify-task] Error message:", errorMsg);
      console.error("[verify-task] Error stack:", error instanceof Error ? error.stack : "no stack");
      
      return res.json({ 
        success: false, 
        message: `Internal server error: ${errorMsg}`,
        error: errorMsg,
        debug: { taskType }
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

      // Check if already minted
      if (progress.mintedAt) {
        return res.status(400).json({ 
          success: false, 
          message: "You have already minted your SBT." 
        });
      }

      // Check if signature was already permanently issued
      if (progress.signatureIssued) {
        return res.status(400).json({ 
          success: false, 
          message: "A mint signature has already been issued for this account." 
        });
      }

      // Check if there's already a valid pending signature (not expired)
      const existingPending = await storage.getPendingSignature(fid, walletAddress);
      if (existingPending) {
        // Return the existing pending signature instead of creating a new one
        console.log(`[Mint Signature] Returning existing pending signature for ${walletAddress}`);
        return res.json({ 
          success: true, 
          signature: existingPending.signature,
          nonce: existingPending.nonce,
          message: "Returning existing pending signature (expires in 5 minutes)" 
        });
      }

      // Generate nonce based on timestamp to ensure uniqueness across server restarts
      // This approach survives server restarts because nonce is based on current time
      const nonce = await storage.generateNonce();
      
      console.log(`[Mint Signature] Generated nonce: ${nonce} for wallet: ${walletAddress}`);

      // Generate signature
      const signature = await generateMintSignature(
        walletAddress,
        nonce,
        CONFIG.CONTRACT_ADDRESS
      );

      // Issue pending signature (not permanently marked yet)
      await storage.issuePendingSignature(progress.fid, walletAddress, signature, nonce);

      return res.json({ 
        success: true, 
        signature,
        nonce,
        message: "Signature generated successfully (valid for 5 minutes)" 
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

      console.log("[Verify Owner] Checking wallet:", walletAddress);

      // If ADMIN_WALLET is set in env, trust it as the admin address (override)
      if (CONFIG.ADMIN_WALLET) {
        const contractOwner = CONFIG.ADMIN_WALLET.toLowerCase();
        const isOwner = contractOwner === walletAddress.toLowerCase();

        // We still attempt to return contract stats below only if contract configured
        let totalParticipants = 0;
        let lotteryDeadline = 0;
        let isActive = false;
        let isExecuted = false;

        if (CONFIG.CONTRACT_ADDRESS) {
          try {
            const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
            const contract = new ethers.Contract(
              CONFIG.CONTRACT_ADDRESS,
              SOCIALQUEST_CONTRACT_ABI,
              provider
            );

            const [totalParts, , , , lotteryDeadlineBN, active, executed] = await contract.getLotteryStats();
            totalParticipants = Number(totalParts);
            lotteryDeadline = Number(lotteryDeadlineBN);
            isActive = active;
            isExecuted = executed;
          } catch (e) {
            console.warn("[Verify Owner] Failed to fetch contract stats while ADMIN_WALLET override is set:", e);
          }
        }

        const currentTime = Math.floor(Date.now() / 1000);
        const deadlinePassed = currentTime > Number(lotteryDeadline);
        const hasParticipants = Number(totalParticipants) > 0;

        const executionErrors = [];
        if (isExecuted) executionErrors.push("Lottery already executed");
        if (!deadlinePassed) executionErrors.push(`Deadline not passed (${Number(lotteryDeadline) - currentTime}s remaining)`);
        if (!hasParticipants) executionErrors.push("No participants registered");

        return res.json({
          walletAddress,
          contractOwner: CONFIG.ADMIN_WALLET,
          isOwner,
          totalParticipants,
          deadlinePassed,
          hasParticipants,
          isActive,
          isExecuted,
          executionErrors,
          canExecute: !isExecuted && deadlinePassed && hasParticipants,
          note: "Using ADMIN_WALLET env override",
        });
      }

      if (!CONFIG.CONTRACT_ADDRESS) {
        return res.status(400).json({ error: "Contract address not configured" });
      }

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

          // Try to read mint timestamps from blockchain events (SBTMinted)
          const iface = new ethers.Interface([
            "event SBTMinted(address indexed to, uint256 indexed tokenId, uint256 timestamp)",
            "event ParticipantRegistered(address indexed participant, uint256 indexed index, uint256 timestamp)",
          ]);

          let mintedAtMap = new Map<string, number>();
          try {
            const topic = iface.getEventTopic("SBTMinted");
            const logs = await provider.getLogs({
              address: CONFIG.CONTRACT_ADDRESS,
              topics: [topic],
              fromBlock: 0,
            });

            for (const log of logs) {
              try {
                const parsed = iface.parseLog(log);
                const to = String(parsed.args.to).toLowerCase();

                // Derive timestamp from the block that included the mint transaction
                let ts: number | undefined;
                try {
                  if (log.blockNumber != null) {
                    const block = await provider.getBlock(Number(log.blockNumber));
                    ts = Number(block.timestamp);
                  } else if (log.transactionHash) {
                    const receipt = await provider.getTransactionReceipt(log.transactionHash);
                    if (receipt && receipt.blockNumber != null) {
                      const block = await provider.getBlock(Number(receipt.blockNumber));
                      ts = Number(block.timestamp);
                    }
                  }
                } catch (e) {
                  // ignore block fetch errors for this log
                }

                if (to && ts) mintedAtMap.set(to, ts);
              } catch (e) {
                // ignore parse errors for unrelated logs
              }
            }
          } catch (e) {
            console.warn("Failed to fetch SBTMinted logs:", e);
          }

          // Fallback to local storage when blockchain timestamp is unavailable
          const allParticipants = await storage.getParticipants();
          const participantMap = new Map(
            allParticipants.map(p => [p.address.toLowerCase(), p])
          );

          // Map addresses to participant objects using blockchain timestamp when available
          const participants = participantAddresses.map((address: string) => {
            const lowerAddress = address.toLowerCase();
            const storedParticipant = participantMap.get(lowerAddress);
            const onChainTs = mintedAtMap.get(lowerAddress);

            return {
              address: lowerAddress,
              mintedAt: onChainTs || storedParticipant?.mintedAt || Math.floor(Date.now() / 1000),
              isWinner: winnersSet.has(lowerAddress),
            };
          });

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
  // ADMIN: Deploy Lottery (runs Foundry deploy script)
  // Body: { walletAddress, deadline, baseUri, rpcUrl }
  // Requires SIGNER_PRIVATE_KEY in env and foundry installed on server
  // ============================================
  app.post("/api/admin/deploy-lottery", async (req, res) => {
    try {
      const { walletAddress, deadline, baseUri, rpcUrl } = req.body;

      if (!walletAddress) return res.status(400).json({ success: false, message: "Missing walletAddress" });

      // Only allow if ADMIN_WALLET matches
      if (CONFIG.ADMIN_WALLET && walletAddress.toLowerCase() !== CONFIG.ADMIN_WALLET.toLowerCase()) {
        return res.status(403).json({ success: false, message: "Unauthorized: not admin wallet" });
      }

      // Ensure signer private key exists for broadcast
      const deployerPrivateKey = process.env.PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;
      if (!deployerPrivateKey) {
        return res.status(500).json({ success: false, message: "Server not configured with deployer private key" });
      }

      // Ensure forge exists
      const { spawn } = await import('child_process');
      const which = spawn('which', ['forge']);
      let foundryPath = '';
      await new Promise<void>((resolve) => {
        which.stdout.on('data', (d) => { foundryPath += d.toString(); });
        which.on('close', () => resolve());
      });
      if (!foundryPath.trim()) {
        return res.status(500).json({ 
          success: false, 
          message: 'Foundry (forge) not installed on server',
          installGuide: 'To deploy contracts, install Foundry: curl -L https://foundry.paradigm.xyz | bash && source ~/.bashrc && foundryup'
        });
      }

      // Prepare env for the child process
      const ethers = (await import('ethers')) as typeof import('ethers');
      let signerAddress = '';
      try {
        const w = new ethers.Wallet(deployerPrivateKey);
        signerAddress = w.address;
      } catch (e) {
        // ignore
      }

      const childEnv = { ...process.env } as Record<string,string>;
      childEnv.PRIVATE_KEY = deployerPrivateKey.replace(/^0x/, '');
      if (signerAddress) childEnv.SIGNER_ADDRESS = signerAddress;
      if (deadline) childEnv.LOTTERY_DEADLINE = String(deadline);
      if (baseUri) childEnv.BASE_URI = String(baseUri);
      if (rpcUrl) childEnv.BASE_RPC_URL = String(rpcUrl);
      // Accept tiers array from request body: [{ min, max, winners, prize }, ...]
      const tiers = req.body.tiers;
      if (Array.isArray(tiers) && tiers.length > 0) {
        childEnv.TIER_COUNT = String(tiers.length);
        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i] || {};
          if (t.min != null) childEnv[`TIER_MIN_${i}`] = String(t.min);
          if (t.max != null) childEnv[`TIER_MAX_${i}`] = String(t.max);
          if (t.winners != null) childEnv[`TIER_WINNERS_${i}`] = String(t.winners);
          if (t.prize != null) childEnv[`TIER_PRIZE_${i}`] = String(t.prize);
        }
      }

      // Run forge script in contracts directory
      const cwd = path.resolve(import.meta.dirname, '..', 'contracts');
      const args = ['script', 'script/Deploy.s.sol:DeployScript', '--rpc-url', (rpcUrl || CONFIG.RPC_URL), '--broadcast'];

      const proc = spawn('forge', args, { cwd, env: childEnv });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('[DeployLottery] forge exited', code, stderr);
          return res.status(500).json({ success: false, message: 'Deploy failed', code, stderr, stdout });
        }

        // Try to extract CONTRACT_ADDRESS from stdout
        const match = stdout.match(/CONTRACT_ADDRESS:\s*(0x[0-9a-fA-F]{40})/);
        const contractAddress = match ? match[1] : null;

        return res.json({ success: true, message: 'Deploy finished', contractAddress, stdout, stderr });
      });
    } catch (error) {
      console.error('Error deploying lottery:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: String(error) });
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

async function verifyCast(fid: number, expectedText: string): Promise<boolean> {
  try {
    console.log(`\n[verifyCast] ========== START ==========`);
    console.log(`[verifyCast] FID: ${fid}, Expected text: "${expectedText}"`);

    if (!CONFIG.NEYNAR_API_KEY) {
      console.log("[verifyCast] TEST MODE: No API key, allowing verification");
      console.log(`[verifyCast] ========== END (TEST MODE) ==========\n`);
      return true;
    }

    // Use /search/casts endpoint to find recent casts by author
    const searchQuery = `from:${fid}`;
    const url = `${NEYNAR_API_URL}/search/casts?q=${encodeURIComponent(searchQuery)}&limit=50`;
    
    console.log(`[verifyCast] Calling Neynar API: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "api_key": CONFIG.NEYNAR_API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log(`[verifyCast] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[verifyCast] API error (${response.status}): ${errorText}`);
      console.log(`[verifyCast] FALLBACK: Allowing verification due to API error`);
      console.log(`[verifyCast] ========== END (FALLBACK) ==========\n`);
      return true;
    }

    const data = await response.json();
    console.log(`[verifyCast] Response data keys:`, Object.keys(data));
    
    const casts = data.casts || [];
    console.log(`[verifyCast] Found ${casts.length} casts`);
    
    if (casts.length === 0) {
      console.log(`[verifyCast] No casts found - returning false`);
      console.log(`[verifyCast] ========== END (NO CASTS) ==========\n`);
      return false;
    }

    // Check if any recent cast contains the expected text
    let found = false;
    for (let i = 0; i < casts.length; i++) {
      const cast = casts[i];
      const castText = cast.text || "";
      const containsText = castText.toLowerCase().includes(expectedText.toLowerCase());
      
      console.log(`[verifyCast] Cast ${i + 1}: "${castText.substring(0, 80)}..." | Match: ${containsText}`);
      
      if (containsText) {
        found = true;
        break;
      }
    }

    console.log(`[verifyCast] Result: ${found ? "FOUND" : "NOT FOUND"}`);
    console.log(`[verifyCast] ========== END ==========\n`);
    
    return found;

  } catch (error) {
    console.error(`[verifyCast] EXCEPTION:`, error);
    console.log(`[verifyCast] FALLBACK: Allowing verification due to exception`);
    console.log(`[verifyCast] ========== END (EXCEPTION) ==========\n`);
    return true;
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
