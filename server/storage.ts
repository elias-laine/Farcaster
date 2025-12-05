import type { Task, TaskType, UserProgress, LotteryStats } from "@shared/schema";
import { getCurrentTier } from "@shared/schema";
import { randomUUID } from "crypto";

export interface PendingSignature {
  walletAddress: string;
  fid: number;
  signature: string;
  nonce: number;
  issuedAt: number;
  expiresAt: number;
}

export interface IStorage {
  // User progress
  getUserProgress(fid: number, walletAddress: string): Promise<UserProgress | undefined>;
  createUserProgress(fid: number, walletAddress: string): Promise<UserProgress>;
  updateTaskStatus(fid: number, walletAddress: string, taskType: TaskType, status: "pending" | "verified" | "failed"): Promise<UserProgress | undefined>;
  markUserMinted(fid: number, walletAddress: string): Promise<UserProgress | undefined>;
  markSignatureIssued(fid: number, walletAddress: string): Promise<UserProgress | undefined>;
  
  // Lottery
  getLotteryStats(): Promise<LotteryStats>;
  getParticipants(): Promise<{ address: string; mintedAt: number; isWinner: boolean }[]>;
  addParticipant(walletAddress: string): Promise<void>;
  setWinners(winners: string[]): Promise<void>;
  
  // Nonces
  isNonceUsed(nonce: number): Promise<boolean>;
  markNonceUsed(nonce: number): Promise<void>;
  generateNonce(): Promise<number>;

  // Pending signatures (temporary, with TTL)
  issuePendingSignature(fid: number, walletAddress: string, signature: string, nonce: number): Promise<void>;
  getPendingSignature(fid: number, walletAddress: string): Promise<PendingSignature | undefined>;
  confirmSignatureIssued(fid: number, walletAddress: string): Promise<void>;
  cleanupExpiredSignatures(): Promise<void>;
}

const TASK_TYPES: TaskType[] = ["like", "recast", "follow"];

export class MemStorage implements IStorage {
  private userProgress: Map<string, UserProgress>;
  private participants: Map<string, { mintedAt: number; isWinner: boolean }>;
  private usedNonces: Set<number>;
  private winners: string[];
  private nonceCounter: number;
  private walletNonces: Map<string, number>; // Track nonces per wallet to ensure uniqueness
  private pendingSignatures: Map<string, PendingSignature>; // walletAddress -> PendingSignature
  private readonly SIGNATURE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.userProgress = new Map();
    this.participants = new Map();
    this.usedNonces = new Set();
    this.winners = [];
    this.nonceCounter = Math.floor(Date.now() / 1000); // Start from current timestamp
    this.walletNonces = new Map();
    this.pendingSignatures = new Map();

    // Auto cleanup expired signatures every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSignatures().catch(err => 
        console.error("[Storage] Error cleaning up expired signatures:", err)
      );
    }, 60 * 1000);
  }

  private getKey(fid: number, walletAddress: string): string {
    return `${fid}-${walletAddress.toLowerCase()}`;
  }

  private getPendingSignatureKey(walletAddress: string): string {
    return walletAddress.toLowerCase();
  }

  async getUserProgress(fid: number, walletAddress: string): Promise<UserProgress | undefined> {
    const key = this.getKey(fid, walletAddress);
    return this.userProgress.get(key);
  }

  async createUserProgress(fid: number, walletAddress: string): Promise<UserProgress> {
    const key = this.getKey(fid, walletAddress);
    
    const progress: UserProgress = {
      fid,
      walletAddress: walletAddress.toLowerCase(),
      tasks: TASK_TYPES.map(type => ({
        type,
        status: "pending" as const,
      })),
      allTasksCompleted: false,
      signatureIssued: false,
    };

    this.userProgress.set(key, progress);
    return progress;
  }

  async updateTaskStatus(
    fid: number, 
    walletAddress: string, 
    taskType: TaskType, 
    status: "pending" | "verified" | "failed"
  ): Promise<UserProgress | undefined> {
    const key = this.getKey(fid, walletAddress);
    const progress = this.userProgress.get(key);
    
    if (!progress) return undefined;

    const taskIndex = progress.tasks.findIndex(t => t.type === taskType);
    if (taskIndex === -1) return undefined;

    progress.tasks[taskIndex] = {
      ...progress.tasks[taskIndex],
      status,
      verifiedAt: status === "verified" ? Math.floor(Date.now() / 1000) : undefined,
    };

    // Check if all tasks are completed
    progress.allTasksCompleted = progress.tasks.every(t => t.status === "verified");

    this.userProgress.set(key, progress);
    return progress;
  }

  async markUserMinted(fid: number, walletAddress: string): Promise<UserProgress | undefined> {
    const key = this.getKey(fid, walletAddress);
    const progress = this.userProgress.get(key);
    
    if (!progress) return undefined;

    progress.mintedAt = Math.floor(Date.now() / 1000);
    this.userProgress.set(key, progress);
    
    // Also add to participants
    await this.addParticipant(walletAddress);
    
    return progress;
  }

  async markSignatureIssued(fid: number, walletAddress: string): Promise<UserProgress | undefined> {
    const key = this.getKey(fid, walletAddress);
    const progress = this.userProgress.get(key);
    
    if (!progress) return undefined;

    progress.signatureIssued = true;
    this.userProgress.set(key, progress);
    
    return progress;
  }

  async getLotteryStats(): Promise<LotteryStats> {
    const totalParticipants = this.participants.size;
    const currentTier = getCurrentTier(totalParticipants);
    const isExecuted = this.winners.length > 0;
    
    return {
      totalParticipants,
      currentTier,
      deadline: 0, // Deadline must come from blockchain
      isActive: false,
      isExecuted,
      winners: this.winners.length > 0 ? this.winners : undefined,
    };
  }

  async getParticipants(): Promise<{ address: string; mintedAt: number; isWinner: boolean }[]> {
    return Array.from(this.participants.entries()).map(([address, data]) => ({
      address,
      mintedAt: data.mintedAt,
      isWinner: data.isWinner,
    }));
  }

  async addParticipant(walletAddress: string): Promise<void> {
    const address = walletAddress.toLowerCase();
    if (!this.participants.has(address)) {
      this.participants.set(address, {
        mintedAt: Math.floor(Date.now() / 1000),
        isWinner: false,
      });
    }
  }

  async setWinners(winners: string[]): Promise<void> {
    this.winners = winners.map(w => w.toLowerCase());
    
    // Update participant records
    for (const winner of this.winners) {
      const participant = this.participants.get(winner);
      if (participant) {
        participant.isWinner = true;
        this.participants.set(winner, participant);
      }
    }
  }

  async isNonceUsed(nonce: number): Promise<boolean> {
    return this.usedNonces.has(nonce);
  }

  async markNonceUsed(nonce: number): Promise<void> {
    this.usedNonces.add(nonce);
  }

  async generateNonce(): Promise<number> {
    // Generate nonce based on timestamp to ensure uniqueness across server restarts
    // This uses the current timestamp as the base and increments for multiple requests in the same second
    const now = Math.floor(Date.now() / 1000);
    
    // If we've exceeded the current timestamp, keep incrementing
    if (this.nonceCounter < now) {
      this.nonceCounter = now;
    } else {
      this.nonceCounter++;
    }
    
    return this.nonceCounter;
  }

  async issuePendingSignature(fid: number, walletAddress: string, signature: string, nonce: number): Promise<void> {
    const key = this.getPendingSignatureKey(walletAddress);
    const now = Date.now();
    
    const pendingSignature: PendingSignature = {
      walletAddress: walletAddress.toLowerCase(),
      fid,
      signature,
      nonce,
      issuedAt: now,
      expiresAt: now + this.SIGNATURE_TTL,
    };

    this.pendingSignatures.set(key, pendingSignature);
    console.log(`[Storage] Issued pending signature for ${walletAddress}, expires in 5 minutes`);
  }

  async getPendingSignature(fid: number, walletAddress: string): Promise<PendingSignature | undefined> {
    const key = this.getPendingSignatureKey(walletAddress);
    const pending = this.pendingSignatures.get(key);

    // Check if pending signature exists and is still valid
    if (pending) {
      if (Date.now() > pending.expiresAt) {
        // Signature has expired
        this.pendingSignatures.delete(key);
        console.log(`[Storage] Pending signature expired for ${walletAddress}`);
        return undefined;
      }
      return pending;
    }

    return undefined;
  }

  async confirmSignatureIssued(fid: number, walletAddress: string): Promise<void> {
    const key = this.getPendingSignatureKey(walletAddress);
    
    // Remove from pending
    this.pendingSignatures.delete(key);
    
    // Mark as issued in user progress
    const progressKey = this.getKey(fid, walletAddress);
    const progress = this.userProgress.get(progressKey);
    
    if (progress) {
      progress.signatureIssued = true;
      this.userProgress.set(progressKey, progress);
      console.log(`[Storage] Confirmed signature issued for ${walletAddress}`);
    }
  }

  async cleanupExpiredSignatures(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, pending] of this.pendingSignatures.entries()) {
      if (now > pending.expiresAt) {
        this.pendingSignatures.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Storage] Cleaned up ${cleanedCount} expired signatures`);
    }
  }
}

export const storage = new MemStorage();
