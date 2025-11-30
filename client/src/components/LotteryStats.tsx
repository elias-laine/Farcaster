import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Trophy, DollarSign, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { LotteryStats as LotteryStatsType, LotteryTier } from "@shared/schema";
import { LOTTERY_TIERS } from "@shared/schema";

interface LotteryStatsProps {
  stats: LotteryStatsType | null;
  isLoading: boolean;
}

function formatTimeRemaining(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;
  
  if (remaining <= 0) return "Ended";
  
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function getTierLabel(tier: LotteryTier): string {
  const tierIndex = LOTTERY_TIERS.findIndex(
    t => t.minParticipants === tier.minParticipants
  );
  return `Tier ${tierIndex + 1}`;
}

function getNextTierThreshold(currentParticipants: number): number | null {
  for (const tier of LOTTERY_TIERS) {
    if (tier.minParticipants > currentParticipants) {
      return tier.minParticipants;
    }
  }
  return null;
}

export function LotteryStats({ stats, isLoading }: LotteryStatsProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  
  useEffect(() => {
    if (!stats?.deadline) return;
    
    const updateTime = () => {
      setTimeRemaining(formatTimeRemaining(stats.deadline));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, [stats?.deadline]);

  const nextTierThreshold = stats 
    ? getNextTierThreshold(stats.totalParticipants) 
    : null;
  
  const progressToNextTier = stats && nextTierThreshold
    ? Math.min(100, (stats.totalParticipants / nextTierThreshold) * 100)
    : 100;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="lottery-stats-loading">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="lottery-stats">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Participants */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Participants</span>
            </div>
            <p 
              className="text-3xl font-bold text-foreground"
              data-testid="text-participants-count"
            >
              {stats.totalParticipants.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Current Tier */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Current Tier</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                className="bg-primary/10 text-primary border-primary/30"
                data-testid="badge-current-tier"
              >
                {getTierLabel(stats.currentTier)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {stats.currentTier.winnersCount} winner{stats.currentTier.winnersCount > 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Prize Pool */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Prize Pool</span>
            </div>
            <p 
              className="text-3xl font-bold text-success"
              data-testid="text-prize-amount"
            >
              ${stats.currentTier.totalPrize}
            </p>
            <p className="text-xs text-muted-foreground">
              ${stats.currentTier.prizePerWinner} per winner
            </p>
          </CardContent>
        </Card>

        {/* Time Remaining */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Deadline</span>
            </div>
            <p 
              className="text-lg font-bold font-mono text-foreground"
              data-testid="text-time-remaining"
            >
              {timeRemaining}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(stats.deadline < 100000000000 ? stats.deadline * 1000 : stats.deadline).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Tier Progress */}
      {nextTierThreshold && (
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Next Tier Progress</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {nextTierThreshold - stats.totalParticipants} more to unlock
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressToNextTier}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Reach {nextTierThreshold} participants to unlock more prizes!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Prize Tiers Info */}
      <Card className="border">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Prize Tiers
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LOTTERY_TIERS.map((tier, index) => {
              const isActive = stats.currentTier.minParticipants === tier.minParticipants;
              return (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    isActive 
                      ? "border-primary bg-primary/5" 
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      Tier {index + 1}
                    </span>
                    {isActive && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold">${tier.totalPrize}</p>
                  <p className="text-xs text-muted-foreground">
                    {tier.winnersCount}x ${tier.prizePerWinner}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {tier.minParticipants}+ participants
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
