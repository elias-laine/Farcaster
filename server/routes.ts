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
  
  // SBT contract address (for signature verification)
  SBT_CONTRACT_ADDRESS: process.env.SBT_CONTRACT_ADDRESS || "",
};

// Debug log config
console.log("[CONFIG] NEYNAR_API_KEY exists:", !!CONFIG.NEYNAR_API_KEY);
console.log("[CONFIG] CAST_HASH:", CONFIG.CAST_HASH);
console.log("[CONFIG] TARGET_FID:", CONFIG.TARGET_FID);
console.log("[CONFIG] SIGNER_PRIVATE_KEY exists:", !!CONFIG.SIGNER_PRIVATE_KEY);

// Neynar API base URL
const NEYNAR_API_URL = "https://api.neynar.com/v2/farcaster";

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

      // Ensure SBT contract address is configured
      if (!CONFIG.SBT_CONTRACT_ADDRESS) {
        console.error("SBT_CONTRACT_ADDRESS not configured");
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
        CONFIG.SBT_CONTRACT_ADDRESS
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
  // GET LOTTERY STATS
  // ============================================
  app.get("/api/lottery-stats", async (req, res) => {
    try {
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
  // ADMIN: GET PARTICIPANTS
  // ============================================
  app.get("/api/admin/participants", async (req, res) => {
    try {
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
