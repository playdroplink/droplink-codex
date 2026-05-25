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
    m.includes("network error")
  );
}

async function invokeViaFetch<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const externalApiUrl = import.meta.env.VITE_PI_API_URL;

  // Use VITE_PI_API_URL if it's set to a local/external endpoint (not Supabase)
  const isExternalApi = externalApiUrl && !externalApiUrl.includes("supabase.co");
  const baseUrl = isExternalApi ? externalApiUrl : `${supabaseUrl}/functions/v1`;

  if (!baseUrl || (!isExternalApi && !anonKey)) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }

  const url = isExternalApi ? baseUrl : `${baseUrl}/${functionName}`;
  console.log(`[PiA2U] Invoking via fetch: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey || "",
      "Content-Type": "application/json",
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
}

async function invokePiA2U<T>(body: Record<string, unknown>): Promise<T> {
  let lastError: Error | null = null;

  for (const functionName of FUNCTION_NAMES) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (!error && data && !(data as { error?: string }).error) {
      return data as T;
    }

    let msg = error?.message || (data as { error?: string })?.error || "Request failed";
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
    try {
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {
      /* ignore */
    }

    if (!isEdgeUnavailable(msg)) {
      throw new Error(msg);
    }
    lastError = new Error(msg);

    try {
      return await invokeViaFetch<T>(functionName, body);
    } catch (fetchErr) {
      lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      if (!isEdgeUnavailable(lastError.message)) {
        throw lastError;
      }
    }
  }

  throw (
    lastError ??
    new Error(
      "Pi A2U edge function is not deployed. Run: npx supabase functions deploy pi-a2u --project-ref jzzbmoopwnvgxxirulga",
    )
  );
}

async function fetchWalletProgressFromDb(): Promise<WalletProgress> {
  const { count, error } = await supabase
    .from("pi_a2u_wallets")
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
    .from("pi_a2u_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (txError) throw new Error(txError.message);

  const { data: wallets, error: walletError } = await supabase
    .from("pi_a2u_wallets")
    .select("wallet_address, uid, username, txid, payment_id, created_at")
    .order("created_at", { ascending: false });

  if (walletError) throw new Error(walletError.message);

  const transactions = (txs || []).filter((t) => !String(t.status || "").startsWith("log_"));
  const logs = (txs || [])
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
    progress: { ...progress, wallets: wallets || [] },
    total_successful_a2u: success.length,
    unique_wallets_count: (wallets || []).length,
    wallet_addresses: (wallets || []).map((w) => String(w.wallet_address)),
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
    if (isEdgeUnavailable(edgeErr instanceof Error ? edgeErr.message : String(edgeErr))) {
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
    if (isEdgeUnavailable(edgeErr instanceof Error ? edgeErr.message : String(edgeErr))) {
      return fetchAdminDashboardFromDb();
    }
    throw edgeErr;
  }
}
