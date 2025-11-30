import { sdk } from "@farcaster/frame-sdk";
import { createContext, useContext } from "react";

// Types for Farcaster context
export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
}

export interface FarcasterContextType {
  isReady: boolean;
  isInFrame: boolean;
  user: FarcasterUser | null;
  walletAddress: string | null;
  connectWallet: () => Promise<string | null>;
  openUrl: (url: string) => Promise<void>;
  openCast: (hash: string) => Promise<void>;
  followUser: (fid: number) => Promise<void>;
}

// Create context with default values
export const FarcasterContext = createContext<FarcasterContextType>({
  isReady: false,
  isInFrame: false,
  user: null,
  walletAddress: null,
  connectWallet: async () => null,
  openUrl: async () => {},
  openCast: async () => {},
  followUser: async () => {},
});

// Hook to use Farcaster context
export function useFarcaster() {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error("useFarcaster must be used within a FarcasterProvider");
  }
  return context;
}

// SDK wrapper functions
export async function initializeSdk(): Promise<{
  isInFrame: boolean;
  user: FarcasterUser | null;
}> {
  try {
    const context = await sdk.context;
    
    if (context?.user) {
      await sdk.actions.ready();
      return {
        isInFrame: true,
        user: {
          fid: context.user.fid,
          username: context.user.username || "",
          displayName: context.user.displayName || context.user.username || "",
          pfpUrl: context.user.pfpUrl,
        },
      };
    }
    
    return { isInFrame: false, user: null };
  } catch (error) {
    console.error("Failed to initialize Farcaster SDK:", error);
    return { isInFrame: false, user: null };
  }
}

export async function connectFarcasterWallet(): Promise<string | null> {
  try {
    const accounts = await sdk.wallet.ethProvider.request({
      method: "eth_requestAccounts",
    });
    
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    return null;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await sdk.actions.openUrl(url);
  } catch (error) {
    console.error("Failed to open URL:", error);
    // Fallback to window.open
    window.open(url, "_blank");
  }
}

export async function signMessage(message: string): Promise<string | null> {
  try {
    const signature = await sdk.wallet.ethProvider.request({
      method: "personal_sign",
      params: [message, await getConnectedAddress()],
    });
    return signature as string;
  } catch (error) {
    console.error("Failed to sign message:", error);
    return null;
  }
}

async function getConnectedAddress(): Promise<string | null> {
  try {
    const accounts = await sdk.wallet.ethProvider.request({
      method: "eth_accounts",
    });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    return null;
  }
}

// Send transaction helper
export async function sendTransaction(params: {
  to: string;
  data: string;
  value?: string;
}): Promise<string> {
  try {
    const from = await getConnectedAddress();
    if (!from) throw new Error("No wallet connected");
    
    console.log("[Transaction] Sending to:", params.to);
    console.log("[Transaction] From:", from);
    console.log("[Transaction] Data:", params.data);
    
    const txHash = await sdk.wallet.ethProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from,
        to: params.to,
        data: params.data,
        value: params.value || "0x0",
      }],
    });
    
    console.log("[Transaction] Success, Hash:", txHash);
    return txHash as string;
  } catch (error) {
    const fullError = error instanceof Error ? error : new Error(String(error));
    console.error("[Transaction] Full error object:", error);
    console.error("[Transaction] Error message:", fullError.message);
    const errorMsg = fullError.message || String(error);
    throw new Error(`Transaction failed: ${errorMsg}`);
  }
}
