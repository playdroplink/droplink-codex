import { useState } from "react";
import { Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePi, isPiBrowserEnv } from "@/contexts/PiContext";
import { claimTestnetPi, fetchWalletProgress, type WalletProgress } from "@/lib/piA2uApi";

type Props = {
  onSuccess?: (data: { txid: string; progress: WalletProgress }) => void;
  className?: string;
};

const DEFAULT_AMOUNT = Number(import.meta.env.VITE_PI_A2U_AMOUNT || 0.01);
const DEFAULT_MEMO = import.meta.env.VITE_PI_A2U_MEMO || "Testnet reward";

export default function ClaimTestPiButton({ onSuccess, className }: Props) {
  const { accessToken, signIn, loading: authLoading, isInitialized } = usePi();
  const inPiBrowser = isPiBrowserEnv();
  const [claiming, setClaiming] = useState(false);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [progress, setProgress] = useState<WalletProgress | null>(null);

  const handleClaim = async () => {
    if (!inPiBrowser) {
      toast.error("Open this page in Pi Browser to claim.");
      return;
    }
    if (!isInitialized) {
      toast.error("Pi SDK not ready. Please wait or reload.");
      return;
    }
    setClaiming(true);
    console.log("[PI A2U] Starting claim flow...");
    try {
      let token = accessToken;
      if (!token) {
        console.log("[PI A2U] No access token found, requesting sign-in...");
        const result = await signIn(["username", "payments", "wallet_address"]);
        token = (result as any)?.accessToken || localStorage.getItem("pi_access_token");
      }
      
      if (!token) {
        throw new Error("Missing or invalid accessToken. Please sign in again.");
      }

      console.log("[PI A2U] Token acquired, calling claimTestnetPi...");
      const result = await claimTestnetPi(token, {
        amount: DEFAULT_AMOUNT,
        memo: DEFAULT_MEMO,
      });
      
      console.log("[PI A2U] Claim successful:", result);
      setLastTxid(result.data.txid);
      setProgress(result.data.progress);
      toast.success(`Sent ${result.data.amount} Test Pi! TX: ${result.data.txid.slice(0, 12)}…`);
      onSuccess?.({ txid: result.data.txid, progress: result.data.progress });
    } catch (error) {
      console.error("[PI A2U] Claim error:", error);
      const msg = error instanceof Error ? error.message : "Claim failed";
      if (msg.includes("already claimed")) {
        toast.error("You have already claimed this reward.");
      } else if (msg.includes("unique wallets") || msg.includes("goal reached")) {
        toast.message("Testnet goal reached: 10 unique wallets completed.");
      } else {
        toast.error(msg);
      }
      try {
        const p = await fetchWalletProgress();
        setProgress(p);
      } catch {
        /* ignore */
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={() => void handleClaim()}
        disabled={claiming || authLoading || (inPiBrowser && !isInitialized)}
        className="h-11 w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
      >
        {claiming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Test Pi…
          </>
        ) : (
          <>
            <Gift className="mr-2 h-4 w-4" /> Claim Test Pi
          </>
        )}
      </Button>
      {progress && (
        <p className="mt-2 text-center text-sm text-muted-foreground">{progress.progress_label}</p>
      )}
      {lastTxid && (
        <p className="mt-1 break-all text-center text-xs text-emerald-600">Success — txid: {lastTxid}</p>
      )}
    </div>
  );
}
