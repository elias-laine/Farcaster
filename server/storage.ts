import type { Task, TaskType, UserProgress, LotteryStats } from "@shared/schema";
import { getCurrentTier } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

const TASK_TYPES: TaskType[] = ["like", "recast", "follow"];

// Default deadline: from environment variable or 7 days from now
const DEFAULT_DEADLINE = parseInt(process.env.LOTTERY_DEADLINE || "0") || 
  Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

export class MemStorage implements IStorage {
  private userProgress: Map<string, UserProgress>;
  private participants: Map<string, { mintedAt: number; isWinner: boolean }>;
  private usedNonces: Set<number>;
  private winners: string[];
  private deadline: number;
  private nonceCounter: number;

  constructor() {
    this.userProgress = new Map();
    this.participants = new Map();
    this.usedNonces = new Set();
    this.winners = [];
    this.deadline = DEFAULT_DEADLINE;
    this.nonceCounter = 1;
  }

  private getKey(fid: number, walletAddress: string): string {
    return `${fid}-${walletAddress.toLowerCase()}`;
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
    
    return {
      totalParticipants,
      currentTier,
      deadline: this.deadline,
      isActive: Date.now() / 1000 < this.deadline,
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
    const nonce = this.nonceCounter++;
    return nonce;
  }
}

export const storage = new MemStorage();
