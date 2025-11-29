import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Wallet, Loader2, Zap } from "lucide-react";
import { useFarcaster } from "@/lib/farcaster";
import { APP_CONFIG } from "@/lib/config";

export function Header() {
  const { isReady, isInFrame, user, walletAddress, connectWallet } = useFarcaster();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">
              Social Quest
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Complete tasks & win prizes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Network Badge */}
          <Badge 
            variant="outline" 
            className="hidden sm:flex gap-1 items-center"
            data-testid="badge-network"
          >
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            {APP_CONFIG.chainName}
          </Badge>

          {/* User/Wallet Section */}
          {!isReady ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : isInFrame && user ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border">
                <AvatarImage src={user.pfpUrl} alt={user.displayName} />
                <AvatarFallback className="text-xs">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {user.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{user.username}
                </p>
              </div>
              {walletAddress && (
                <Badge 
                  variant="secondary" 
                  className="font-mono text-xs ml-1"
                  data-testid="badge-wallet"
                >
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-3)}
                </Badge>
              )}
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={connectWallet}
              className="gap-2"
              data-testid="button-connect-wallet"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
