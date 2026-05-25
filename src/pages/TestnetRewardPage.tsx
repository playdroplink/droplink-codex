import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Gift } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ClaimTestPiButton from "@/components/pi/ClaimTestPiButton";
import { FooterNav } from "@/components/FooterNav";
import { PageHeader } from "@/components/PageHeader";
import { isPiBrowserEnv, usePi } from "@/contexts/PiContext";
import { fetchWalletProgress, type WalletProgress } from "@/lib/piA2uApi";

const TestnetRewardPage = () => {
  const { isAuthenticated, signIn, loading } = usePi();
  const inPiBrowser = isPiBrowserEnv();
  const [progress, setProgress] = useState<WalletProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletProgress()
      .then(setProgress)
      .catch((e) => {
        console.error("[TestnetReward] Load error:", e);
        setLoadError(e instanceof Error ? e.message : "Could not load progress");
      });
  }, []);

  const handleRetry = () => {
    setLoadError(null);
    fetchWalletProgress()
      .then(setProgress)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load progress"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white pb-24">
      <PageHeader title="Testnet Reward" showBackButton />
      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <Card className="border-sky-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sky-800">
              <Gift className="h-5 w-5" />
              Claim Test Pi (A2U)
            </CardTitle>
            <CardDescription>
              Send App-to-User Test Pi to 10 unique Pioneer wallets to qualify for Mainnet wallet
              approval. Open this page in Pi Browser, sign in, then tap Claim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress && (
              <div className="rounded-xl bg-sky-50 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-sky-700">
                  {progress.unique_wallets} / {progress.target}
                </p>
                <p className="text-sm text-sky-600">{progress.progress_label}</p>
                {progress.completed && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">Goal complete</p>
                )}
              </div>
            )}

            {loadError && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Connection Problem</AlertTitle>
                  <AlertDescription className="text-xs break-all">
                    {loadError}
                  </AlertDescription>
                </Alert>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs" 
                  onClick={handleRetry}
                >
                  Retry Connection
                </Button>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] text-amber-800 space-y-1">
                  <p className="font-bold">Troubleshooting Check:</p>
                  <p>1. Open this in <b>Pi Browser</b>, not a regular browser.</p>
                  <p>2. Ensure <b>.\deploy-pi-a2u.ps1</b> was run on your project.</p>
                  <p>3. If using VPN or proxy, try disabling it.</p>
                </div>
              </div>
            )}

            {!inPiBrowser && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Pi Browser required</AlertTitle>
                <AlertDescription>
                  A2U claims only work inside Pi Browser. Open droplink.space in Pi Browser to
                  continue.
                </AlertDescription>
              </Alert>
            )}

            {!isAuthenticated && inPiBrowser && (
              <Button
                className="w-full rounded-2xl"
                variant="outline"
                disabled={loading}
                onClick={() => void signIn(["username", "payments", "wallet_address"])}
              >
                Sign in with Pi
              </Button>
            )}

            <ClaimTestPiButton
              onSuccess={({ progress: p }) => setProgress(p)}
            />

            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/admin/testnet-progress"
                className="inline-flex items-center justify-center gap-1 text-sm text-sky-600 hover:underline"
              >
                View admin progress <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <FooterNav />
    </div>
  );
};

export default TestnetRewardPage;
