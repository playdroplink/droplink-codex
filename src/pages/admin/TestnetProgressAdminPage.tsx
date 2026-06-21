import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, type WalletProgress } from "@/lib/piApi";

interface AdminDashboard {
  progress: WalletProgress & { wallets: any[] };
  total_successful_a2u: number;
  unique_wallets_count: number;
  wallet_addresses: string[];
  transactions: any[];
  successful_transactions: any[];
  failed_transactions: any[];
  logs: any[];
}

export default function TestnetProgressAdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await fetchAdminDashboard();
      setDashboard(result.data);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Failed to load admin dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loading admin dashboard...</p>
          <Button onClick={loadDashboard} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {loading ? "Loading..." : "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">📊 Testnet Progress (Admin)</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh || "Never"}
            </p>
          </div>
          <Button onClick={loadDashboard} disabled={loading} size="lg">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {dashboard.unique_wallets_count} / {dashboard.progress.target}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((dashboard.unique_wallets_count / dashboard.progress.target) * 100)}% complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Successful Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.total_successful_a2u}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard.successful_transactions.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Failed Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{dashboard.failed_transactions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Recent failures</p>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Addresses */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Addresses</CardTitle>
            <CardDescription>Unique Pi wallets that received Test Pi</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.wallet_addresses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No wallets yet</p>
            ) : (
              <div className="space-y-2">
                {dashboard.wallet_addresses.map((addr, idx) => (
                  <div key={idx} className="p-2 bg-muted rounded text-sm font-mono break-all">
                    {idx + 1}. {addr}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest A2U payment attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-2">UID</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">TXID</th>
                    <th className="text-left py-2 px-2">Wallet</th>
                    <th className="text-left py-2 px-2">Amount</th>
                    <th className="text-left py-2 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.transactions.slice(0, 20).map((tx, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 px-2 font-mono text-xs">{tx.uid}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            tx.status === "success"
                              ? "bg-green-100 text-green-800"
                              : tx.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {tx.txid ? tx.txid.slice(0, 12) : "-"}
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {tx.wallet_address ? tx.wallet_address.slice(0, 12) : "-"}
                      </td>
                      <td className="py-2 px-2">{tx.amount}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Logs */}
        {dashboard.logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Logs</CardTitle>
              <CardDescription>System events and errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dashboard.logs.slice(0, 50).map((log, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-mono text-xs">
                          <span
                            className={
                              log.level === "error"
                                ? "text-red-600"
                                : log.level === "warn"
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }
                          >
                            [{log.level.toUpperCase()}]
                          </span>{" "}
                          {log.message}
                        </p>
                        {log.uid && (
                          <p className="text-xs text-muted-foreground mt-1">
                            UID: {log.uid} {log.username && `(${log.username})`}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
