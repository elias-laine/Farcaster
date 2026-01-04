import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trophy, Users, Clock, AlertCircle, CheckCircle2, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useFarcaster } from "@/lib/farcaster";
import { APP_CONFIG } from "@/lib/config";
import { sendTransaction } from "@/lib/farcaster";
import { encodeFunctionData } from "viem";
import { useToast } from "@/hooks/use-toast";
import { parseEther } from 'ethers';
import { DeployLotteryForm } from "@/components/DeployLotteryForm";
import type { LotteryStats, AdminTask } from "@shared/schema";

interface PrizeTier {
  minParticipants: number;
  maxParticipants: number;
  winnersCount: number;
  prizePerWinner: string;
  prizePerWinnerUsd: number;
}

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

function ManageTasksForm() {
  const { walletAddress, connectWallet } = useFarcaster();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ castHash: '', targetFid: '', castUrl: '', targetUsername: '' });
  const [tasks, setTasks] = useState<AdminTask[]>([
    { id: 'task-like', type: 'like', title: 'Like the Cast', required: true, options: {} },
    { id: 'task-recast', type: 'recast', title: 'Recast the Cast', required: true, options: {} },
    { id: 'task-follow', type: 'follow', title: 'Follow the Creator', required: true, options: {} },
  ]);
  const [castText, setCastText] = useState<string>('');
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/tasks-config');
        const data = await res.json();
        setConfig({
          castHash: data.castHash || '',
          targetFid: data.targetFid ? String(data.targetFid) : '',
          castUrl: data.castUrl || '',
          targetUsername: data.targetUsername || '',
        });
        // Normalize tasks: accept either old string[] or AdminTask[]
        if (Array.isArray(data.tasks)) {
          if (data.tasks.length > 0 && typeof data.tasks[0] === 'string') {
            setTasks((data.tasks as string[]).map((t: string, i: number) => ({ id: String(i) + '-' + t, type: t as any, title: t, required: true } as AdminTask)));
          } else {
            setTasks(data.tasks as AdminTask[]);
          }
        } else {
          setTasks([]);
        }
        setCastText(data.castText || '');
      } catch (e) {
        console.warn('Failed to fetch admin config', e);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentWallet = walletAddress;
    if (!currentWallet) {
      const addr = await connectWallet();
      if (!addr) return toast({ title: 'Wallet Required', description: 'Connect wallet to update tasks', variant: 'destructive' });
      currentWallet = addr;
    }

    setLoading(true);
    try {
      // Step 1: Request challenge
      console.log('[Admin] Requesting challenge for', currentWallet);
      const challengeRes = await fetch('/api/admin/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentWallet }),
      });
      
      if (!challengeRes.ok) {
        throw new Error('Failed to get challenge');
      }

      const challengeData = await challengeRes.json();
      const challenge = challengeData.challenge;
      console.log('[Admin] Got challenge');

      // Step 2: Send update with challenge
      console.log('[Admin] Sending update with challenge');
      const updateRes = await fetch('/api/admin/tasks-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: currentWallet,
          tasks,
          castHash: config.castHash,
          targetFid: config.targetFid ? parseInt(config.targetFid) : undefined,
          castUrl: config.castUrl,
          targetUsername: config.targetUsername,
          castText,
          challenge,
        }),
      });

      const updateData = await updateRes.json();
      if (updateData.success) {
        toast({ title: 'Updated', description: 'Tasks configuration updated' });
        // Invalidate tasks query so home page gets new config
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      } else {
        toast({ title: 'Failed', description: updateData.message || 'Update failed', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Update error', err);
      toast({ title: 'Error', description: 'Failed to update tasks config', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium mb-1">Social Task Manager</label>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditingTask({ id: '', type: 'like', title: '', required: true, options: {} as any })}>+ Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
                <DialogDescription>Configure a social task and its parameters.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1">Type</label>
                  <select value={editingTask?.type || 'like'} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', title: '', required: true, options: {} }), type: e.target.value as any }))} className="w-full px-2 py-2 border rounded">
                    <option value="like">Like</option>
                    <option value="recast">Recast</option>
                    <option value="follow">Follow</option>
                    <option value="cast">Cast (post)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Title (label shown to users)</label>
                  <input value={editingTask?.title || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'like', required: true, options: {} }), title: e.target.value }))} className="w-full px-2 py-2 border rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!editingTask?.required} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'like', title: '', options: {} }), required: e.target.checked }))} />
                    <span className="text-sm">Required</span>
                  </label>
                </div>
                {/* Type-specific options */}
                {editingTask?.type === 'cast' && (
                  <div>
                    <label className="block text-xs mb-1">Cast Text</label>
                    <textarea value={editingTask?.options?.castText || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'cast', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), castText: e.target.value } }))} className="w-full px-2 py-2 border rounded h-24" />
                    <label className="block text-xs mb-1 mt-2">Cast Hash (optional)</label>
                    <input value={editingTask?.options?.castHash || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'cast', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), castHash: e.target.value } }))} className="w-full px-2 py-2 border rounded" />
                  </div>
                )}
                {editingTask?.type === 'follow' && (
                  <div>
                    <label className="block text-xs mb-1">Target FID</label>
                    <input value={editingTask?.options?.targetFid || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'follow', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), targetFid: e.target.value ? Number(e.target.value) : undefined } }))} className="w-full px-2 py-2 border rounded" />
                    <label className="block text-xs mb-1 mt-2">Target Username</label>
                    <input value={editingTask?.options?.targetUsername || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'follow', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), targetUsername: e.target.value } }))} className="w-full px-2 py-2 border rounded" />
                  </div>
                )}
                {(editingTask?.type === 'like' || editingTask?.type === 'recast') && (
                  <div>
                    <label className="block text-xs mb-1">Cast Hash to act on</label>
                    <input value={editingTask?.options?.castHash || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'like', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), castHash: e.target.value } }))} className="w-full px-2 py-2 border rounded" />
                    <label className="block text-xs mb-1 mt-2">Optional Cast URL</label>
                    <input value={editingTask?.options?.castUrl || ''} onChange={(e) => setEditingTask(prev => ({ ...(prev || { id: '', type: 'like', title: '', required: true, options: {} }), options: { ...(prev?.options || {}), castUrl: e.target.value } }))} className="w-full px-2 py-2 border rounded" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    // save editingTask
                    if (!editingTask) return;
                    const task = { ...editingTask, id: editingTask.id || `${Date.now()}-${Math.random().toString(36).slice(2,6)}` };
                    setTasks(prev => {
                      const found = prev.findIndex(p => p.id === task.id);
                      if (found === -1) return [...prev, task];
                      const next = prev.slice(); next[found] = task; return next;
                    });
                    setIsDialogOpen(false);
                    setEditingTask(null);
                  }}>{editingTask ? 'Save Task' : 'Add Task'}</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.length === 0 && (<p className="text-sm text-muted-foreground">No tasks configured yet. Click + Add Task to create one.</p>)}
          {tasks.map((t, idx) => (
            <div key={t.id} className="p-3 border rounded flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{t.title || t.type}</div>
                  <div className="text-xs text-muted-foreground">{t.type} • {t.required ? 'Required' : 'Optional'}</div>
                </div>
                {t.options?.castText && <div className="text-sm text-muted-foreground mt-2">{t.options.castText}</div>}
              </div>
              <div className="flex gap-2 ml-4">
                <Button size="sm" variant="outline" onClick={() => { setEditingTask(t); setIsDialogOpen(true); }}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Configuration'}</Button>
    </form>
  );
}



export default function Admin() {
  const { walletAddress } = useFarcaster();
  const [isOwner, setIsOwner] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    const checkOwner = async () => {
      if (!walletAddress) {
        if (mounted) setIsOwner(false);
        return;
      }

      try {
        const res = await fetch('/api/verify-owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });
        if (!res.ok) {
          if (mounted) setIsOwner(false);
          return;
        }
        const data = await res.json();
        if (mounted) setIsOwner(Boolean(data.isOwner));
      } catch (e) {
        console.warn('Failed to verify owner', e);
        if (mounted) setIsOwner(false);
      }
    };

    checkOwner();
    return () => { mounted = false; };
  }, [walletAddress]);


  const handleExecuteLottery = async () => {
    try {
      setIsExecuting(true);
      
      if (!APP_CONFIG.contractAddress) {
        throw new Error("Contract address not configured");
      }

      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

      console.log("[Admin] Executing lottery for contract:", APP_CONFIG.contractAddress);
      console.log("[Admin] Wallet address:", walletAddress);
      
      const data = encodeFunctionData({
        abi: SOCIALQUEST_ABI,
        functionName: "executeLottery",
      });

      console.log("[Admin] Encoded function data:", data);
      console.log("[Admin] Sending transaction to contract...");

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
      console.error("[Admin] Error object:", JSON.stringify(error, null, 2));
      const errorMsg = error instanceof Error ? error.message : "Transaction was rejected";
      console.error("[Admin] Final error message for user:", errorMsg);
      toast({
        title: "Execution Failed",
        description: errorMsg,
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

        {/* Manage Tasks Section - visible only to contract owner */}
        {isOwner && (
          <Card className="border" data-testid="card-manage-tasks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Manage Social Tasks
              </CardTitle>
              <CardDescription>
                Configure the cast and user details for the social task requirement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageTasksForm />
            </CardContent>
          </Card>
        )}

        {/* Deploy Lottery - owner only */}
        {isOwner && (
          <Card className="border" data-testid="card-deploy-lottery">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Deploy New Lottery
              </CardTitle>
              <CardDescription>
                Deploy a new SocialQuest contract (SBT + Lottery) via Foundry. Server must have Foundry and deploy key configured.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeployLotteryForm walletAddress={walletAddress} />
            </CardContent>
          </Card>
        )}

        {/* Execute Lottery Section - Only show if lottery hasn't been executed yet */}
        {!txHash && !lotteryStats?.isExecuted && (
          <Card className="border" data-testid="card-execute-lottery">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Execute Lottery
              </CardTitle>
              <CardDescription>
                Once the deadline has passed, anyone who deposited funds or the contract owner can execute the lottery to randomly select winners.
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
