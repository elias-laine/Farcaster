import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trophy, Users, Clock, AlertCircle, CheckCircle2, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useFarcaster } from "@/lib/farcaster";
import { APP_CONFIG } from "@/lib/config";
import { sendTransaction } from "@/lib/farcaster";
import { encodeFunctionData } from "viem";
import { useToast } from "@/hooks/use-toast";
import type { LotteryStats } from "@shared/schema";

// Lottery Contract ABI (admin functions)
const SOCIALQUEST_ABI = [
  {
    name: "executeLottery",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getParticipants",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    name: "getWinners",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
] as const;

interface Participant {
  address: string;
  mintedAt: number;
  isWinner: boolean;
}

export default function Admin() {
  const { walletAddress } = useFarcaster();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch lottery stats
  const { 
    data: lotteryStats, 
    isLoading: isLoadingStats,
    error: lotteryStatsError,
  } = useQuery<LotteryStats>({
    queryKey: ["/api/lottery-stats"],
  });

  // Fetch participants
  const { 
    data: participants, 
    isLoading: isLoadingParticipants,
  } = useQuery<Participant[]>({
    queryKey: ["/api/admin/participants"],
  });

  const handleExecuteLottery = async () => {
    try {
      setIsExecuting(true);
      
      if (!APP_CONFIG.contractAddress) {
        throw new Error("Contract address not configured");
      }
      
      console.log("[Admin] Executing lottery for contract:", APP_CONFIG.contractAddress);
      
      const data = encodeFunctionData({
        abi: SOCIALQUEST_ABI,
        functionName: "executeLottery",
      });

      console.log("[Admin] Encoded function data:", data);

      const hash = await sendTransaction({
        to: APP_CONFIG.contractAddress,
        data,
      });

      setTxHash(hash);
      toast({
        title: "Lottery Executed!",
        description: `Transaction hash: ${hash.slice(0, 10)}...`,
      });
      
      // Refresh data after execution
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/lottery-stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/participants"] });
      }, 2000);
    } catch (error) {
      console.error("[Admin] Execute lottery error:", error);
      toast({
        title: "تراکنش ناکام",
        description: error instanceof Error ? error.message : "تراکنش رد شد",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const isDeadlinePassed = lotteryStats 
    ? lotteryStats.deadline < Math.floor(Date.now() / 1000) 
    : false;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Error Alert - Contract Not Configured */}
        {lotteryStatsError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" data-testid="icon-error" />
                <div>
                  <p className="font-semibold text-destructive">Contract Not Deployed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please wait for the smart contract to be deployed on Base network.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <section className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lottery Results</h1>
            <p className="text-muted-foreground mt-1">
              View winners and all participants from the lottery
            </p>
          </div>
          <div className="flex items-center gap-2">
            {walletAddress && (
              <Badge variant="outline" className="font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Badge>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/lottery-stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/participants"] });
              }}
              data-testid="button-refresh-admin"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </section>

        {/* Stats Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="section-admin-stats">
          <Card className="border">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Participants</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold" data-testid="text-admin-participants">
                      {lotteryStats?.totalParticipants || 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prize Pool</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-success" data-testid="text-admin-prize">
                      ${lotteryStats?.currentTier.totalPrize || 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  isDeadlinePassed ? "bg-destructive/10" : "bg-muted"
                }`}>
                  <Clock className={`h-5 w-5 ${isDeadlinePassed ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <Badge 
                      variant={lotteryStats?.isExecuted ? "default" : (isDeadlinePassed ? "destructive" : "secondary")}
                      data-testid="badge-admin-status"
                    >
                      {lotteryStats?.isExecuted ? "Executed" : (isDeadlinePassed ? "Ready to Execute" : "Active")}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Execute Lottery Section - Only show if lottery hasn't been executed yet */}
        {!txHash && !lotteryStats?.isExecuted && (
          <Card className="border" data-testid="card-execute-lottery">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Execute Lottery
              </CardTitle>
              <CardDescription>
                Once the deadline has passed, you can execute the lottery to randomly select winners.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isDeadlinePassed ? (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    The lottery deadline has not passed yet. Please wait until the campaign ends.
                  </p>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="lg" 
                      className="w-full md:w-auto"
                      disabled={isExecuting}
                      data-testid="button-execute-lottery"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Trophy className="h-5 w-5 mr-2" />
                          Execute Lottery
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Execute Lottery?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will randomly select {lotteryStats?.currentTier.winnersCount || 1} winner(s) 
                        from {lotteryStats?.totalParticipants || 0} participants. 
                        Each winner will receive ${lotteryStats?.currentTier.prizePerWinner || 5}.
                        
                        Prizes will be automatically distributed once winners are selected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleExecuteLottery}>
                        Execute
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        )}

        {/* Winners Section (if lottery executed) */}
        {lotteryStats?.isExecuted && lotteryStats?.winners && lotteryStats.winners.length > 0 && (
          <Card className="border border-success/20 bg-success/5" data-testid="card-winners">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <Trophy className="h-5 w-5" />
                Winners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lotteryStats.winners.map((winner, index) => (
                  <div 
                    key={winner}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        #{index + 1}
                      </Badge>
                      <span className="font-mono text-sm">
                        {winner.slice(0, 10)}...{winner.slice(-8)}
                      </span>
                    </div>
                    <span className="font-semibold text-success">
                      ${lotteryStats.currentTier.prizePerWinner}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participants Table */}
        <Card className="border" data-testid="card-participants">
          <CardHeader>
            <CardTitle>Participants</CardTitle>
            <CardDescription>
              All users who have minted an SBT and entered the lottery
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingParticipants ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : participants && participants.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Wallet Address</TableHead>
                      <TableHead>Minted At</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant, index) => (
                      <TableRow key={participant.address}>
                        <TableCell className="font-mono text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono">
                          <a
                            href={`${APP_CONFIG.explorerUrl}/address/${participant.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                          >
                            {participant.address.slice(0, 10)}...{participant.address.slice(-8)}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(participant.mintedAt * 1000).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {participant.isWinner ? (
                            <Badge className="bg-success/10 text-success border-success/30">
                              Winner
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Entered</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No participants yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
