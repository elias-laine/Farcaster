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
import type { Task, TaskType, UserProgress, LotteryStats as LotteryStatsType } from "@shared/schema";

const TASK_ORDER: TaskType[] = ["like", "recast", "follow"];

export default function Home() {
  const { isReady, isInFrame, user, walletAddress, openUrl, connectWallet } = useFarcaster();
  const { toast } = useToast();
  const [verifyingTask, setVerifyingTask] = useState<TaskType | null>(null);
  const [onChainMintStatus, setOnChainMintStatus] = useState<boolean | null>(null);

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
  } = useQuery<LotteryStatsType>({
    queryKey: ["/api/lottery-stats"],
  });

  // Verify task mutation
  const verifyTaskMutation = useMutation({
    mutationFn: async (taskType: TaskType) => {
      if (!user?.fid || !walletAddress) {
        throw new Error("Please connect your wallet first");
      }
      
      const response = await apiRequest("POST", "/api/verify-task", {
        taskType,
        fid: user.fid,
        walletAddress,
      });
      
      return response.json();
    },
    onSuccess: (data, taskType) => {
      if (data.success) {
        toast({
          title: "Task Verified!",
          description: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} verified successfully.`,
        });
        refetchProgress();
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Could not verify the task. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
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
    if (taskType === "like" || taskType === "recast") {
      await openUrl(APP_CONFIG.castUrl);
    } else if (taskType === "follow") {
      await openUrl(`https://warpcast.com/${APP_CONFIG.targetUsername}`);
    }
  }, [openUrl]);

  // Check on-chain mint status (most authoritative source)
  useEffect(() => {
    const checkOnChainMint = async () => {
      if (!walletAddress || !APP_CONFIG.contractAddress) {
        return;
      }

      try {
        const response = await fetch(APP_CONFIG.rpcUrl || "https://mainnet.base.org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [
              {
                to: APP_CONFIG.contractAddress,
                // balanceOf(address) selector + address
                data: `0x70a08231000000000000000000000000${walletAddress.slice(2).padStart(40, "0")}`,
              },
              "latest",
            ],
            id: 1,
          }),
        });

        const result = await response.json();
        setOnChainMintStatus(result.result && result.result !== "0x0");
      } catch (error) {
        console.warn("Failed to check on-chain mint status:", error);
      }
    };

    checkOnChainMint();
  }, [walletAddress, APP_CONFIG.contractAddress]);

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
    const taskIndex = TASK_ORDER.indexOf(type);
    if (taskIndex === 0) return false;
    
    for (let i = 0; i < taskIndex; i++) {
      const prevTask = getTask(TASK_ORDER[i]);
      if (!prevTask || prevTask.status !== "verified") {
        return true;
      }
    }
    return false;
  };

  // Count completed tasks
  const completedTasksCount = userProgress?.tasks?.filter(t => t.status === "verified").length || 0;
  const allTasksCompleted = completedTasksCount === TASK_ORDER.length;
  // Use on-chain check as source of truth (overrides backend storage)
  const hasMinted = onChainMintStatus !== null ? onChainMintStatus : !!userProgress?.mintedAt;

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
        {/* Hero Section */}
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

        {/* Lottery Stats */}
        <section data-testid="section-lottery-stats">
          <h2 className="text-xl font-semibold mb-4">Lottery Status</h2>
          <LotteryStats stats={lotteryStats || null} isLoading={isLoadingStats} />
        </section>

        {/* Tasks Section */}
        <section data-testid="section-tasks">
          <h2 className="text-xl font-semibold mb-4">Complete Tasks</h2>
          
          {isLoadingProgress ? (
            <div className="space-y-4">
              <Skeleton className="h-2 w-full" />
              {TASK_ORDER.map((type) => (
                <Skeleton key={type} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <ProgressIndicator 
                completedTasks={completedTasksCount} 
                totalTasks={TASK_ORDER.length} 
              />
              
              <div className="space-y-4">
                {TASK_ORDER.map((type) => (
                  <TaskCard
                    key={type}
                    type={type}
                    task={getTask(type)}
                    isLocked={isTaskLocked(type)}
                    isVerifying={verifyingTask === type}
                    onVerify={() => handleVerifyTask(type)}
                    onOpenAction={() => handleOpenAction(type)}
                    targetUsername={APP_CONFIG.targetUsername}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Mint Section */}
        <section data-testid="section-mint">
          <MintSection
            isEligible={allTasksCompleted && !hasMinted}
            hasMinted={hasMinted}
            onMintSuccess={handleMintSuccess}
            fid={user?.fid}
          />
        </section>
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
