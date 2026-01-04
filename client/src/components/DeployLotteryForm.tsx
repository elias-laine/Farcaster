import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseEther } from 'ethers';
import { useToast } from "@/hooks/use-toast";

interface Tier {
  id: string;
  min: number;
  max: number;
  winners: number;
  prize: string;
}

interface DeployLotteryFormProps {
  walletAddress?: string;
}

export function DeployLotteryForm({ walletAddress }: DeployLotteryFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [tiers, setTiers] = useState<Tier[]>([
    { id: "1", min: 0, max: 99, winners: 1, prize: "5" },
    { id: "2", min: 100, max: 499, winners: 2, prize: "10" },
  ]);
  const [result, setResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [foundryError, setFoundryError] = useState(false);

  // Convert local date/time to unix timestamp
  const getUnixTimestamp = () => {
    if (!deadlineDate) return null;
    const dateTime = new Date(`${deadlineDate}T${deadlineTime}`);
    return Math.floor(dateTime.getTime() / 1000);
  };

  // Format unix timestamp to display format
  const formatDeadlineDisplay = () => {
    const timestamp = getUnixTimestamp();
    if (!timestamp) return "Not set";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    const timestamp = getUnixTimestamp();
    if (!timestamp) return 0;
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    return Math.ceil(diff / (24 * 60 * 60));
  };

  const calculateTotalPrizePool = () => {
    return tiers.reduce((sum, tier) => {
      try {
        const prizeInEth = parseFloat(tier.prize || "0");
        return sum + (prizeInEth * tier.winners);
      } catch {
        return sum;
      }
    }, 0);
  };

  const handleDeploy = async () => {
    if (!walletAddress) {
      return toast({ 
        title: 'Wallet required', 
        description: 'Please connect your wallet first', 
        variant: 'destructive' 
      });
    }

    const deadline = getUnixTimestamp();
    if (!deadline) {
      return toast({ 
        title: 'Deadline required', 
        description: 'Please select a deadline date and time', 
        variant: 'destructive' 
      });
    }

    if (tiers.length === 0) {
      return toast({ 
        title: 'At least one tier required', 
        description: 'Please add at least one prize tier', 
        variant: 'destructive' 
      });
    }

    setLoading(true);
    try {
      const tiersPayload = tiers.map(t => {
        let prizeWei = String(t.prize ?? '0');
        try {
          prizeWei = parseEther(String(t.prize ?? '0')).toString();
        } catch (e) {
          // keep raw value if parse fails
        }
        return { 
          min: t.min, 
          max: t.max, 
          winners: t.winners, 
          prize: prizeWei 
        };
      });

      const res = await fetch('/api/admin/deploy-lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          deadline,
          tiers: tiersPayload,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        setFoundryError(false);
        toast({ 
          title: 'Contract Deployed Successfully! 🎉', 
          description: `Contract Address: ${data.contractAddress || 'See logs'}` 
        });
        // Reset form
        setDeadlineDate("");
        setDeadlineTime("23:59");
        setTiers([
          { id: "1", min: 0, max: 99, winners: 1, prize: "5" },
          { id: "2", min: 100, max: 499, winners: 2, prize: "10" },
        ]);
      } else {
        // Check if it's a Foundry installation error
        if (data.message?.includes('Foundry') || data.message?.includes('forge')) {
          setFoundryError(true);
          toast({ 
            title: '⚠️ Foundry Not Installed', 
            description: 'The server needs Foundry installed. Check FOUNDRY_QUICK_FIX.md for installation instructions.', 
            variant: 'destructive' 
          });
        } else {
          setFoundryError(false);
          toast({ 
            title: 'Deployment Failed', 
            description: data.message || 'Please check the console for details', 
            variant: 'destructive' 
          });
        }
      }
    } catch (e) {
      console.error(e);
      setFoundryError(false);
      toast({ 
        title: 'Error', 
        description: 'Deployment request failed. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const addTier = () => {
    const newId = (Math.max(...tiers.map(t => parseInt(t.id) || 0)) + 1).toString();
    setTiers([...tiers, {
      id: newId,
      min: tiers.length > 0 ? (tiers[tiers.length - 1].max || 0) + 1 : 0,
      max: 0,
      winners: 1,
      prize: "5",
    }]);
  };

  const removeTier = (id: string) => {
    if (tiers.length === 1) {
      toast({
        title: 'Cannot remove',
        description: 'At least one tier is required',
        variant: 'destructive',
      });
      return;
    }
    setTiers(tiers.filter(t => t.id !== id));
  };

  const updateTier = (id: string, field: keyof Tier, value: any) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-6">
      {/* Deadline Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-primary" />
          <label className="block text-sm font-semibold">Lottery Deadline</label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Date</label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Time (24h format)</label>
            <input
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {deadlineDate && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary">{formatDeadlineDisplay()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getDaysRemaining() > 0 
                    ? `${getDaysRemaining()} days from now` 
                    : getDaysRemaining() === 0 
                    ? "Today" 
                    : "In the past"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prize Tiers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10">
              {tiers.length} Tier{tiers.length !== 1 ? 's' : ''}
            </Badge>
            <span className="text-sm font-semibold">Prize Structure</span>
          </div>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <Card key={tier.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  {/* Min Participants */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Min Participants
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tier.min}
                      onChange={(e) => updateTier(tier.id, 'min', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  {/* Max Participants */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Max Participants (0 = unlimited)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tier.max}
                      onChange={(e) => updateTier(tier.id, 'max', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  {/* Winners Count */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Winners
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={tier.winners}
                      onChange={(e) => updateTier(tier.id, 'winners', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  {/* Prize per Winner */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Prize per Winner (ETH)
                    </label>
                    <input
                      type="text"
                      value={tier.prize}
                      onChange={(e) => updateTier(tier.id, 'prize', e.target.value)}
                      placeholder="e.g. 5 or 0.5"
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTier(tier.id)}
                      className="text-destructive hover:bg-destructive/10 h-9 px-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Tier Summary */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Total prize pool for this tier:
                    </span>
                    <span className="font-semibold text-primary">
                      {(parseFloat(tier.prize || "0") * tier.winners).toFixed(4)} ETH
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Tier Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addTier}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Prize Tier
        </Button>
      </div>

      {/* Total Prize Pool Summary */}
      {tiers.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Total Prize Pool</p>
                  <p className="text-xs text-muted-foreground">Across all tiers</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {calculateTotalPrizePool().toFixed(4)} ETH
                </p>
                <p className="text-xs text-muted-foreground">
                  {tiers.reduce((sum, t) => sum + t.winners, 0)} total winners
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment Warnings & Info */}
      {foundryError && (
        <Alert variant="destructive" className="border-red-600/50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Foundry is not installed on the server</p>
              <p className="text-sm">To deploy contracts, you need to install Foundry first.</p>
              <p className="text-sm">Run this command on the server:</p>
              <code className="block bg-black/20 p-2 rounded mt-2 text-xs font-mono">
                bash setup-foundry.sh
              </code>
              <p className="text-sm mt-2">Or see <code className="bg-black/20 px-1 py-0.5 rounded">FOUNDRY_QUICK_FIX.md</code> for detailed instructions.</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!deadlineDate && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a deadline before deploying the contract.
          </AlertDescription>
        </Alert>
      )}

      {getDaysRemaining() < 1 && deadlineDate && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The deadline is in the past or today. Consider setting a future date.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={!deadlineDate || tiers.length === 0}
            >
              Preview Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Deployment Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Deadline</h4>
                <p className="text-sm text-muted-foreground">{formatDeadlineDisplay()}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Prize Tiers ({tiers.length})</h4>
                <div className="space-y-2">
                  {tiers.map((tier, idx) => (
                    <div key={tier.id} className="text-sm p-2 bg-muted rounded">
                      <div className="font-medium">Tier {idx + 1}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Participants: {tier.min} - {tier.max === 0 ? 'Unlimited' : tier.max}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Winners: {tier.winners} × {tier.prize} ETH = {(parseFloat(tier.prize || "0") * tier.winners).toFixed(4)} ETH
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold">Total Prize Pool: {calculateTotalPrizePool().toFixed(4)} ETH</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          onClick={handleDeploy}
          disabled={loading || !deadlineDate || tiers.length === 0}
          className="flex-1 sm:flex-initial"
          size="lg"
        >
          {loading ? 'Deploying...' : 'Deploy Lottery Contract'}
        </Button>
      </div>

      {/* Deployment Result */}
      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64">
            {JSON.stringify(result, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
}
