import { z } from "zod";

// Task types for social verification
export const taskTypes = ["like", "recast", "follow"] as const;
export type TaskType = typeof taskTypes[number];

// Task status
export const taskStatuses = ["pending", "verified", "failed"] as const;
export type TaskStatus = typeof taskStatuses[number];

// Task configuration schema
export const taskConfigSchema = z.object({
  castHash: z.string().describe("Hash of the cast to like/recast"),
  castUrl: z.string().describe("URL of the cast for display"),
  targetFid: z.number().describe("Farcaster ID of the account to follow"),
  targetUsername: z.string().describe("Username of the account to follow"),
});

export type TaskConfig = z.infer<typeof taskConfigSchema>;

// Individual task schema
export const taskSchema = z.object({
  type: z.enum(taskTypes),
  status: z.enum(taskStatuses),
  verifiedAt: z.number().optional(),
});

export type Task = z.infer<typeof taskSchema>;

// User task progress schema
export const userProgressSchema = z.object({
  fid: z.number(),
  walletAddress: z.string(),
  tasks: z.array(taskSchema),
  allTasksCompleted: z.boolean(),
  signatureIssued: z.boolean(),
  mintedAt: z.number().optional(),
});

export type UserProgress = z.infer<typeof userProgressSchema>;

// Verification request schema
export const verifyTaskRequestSchema = z.object({
  taskType: z.enum(taskTypes),
  fid: z.number(),
  walletAddress: z.string(),
});

export type VerifyTaskRequest = z.infer<typeof verifyTaskRequestSchema>;

// Verification response schema
export const verifyTaskResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  task: taskSchema.optional(),
});

export type VerifyTaskResponse = z.infer<typeof verifyTaskResponseSchema>;

// Mint signature request schema
export const mintSignatureRequestSchema = z.object({
  fid: z.number(),
  walletAddress: z.string(),
});

export type MintSignatureRequest = z.infer<typeof mintSignatureRequestSchema>;

// Mint signature response schema
export const mintSignatureResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  signature: z.string().optional(),
  nonce: z.number().optional(),
});

export type MintSignatureResponse = z.infer<typeof mintSignatureResponseSchema>;

// Lottery tier schema
export const lotteryTierSchema = z.object({
  minParticipants: z.number(),
  maxParticipants: z.number().optional(),
  winnersCount: z.number(),
  prizePerWinner: z.number(),
  totalPrize: z.number(),
});

export type LotteryTier = z.infer<typeof lotteryTierSchema>;

// Lottery stats schema
export const lotteryStatsSchema = z.object({
  totalParticipants: z.number(),
  currentTier: lotteryTierSchema,
  deadline: z.number(),
  isActive: z.boolean(),
  winners: z.array(z.string()).optional(),
});

export type LotteryStats = z.infer<typeof lotteryStatsSchema>;

// Lottery tiers configuration
export const LOTTERY_TIERS: LotteryTier[] = [
  { minParticipants: 0, maxParticipants: 99, winnersCount: 1, prizePerWinner: 5, totalPrize: 5 },
  { minParticipants: 100, maxParticipants: 499, winnersCount: 2, prizePerWinner: 10, totalPrize: 20 },
  { minParticipants: 500, maxParticipants: 999, winnersCount: 3, prizePerWinner: 15, totalPrize: 45 },
  { minParticipants: 1000, maxParticipants: undefined, winnersCount: 4, prizePerWinner: 20, totalPrize: 80 },
];

// Get current tier based on participants count
export function getCurrentTier(participantsCount: number): LotteryTier {
  for (let i = LOTTERY_TIERS.length - 1; i >= 0; i--) {
    if (participantsCount >= LOTTERY_TIERS[i].minParticipants) {
      return LOTTERY_TIERS[i];
    }
  }
  return LOTTERY_TIERS[0];
}

// Contract addresses (to be updated after deployment)
export const CONTRACT_ADDRESSES = {
  sbt: "0x0000000000000000000000000000000000000000",
  lottery: "0x0000000000000000000000000000000000000000",
} as const;

// Base network configuration
export const BASE_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// App configuration schema
export const appConfigSchema = z.object({
  castHash: z.string(),
  castUrl: z.string(),
  targetFid: z.number(),
  targetUsername: z.string(),
  sbtContractAddress: z.string(),
  lotteryContractAddress: z.string(),
  chainId: z.number(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
