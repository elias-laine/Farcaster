import { useState, useEffect, useCallback } from "react";
import { sdk } from "@farcaster/frame-sdk";
import {
  FarcasterContext,
  FarcasterUser,
  initializeSdk,
  connectFarcasterWallet,
  openExternalUrl,
  composeCast,
} from "@/lib/farcaster";

interface FarcasterProviderProps {
  children: React.ReactNode;
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isInFrame, setIsInFrame] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const result = await initializeSdk();
      setIsInFrame(result.isInFrame);
      setUser(result.user);
      setIsReady(true);
      
      // Auto-connect wallet if in frame
      if (result.isInFrame) {
        try {
          const accounts = await sdk.wallet.ethProvider.request({
            method: "eth_accounts",
          });
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (error) {
          console.error("Failed to get accounts:", error);
        }
      }
    };

    init();
  }, []);

  const connectWallet = useCallback(async () => {
    const address = await connectFarcasterWallet();
    if (address) {
      setWalletAddress(address);
    }
    return address;
  }, []);

  const openUrl = useCallback(async (url: string) => {
    await openExternalUrl(url);
  }, []);

  const openCast = useCallback(async (hash: string) => {
    const url = `https://warpcast.com/~/conversations/${hash}`;
    await openExternalUrl(url);
  }, []);

  const followUser = useCallback(async (fid: number) => {
    const url = `https://warpcast.com/~/profiles/${fid}`;
    await openExternalUrl(url);
  }, []);

  const handleComposeCast = useCallback(async (options: { text?: string; embeds?: any[] }) => {
    await composeCast(options);
  }, []);

  return (
    <FarcasterContext.Provider
      value={{
        isReady,
        isInFrame,
        user,
        walletAddress,
        connectWallet,
        openUrl,
        openCast,
        followUser,
        composeCast: handleComposeCast,
      }}
    >
      {children}
    </FarcasterContext.Provider>
  );
}
