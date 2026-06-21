const PI_AUTH_STORAGE_KEY = "myapp_pi_auth";

export type PiAuthSession = { uid: string; username: string; accessToken: string };

export function isPiSandbox(): boolean {
  const env = String(import.meta.env.VITE_PI_SANDBOX ?? "").trim().toLowerCase();
  if (env.length > 0) return env === "true";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (host.includes("testnet") || path.includes("testnet")) return true;
  if (import.meta.env.PROD) return false;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host.endsWith(".test");
}

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /PiBrowser/i.test(navigator.userAgent) || Boolean((window as any).Pi);
}

export function initPiSdk(): boolean {
  const piWindow = window as any;
  if (!piWindow.Pi) return false;
  try {
    piWindow.Pi.init({ version: "2.0", sandbox: isPiSandbox() });
    return true;
  } catch (e) {
    console.warn("Pi SDK init failed", e);
    return false;
  }
}

export function loadPiAuthSession(): PiAuthSession | null {
  try {
    const raw = localStorage.getItem(PI_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PiAuthSession;
    if (!parsed?.uid || !parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePiAuthSession(session: PiAuthSession): void {
  localStorage.setItem(PI_AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearPiAuthSession(): void {
  localStorage.removeItem(PI_AUTH_STORAGE_KEY);
}

export async function waitForPiSdk(timeoutMs = 12000): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const piWindow = window as any;
  if (piWindow.Pi) return true;

  return new Promise((resolve) => {
    const onReady = () => resolve(Boolean(piWindow.Pi));
    const onError = () => resolve(false);

    window.addEventListener("pi-sdk-ready", onReady, { once: true });
    window.addEventListener("pi-sdk-error", onError, { once: true });

    const timer = window.setTimeout(() => resolve(Boolean(piWindow.Pi)), timeoutMs);

    const wrappedReady = () => {
      window.clearTimeout(timer);
      onReady();
    };

    window.removeEventListener("pi-sdk-ready", onReady);
    window.addEventListener("pi-sdk-ready", wrappedReady, { once: true });
  });
}

export async function authenticatePi(scopes: string[] = ["username"]): Promise<PiAuthSession> {
  const piWindow = window as any;
  if (!piWindow.Pi) throw new Error("Pi SDK unavailable. Open this app in Pi Browser.");

  initPiSdk();
  const auth = await piWindow.Pi.authenticate(scopes);
  const session: PiAuthSession = {
    uid: auth.user.uid,
    username: auth.user.username || "",
    accessToken: auth.accessToken,
  };
  savePiAuthSession(session);
  return session;
}
