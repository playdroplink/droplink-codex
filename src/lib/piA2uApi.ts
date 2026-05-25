import { supabase } from "@/integrations/supabase/client";

export type WalletProgress = {
  unique_wallets: number;
  target: number;
  progress_label: string;
  completed: boolean;
  total_successful_a2u?: number;
};

export type A2uClaimResult = {
  payment_id: string;
  txid: string;
  wallet_address: string;
  amount: number;
  memo: string;
  progress: WalletProgress;
  wallet_added: boolean;
};

export type A2uAdminDashboard = {
  progress: WalletProgress & { wallets?: Array<Record<string, unknown>> };
  total_successful_a2u: number;
  unique_wallets_count: number;
  wallet_addresses: string[];
  transactions: Array<Record<string, unknown>>;
  successful_transactions: Array<Record<string, unknown>>;
  failed_transactions: Array<Record<string, unknown>>;
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    details: Record<string, unknown>;
    uid?: string;
    username?: string;
  }>;
};

const TARGET_WALLETS = 10;
const FUNCTION_NAMES = ["pi-a2u", "pi-auth"] as const;

function isEdgeUnavailable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to send a request to the edge function") ||
    m.includes("function not found") ||
    m.includes("404") ||
    m.includes("not found") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("network error") ||
    m.includes("cors") ||
    m.includes("opaque")
  );
}

async function invokeViaFetch<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const externalApiUrl = import.meta.env.VITE_PI_API_URL;

  // Use VITE_PI_API_URL if it's set to a valid production endpoint (not localhost)
  const isExternalApi = 
    externalApiUrl && 
    !externalApiUrl.includes("supabase.co") && 
    !externalApiUrl.includes("localhost") && 
    !externalApiUrl.includes("127.0.0.1") &&
    externalApiUrl.startsWith("http");
    
  const baseUrl = isExternalApi ? externalApiUrl : `${supabaseUrl}/functions/v1`;

  if (!baseUrl || (!isExternalApi && !anonKey)) {
    throw new Error(`Config missing: URL=${!!baseUrl}, Key=${!!anonKey}`);
  }

  // Strategy: Pass apikey as query param to avoid some CORS preflight issues in Pi Browser
  // Only add apikey to Supabase URLs, not external ones
  const url = isExternalApi 
    ? `${baseUrl}/${functionName}` 
    : `${baseUrl}/${functionName}${anonKey ? `?apikey=${encodeURIComponent(anonKey)}` : ""}`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(anonKey ? { "apikey": anonKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg =
        (payload as { error?: string })?.error ||
        (payload as { message?: string })?.message ||
        `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    if ((payload as { error?: string })?.error) {
      throw new Error((payload as { error: string }).error);
    }
    return payload as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Add environment context to the error for better user debugging
    const context = `[UA: ${navigator.userAgent.slice(0, 30)}...]`;
    throw new Error(`${msg} ${context} (Target: ${url.split("?")[0]})`);
  }
}

async function invokePiA2U<T>(body: Record<string, unknown>): Promise<T> {
  let lastError: Error | null = null;
  const action = body.action || "unknown";

  // Strategy: In Pi Browser, standard supabase.functions.invoke often fails due to restricted headers.
  // We prioritize a clean fetch() call which is more compatible with WebKit/Pi Browser security.
  for (const functionName of FUNCTION_NAMES) {
    try {
      return await invokeViaFetch<T>(functionName, body);
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      
      // If it's a fatal logic error (e.g. already claimed), don't retry
      if (!isEdgeUnavailable(msg)) {
        throw fetchErr;
      }
      
      lastError = fetchErr instanceof Error ? fetchErr : new Error(msg);
      
      // Fallback to standard invoke if fetch fails for some reason
      try {
        const { data, error } = await supabase.functions.invoke(functionName, { body });
        if (!error && data && !(data as { error?: string }).error) {
          return data as T;
        }
        const invokeMsg = error?.message || (data as { error?: string })?.error || "Request failed";
        if (!isEdgeUnavailable(invokeMsg)) {
          throw new Error(invokeMsg);
        }
      } catch (invokeErr) {
        // Continue to next function name
      }
    }
  }

  // If we reach here, all attempts failed
  const finalMsg = lastError?.message || "All connection attempts failed";
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "jzzbmoopwnvgxxirulga";
  
  if (isEdgeUnavailable(finalMsg)) {
    throw new Error(
      `Connection failed (${finalMsg}). Project: ${projectId}. Please check your internet or redeploy: npx supabase functions deploy pi-a2u --project-ref ${projectId}`
    );
  }
  
  throw new Error(finalMsg);
}

async function fetchWalletProgressFromDb(): Promise<WalletProgress> {
  const { count, error } = await supabase
    .from("pi_a2u_wallets" as any)
    .select("*", { count: "exact", head: true });

  if (error) {
    if (error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error(
        "A2U tables missing. Run supabase/migrations/20260525000000_pi_a2u_tables.sql in the Supabase SQL editor.",
      );
    }
    throw new Error(error.message);
  }

  const unique = count ?? 0;
  return {
    unique_wallets: unique,
    target: TARGET_WALLETS,
    progress_label: `${unique} / ${TARGET_WALLETS} unique wallets completed`,
    completed: unique >= TARGET_WALLETS,
  };
}

async function fetchAdminDashboardFromDb(): Promise<A2uAdminDashboard> {
  const progress = await fetchWalletProgressFromDb();

  const { data: txs, error: txError } = await supabase
    .from("pi_a2u_transactions" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (txError) throw new Error(txError.message);

  const { data: wallets, error: walletError } = await supabase
    .from("pi_a2u_wallets" as any)
    .select("wallet_address, uid, username, txid, payment_id, created_at")
    .order("created_at", { ascending: false });

  if (walletError) throw new Error(walletError.message);

  const transactions = ((txs || []) as any[]).filter((t) => !String(t.status || "").startsWith("log_"));
  const logs = ((txs || []) as any[])
    .filter((t) => String(t.status || "").startsWith("log_"))
    .map((t) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(String(t.error || "{}"));
      } catch {
        parsed = { message: t.error || "Diagnostic event" };
      }
      return {
        timestamp: String(t.created_at),
        level: String(t.status || "log_info").replace("log_", ""),
        message: String(parsed.message || "Diagnostic event"),
        details: (parsed.details as Record<string, unknown>) || {},
        uid: t.uid as string | undefined,
        username: t.username as string | undefined,
      };
    });

  const success = transactions.filter((t) => t.status === "success");
  const failed = transactions.filter((t) => t.status === "failed");

  return {
    progress: { ...progress, wallets: (wallets || []) as any[] },
    total_successful_a2u: success.length,
    unique_wallets_count: (wallets || []).length,
    wallet_addresses: ((wallets || []) as any[]).map((w) => String(w.wallet_address)),
    transactions,
    successful_transactions: success,
    failed_transactions: failed,
    logs,
  };
}

export async function verifyPiA2uAuth(accessToken: string) {
  return invokePiA2U<{ success: boolean; data: { uid: string; username: string } }>({
    action: "auth_verify",
    accessToken,
  });
}

export async function fetchWalletProgress(): Promise<WalletProgress> {
  try {
    const result = await invokePiA2U<{ success: boolean; data: WalletProgress }>({
      action: "progress",
    });
    return result.data;
  } catch (edgeErr) {
    const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    if (isEdgeUnavailable(msg) || msg.includes("Missing accessToken") || msg.includes("auth failed")) {
      return fetchWalletProgressFromDb();
    }
    throw edgeErr;
  }
}

export async function claimTestnetPi(
  accessToken: string,
  body?: { amount?: number; memo?: string },
) {
  return invokePiA2U<{ success: boolean; data: A2uClaimResult }>({
    action: "claim",
    accessToken,
    amount: body?.amount ?? Number(import.meta.env.VITE_PI_A2U_AMOUNT || 0.01),
    memo: body?.memo ?? import.meta.env.VITE_PI_A2U_MEMO ?? "Testnet reward",
  });
}

export async function fetchA2uAdminDashboard(): Promise<A2uAdminDashboard> {
  try {
    const result = await invokePiA2U<{ success: boolean; data: A2uAdminDashboard }>({
      action: "admin_dashboard",
    });
    return result.data;
  } catch (edgeErr) {
    const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    if (isEdgeUnavailable(msg) || msg.includes("Missing accessToken") || msg.includes("auth failed")) {
      return fetchAdminDashboardFromDb();
    }
    throw edgeErr;
  }
}
