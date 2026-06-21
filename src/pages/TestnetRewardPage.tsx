import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ClaimTestPiButton from "@/components/pi/ClaimTestPiButton";
import { usePiAuth } from "@/contexts/PiAuthContext";
import { fetchWalletProgress, type WalletProgress } from "@/lib/piApi";

export default function TestnetRewardPage() {
  const { inPiBrowser, session, loading } = usePiAuth();
  const [progress, setProgress] = useState<WalletProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const data = await fetchWalletProgress();
        setProgress(data);
      } catch (error) {
        console.error("Failed to load progress:", error);
      } finally {
        setProgressLoading(false);
      }
    };

    loadProgress();
    const interval = setInterval(loadProgress, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">🎁 Testnet Rewards</h1>
          <p className="text-lg text-muted-foreground">
            Claim Test Pi to help your app qualify for Pi Mainnet wallet approval
          </p>
        </div>

        {/* Warning if not in Pi Browser */}
        {!inPiBrowser && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are not in Pi Browser. To claim Test Pi, open this page inside Pi Browser.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Progress
            </CardTitle>
            <CardDescription>Unique wallets that have received Test Pi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progressLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading progress...</div>
            ) : progress ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {progress.unique_wallets} / {progress.target}
                    </span>
                    <span className="text-sm text-muted-foreground">{Math.round((progress.unique_wallets / progress.target) * 100)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((progress.unique_wallets / progress.target) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                {progress.completed && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      ✅ Goal reached! Your app has met the testnet requirements.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Claim Card */}
        {!progress?.completed && inPiBrowser && (
          <Card>
            <CardHeader>
              <CardTitle>Claim Test Pi</CardTitle>
              <CardDescription>
                Connect your Pi account and claim your testnet reward
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Initializing Pi SDK...</div>
              ) : !session ? (
                <p className="text-sm text-muted-foreground">
                  You need to sign in with your Pi account to claim rewards.
                </p>
              ) : null}

              <ClaimTestPiButton
                onSuccess={() => {
                  setTimeout(() => {
                    fetchWalletProgress().then(setProgress).catch(console.error);
                  }, 1000);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="font-semibold min-w-fit">1️⃣ Sign In</span>
                <span className="text-muted-foreground">
                  Open this page in Pi Browser and sign in with your Pi account
                </span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold min-w-fit">2️⃣ Claim Reward</span>
                <span className="text-muted-foreground">
                  Click the "Claim Test Pi" button to receive 0.01 Test Pi
                </span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold min-w-fit">3️⃣ Track Progress</span>
                <span className="text-muted-foreground">
                  Progress is tracked above. When you reach 10 unique wallets, the testnet goal is complete
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Link */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/testnet-progress")}
            className="gap-2"
          >
            View Admin Dashboard →
          </Button>
        </div>
      </div>
    </div>
  );
}
