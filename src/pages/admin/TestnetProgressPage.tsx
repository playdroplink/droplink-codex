import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { fetchA2uAdminDashboard, type A2uAdminDashboard } from "@/lib/piA2uApi";

const TestnetProgressPage = () => {
  const [data, setData] = useState<A2uAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchA2uAdminDashboard();
      setData(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, []);

  const progress = data?.progress;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <PageHeader title="A2U Testnet Progress" showBackButton />
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Auto-refreshes every 15s ·{" "}
            <Link to="/testnet-reward" className="text-sky-600 hover:underline">
              Claim page
            </Link>
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700 space-y-2">
              <p>{error}</p>
              {error.includes("does not exist") || error.includes("migration") ? (
                <p className="text-xs">
                  Run <code>supabase/migrations/20260525000000_pi_a2u_tables.sql</code> in the Supabase SQL
                  editor.
                </p>
              ) : error.includes("edge function") || error.includes("deploy") ? (
                <p className="text-xs">
                  Run <code>.\deploy-pi-a2u.ps1</code> then set <code>PI_A2U_API_KEY</code> and{" "}
                  <code>PI_WALLET_PRIVATE_SEED</code> secrets.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {progress && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unique wallets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {progress.unique_wallets} / {progress.target}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Successful A2U</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data?.total_successful_a2u ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={progress.completed ? "default" : "secondary"}>
                  {progress.completed ? "Complete" : "In progress"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {data?.wallet_addresses && data.wallet_addresses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wallet addresses ({data.wallet_addresses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                {data.wallet_addresses.map((addr) => (
                  <li key={addr} className="break-all rounded bg-muted px-2 py-1">
                    {addr}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transactions</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">User</th>
                  <th className="py-2 pr-2">Wallet</th>
                  <th className="py-2 pr-2">TXID</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(data?.transactions || []).slice(0, 50).map((tx) => (
                  <tr key={String(tx.id)} className="border-b border-muted/50">
                    <td className="py-2 pr-2">
                      <Badge
                        variant={
                          tx.status === "success"
                            ? "default"
                            : tx.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {String(tx.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">{String(tx.username || tx.uid || "—")}</td>
                    <td className="py-2 pr-2 max-w-[120px] truncate font-mono">
                      {String(tx.wallet_address || "—")}
                    </td>
                    <td className="py-2 pr-2 max-w-[100px] truncate font-mono">
                      {String(tx.txid || "—")}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {tx.created_at ? new Date(String(tx.created_at)).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.transactions?.length && !loading && (
              <p className="py-4 text-center text-sm text-muted-foreground">No transactions yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagnostic logs</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-2">
            {(data?.logs || []).slice(0, 30).map((log, i) => (
              <div key={i} className="rounded border bg-muted/30 px-2 py-1.5 text-xs">
                <span className="font-medium text-muted-foreground">
                  [{log.level}] {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                </span>
                <p>{log.message}</p>
                {log.username && (
                  <p className="text-muted-foreground">
                    @{log.username} ({log.uid})
                  </p>
                )}
              </div>
            ))}
            {!data?.logs?.length && !loading && (
              <p className="text-sm text-muted-foreground">No logs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestnetProgressPage;
