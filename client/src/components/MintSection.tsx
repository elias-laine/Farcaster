import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";
import { useFarcaster } from "@/lib/farcaster";
import { sendTransaction } from "@/lib/farcaster";
import { encodeFunctionData } from "viem";
import { useToast } from "@/hooks/use-toast";

// SBT Contract ABI (mint function)
const SBT_ABI = [
  {
    name: "mint",
    type: "function",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

interface MintSectionProps {
  isEligible: boolean;
  hasMinted: boolean;
  onMintSuccess: () => void;
}

type MintStatus = "idle" | "fetching_signature" | "minting" | "success" | "error";

interface MintSectionExtendedProps extends MintSectionProps {
  fid?: number;
}

export function MintSection({ isEligible, hasMinted, onMintSuccess, fid }: MintSectionExtendedProps) {
  const { walletAddress, connectWallet, user } = useFarcaster();
  const { toast } = useToast();
  const [status, setStatus] = useState<MintStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use provided fid or get from user context
  const userFid = fid || user?.fid;

  const handleMint = async () => {
    if (!walletAddress) {
      const address = await connectWallet();
      if (!address) {
        toast({
          title: "Wallet Connection Required",
          description: "Please connect your wallet to mint the SBT.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!userFid) {
      toast({
        title: "Authentication Required",
        description: "Please open this app within Farcaster.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStatus("fetching_signature");
      setErrorMessage(null);

      // Fetch mint signature from backend with both fid and walletAddress
      const response = await fetch("/api/mint-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, fid: userFid }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get mint signature");
      }

      const { signature, nonce } = await response.json();

      setStatus("minting");

      // Encode the mint function call
      const data = encodeFunctionData({
        abi: SBT_ABI,
        functionName: "mint",
        args: [signature as `0x${string}`, BigInt(nonce)],
      });

      // Send transaction
      const hash = await sendTransaction({
        to: APP_CONFIG.sbtContractAddress,
        data,
      });

      if (!hash) {
        throw new Error("Transaction failed or was rejected");
      }

      setTxHash(hash);
      setStatus("success");
      onMintSuccess();

      toast({
        title: "SBT Minted Successfully!",
        description: "You are now entered into the lottery.",
      });
    } catch (error) {
      console.error("Mint error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to mint SBT");
      toast({
        title: "Mint Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  if (!isEligible && !hasMinted) {
    return null;
  }

  return (
    <Card 
      className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5"
      data-testid="card-mint-section"
    >
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">
          {hasMinted ? "You're In!" : "Mint Your SBT"}
        </CardTitle>
        <CardDescription className="text-base">
          {hasMinted 
            ? "Your SBT has been minted. You're entered in the lottery!"
            : "Complete! Mint your Soulbound Token to enter the lottery."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {walletAddress && (
          <Badge variant="outline" className="font-mono text-xs">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </Badge>
        )}

        {hasMinted ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">SBT Minted</span>
            </div>
            <p className="text-center text-foreground font-medium">
              شما با موفقیت وارد قرعه‌کشی شدید!
            </p>
            {txHash && (
              <a
                href={`${APP_CONFIG.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                data-testid="link-transaction"
              >
                <span className="font-mono">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="pt-2 text-center text-sm text-muted-foreground">
              برای قرعه‌کشی‌های بیشتر{" "}
              <a
                href="https://farcaster.xyz/book"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                data-testid="link-follow-book"
              >
                @book
              </a>
              {" "}را دنبال کنید.
            </div>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              className="px-8 h-12"
              onClick={handleMint}
              disabled={status === "fetching_signature" || status === "minting"}
              data-testid="button-mint"
            >
              {status === "fetching_signature" && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Preparing...
                </>
              )}
              {status === "minting" && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Minting...
                </>
              )}
              {(status === "idle" || status === "error") && (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Mint SBT & Enter Lottery
                </>
              )}
            </Button>

            {status === "error" && errorMessage && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
