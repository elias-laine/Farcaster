import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { TaskCard } from "@/components/TaskCard";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { MintSection } from "@/components/MintSection";
import { LotteryStats } from "@/components/LotteryStats";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Zap } from "lucide-react";
import { useFarcaster } from "@/lib/farcaster";
import { APP_CONFIG } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Task, TaskType, UserProgress, LotteryStats as LotteryStatsType, AdminTask } from "@shared/schema";

interface AppConfig {
  castHash: string;
  targetFid: number;
  contractAddress: string;
  chainId: number;
  rpcUrl: string;
}

interface PrizeTier {
  minParticipants: number;
  maxParticipants: number;
  winnersCount: number;
  prizePerWinner: string;
  prizePerWinnerUsd: number;
}

export default function Home() {
  const { isReady, isInFrame, user, walletAddress, openUrl, connectWallet, composeCast } = useFarcaster();
  const { toast } = useToast();
  const [verifyingTask, setVerifyingTask] = useState<TaskType | null>(null);
  const [onChainMintStatus, setOnChainMintStatus] = useState<boolean | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  // Fetch custom tasks configuration
  const { 
    data: customTasks = [], 
    isLoading: isLoadingTasks,
  } = useQuery<AdminTask[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  // Get task order from custom tasks (filter for required tasks)
  const taskOrder: TaskType[] = customTasks && customTasks.length > 0
    ? customTasks
        .filter(t => t.required !== false)
        .map(t => t.type as TaskType)
        .filter((type, i, arr) => arr.indexOf(type) === i)
    : ["like", "recast", "follow"];

  // Fetch user progress
  const { 
    data: userProgress, 
    isLoading: isLoadingProgress,
    refetch: refetchProgress,
  } = useQuery<UserProgress>({
    queryKey: ["/api/user-progress"],
    queryFn: async () => {
      if (!user?.fid || !walletAddress) return null;
      const res = await fetch(`/api/user-progress?fid=${user.fid}&walletAddress=${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: !!user?.fid && !!walletAddress,
  });

  // Fetch lottery stats
  const { 
    data: lotteryStats, 
    isLoading: isLoadingStats,
    error: lotteryStatsError,
  } = useQuery<LotteryStatsType>({
    queryKey: ["/api/lottery-stats"],
  });


  // Verify task mutation
  const verifyTaskMutation = useMutation({
    mutationFn: async (taskType: TaskType) => {
      if (!user?.fid || !walletAddress) {
        throw new Error("Please connect your wallet first");
      }
      
      console.log(`[Verify] Starting verification for task: ${taskType}`);
      const response = await apiRequest("POST", "/api/verify-task", {
        taskType,
        fid: user.fid,
        walletAddress,
      });
      
      console.log(`[Verify] Response status: ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data, taskType) => {
      console.log(`[Verify] Success response:`, data);
      if (data.success) {
        toast({
          title: "Task Verified!",
          description: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} verified successfully.`,
        });
        refetchProgress();
      } else {
        console.error(`[Verify] Verification failed:`, data);
        const description = data.message || "Could not verify the task. Please try again.";
        toast({
          title: "Verification Failed",
          description,
          variant: "destructive",
        });
        // Also log debug info if available
        if (data.debug) {
          console.log(`[Verify] Debug info:`, data.debug);
        }
      }
    },
    onError: (error) => {
      console.error(`[Verify] Error:`, error);
      toast({
        title: "Verification Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setVerifyingTask(null);
    },
  });

  const handleVerifyTask = useCallback(async (taskType: TaskType) => {
    if (!walletAddress) {
      const address = await connectWallet();
      if (!address) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet to verify tasks.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setVerifyingTask(taskType);
    verifyTaskMutation.mutate(taskType);
  }, [walletAddress, connectWallet, toast, verifyTaskMutation]);

  const handleOpenAction = useCallback(async (taskType: TaskType) => {
    const castHash = config?.castHash || APP_CONFIG.castHash;
    const targetFid = config?.targetFid || APP_CONFIG.targetFid;
    
    // Get task config from custom tasks
    const taskConfig = customTasks.find(t => t.type === taskType);
    
    if (taskType === "like" || taskType === "recast") {
      const castUrl = (taskConfig?.options as any)?.castUrl || APP_CONFIG.castUrl;
      await openUrl(castUrl);
    } else if (taskType === "follow") {
      const targetUsername = (taskConfig?.options as any)?.targetUsername || APP_CONFIG.targetUsername;
      await openUrl(`https://warpcast.com/${targetUsername}`);
    } else if (taskType === "cast") {
      // For cast task, use SDK composeCast with suggested text
      const castText = (taskConfig?.options as any)?.castText || "Check out this awesome quest!";
      await composeCast({ text: castText });
    }
  }, [openUrl, config, customTasks, composeCast]);

  // Fetch config from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/app-config");
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        console.warn("Failed to fetch app config from backend:", error);
      }
    };

    fetchConfig();
  }, []);

  // Check on-chain mint status using backend API
  useEffect(() => {
    const checkOnChainMint = async () => {
      if (!walletAddress) {
        console.log("[Mint Status Check] No wallet address, skipping");
        setOnChainMintStatus(null);
        return;
      }

      try {
        const response = await fetch("/api/check-mint-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });

        const result = await response.json();
        console.log("[Mint Status Check] Backend response:", result);
        
        if (result.success) {
          setOnChainMintStatus(result.hasMinted);
        } else {
          setOnChainMintStatus(null);
        }
      } catch (error) {
        console.error("[Mint Status Check] Failed:", error);
        setOnChainMintStatus(null);
      }
    };

    checkOnChainMint();
  }, [walletAddress]);

  // Refetch progress and mint status after page reload
  useEffect(() => {
    if (isReady && user?.fid && walletAddress) {
      console.log("[Home] Page ready - refetching progress and mint status");
      refetchProgress();
    }
  }, [isReady]);

  // Fetch lottery stats again after mint
  const { refetch: refetchLotteryStats } = useQuery<LotteryStatsType>({
    queryKey: ["/api/lottery-stats-refresh"],
    queryFn: async () => {
      const res = await fetch("/api/lottery-stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: false,
  });

  const handleMintSuccess = useCallback(() => {
    refetchProgress();
    refetchLotteryStats();
    setOnChainMintStatus(true);
  }, [refetchProgress, refetchLotteryStats]);

  // Get task by type from user progress
  const getTask = (type: TaskType): Task | null => {
    if (!userProgress?.tasks) return null;
    return userProgress.tasks.find(t => t.type === type) || null;
  };

  // Check if a task is locked (previous task not completed)
  const isTaskLocked = (type: TaskType): boolean => {
    const taskIndex = taskOrder.indexOf(type);
    if (taskIndex === 0) return false;
    
    for (let i = 0; i < taskIndex; i++) {
      const prevTask = getTask(taskOrder[i]);
      if (!prevTask || prevTask.status !== "verified") {
        return true;
      }
    }
    return false;
  };

  // Count completed tasks
  const completedTasksCount = userProgress?.tasks?.filter(t => t.status === "verified").length || 0;
  const allTasksCompleted = completedTasksCount === taskOrder.length;
  // Use on-chain check as source of truth (overrides backend storage)
  const hasMinted = onChainMintStatus !== null ? onChainMintStatus : !!userProgress?.mintedAt;

  // Check if deadline has passed
  const deadlineHasPassed = lotteryStats && lotteryStats.deadline * 1000 < Date.now();

  // Show not in frame message
  if (isReady && !isInFrame) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card className="border">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Open in Farcaster</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                This app is designed to run inside Farcaster. Please open it through Warpcast or another Farcaster client to participate in the quest.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Deadline Passed Message */}
        {deadlineHasPassed && (
          <section className="text-center space-y-4" data-testid="section-deadline-message">
            <Card className="border-2 border-destructive/20 bg-destructive/5">
              <CardContent className="p-8">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Registration Closed</h2>
                <p className="text-muted-foreground mb-6">
                  Unfortunately, the registration period for this lottery has ended.
                </p>
                <div className="space-y-3">
                  <a
                    href="/admin"
                    className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                    data-testid="link-view-results"
                  >
                    View Results
                  </a>
                  <p className="text-sm text-muted-foreground mt-4">
                    Follow{" "}
                    <a
                      href="https://warpcast.com/book"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="link-follow-book"
                    >
                      @book
                    </a>
                    {" "}for more lotteries.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Hero Section */}
        {!deadlineHasPassed && (
          <section className="text-center space-y-4" data-testid="section-hero">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Complete Tasks, Win Prizes</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Complete three simple social tasks, mint your SBT, and enter the lottery for a chance to win up to $5!
              </p>
            </div>
          </section>
        )}

        {/* Lottery Stats */}
        <section data-testid="section-lottery-stats">
          <h2 className="text-xl font-semibold mb-4">Lottery Status</h2>
          <LotteryStats stats={lotteryStats || null} isLoading={isLoadingStats} />
        </section>

        {/* Tasks Section */}
        {!deadlineHasPassed && (
          <section data-testid="section-tasks">
            <h2 className="text-xl font-semibold mb-4">Complete Tasks</h2>
            
            {isLoadingTasks || isLoadingProgress ? (
              <div className="space-y-4">
                <Skeleton className="h-2 w-full" />
                {taskOrder.length > 0 ? (
                  taskOrder.map((type) => (
                    <Skeleton key={type} className="h-24 w-full rounded-lg" />
                  ))
                ) : (
                  // Show 3 default skeletons while loading
                  <>
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </>
                )}
              </div>
            ) : (
              <>
                <ProgressIndicator 
                  completedTasks={completedTasksCount} 
                  totalTasks={taskOrder.length} 
                />
                
                <div className="space-y-4">
                  {taskOrder.map((type) => (
                    <TaskCard
                      key={type}
                      type={type}
                      task={getTask(type)}
                      isLocked={isTaskLocked(type)}
                      isVerifying={verifyingTask === type}
                      onVerify={() => handleVerifyTask(type)}
                      onOpenAction={() => handleOpenAction(type)}
                      taskConfig={customTasks.find(t => t.type === type)}
                      targetUsername={customTasks.find(t => t.type === type)?.options?.targetUsername || APP_CONFIG.targetUsername}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Mint Section */}
        {!deadlineHasPassed && (
          <section data-testid="section-mint">
            <MintSection
              isEligible={allTasksCompleted && !hasMinted}
              hasMinted={hasMinted}
              onMintSuccess={handleMintSuccess}
              fid={user?.fid}
              contractAddress={config?.contractAddress || APP_CONFIG.contractAddress}
              rpcUrl={config?.rpcUrl || APP_CONFIG.rpcUrl}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Farcaster. Built with love.</p>
        </div>
      </footer>
    </div>
  );
}
