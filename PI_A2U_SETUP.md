# Pi Testnet A2U Setup (DropLink)

App-to-User (A2U) rewards send Test Pi from your app wallet to Pioneers. Goal: **10 unique receiving wallets** for Mainnet wallet approval.

## Routes

| URL | Purpose |
|-----|---------|
| `/testnet-reward` | Pioneer claim page |
| `/admin/testnet-progress` | Admin dashboard (progress, txs, logs) |

## 1. Pi Developer Portal

1. Open [Pi Developer Portal](https://develop.pi) → your app.
2. Copy **API Key** → `PI_A2U_API_KEY` (Supabase secret).
3. App → **Wallet** → note **wallet address** (`G…`).
4. Copy **Private Seed** (`S…`, 56 chars) → `PI_WALLET_PRIVATE_SEED`.

> Seed must derive the **same** `G` address shown in the portal.

## 2. Supabase database

Run migration (SQL editor or CLI):

```bash
npx supabase db push
# or paste: supabase/migrations/20260525000000_pi_a2u_tables.sql
```

## 3. Supabase Edge Function secrets

```bash
npx supabase secrets set PI_A2U_API_KEY="your_pi_api_key"
npx supabase secrets set PI_WALLET_PRIVATE_SEED="SXXXXXXXX..."
npx supabase secrets set PI_A2U_AMOUNT="0.01"
npx supabase secrets set PI_A2U_MEMO="App Testnet reward"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually set automatically when linked.

## 4. Deploy edge function

```powershell
.\deploy-pi-a2u.ps1
```

Or manually:

```bash
npx supabase functions deploy pi-a2u --project-ref jzzbmoopwnvgxxirulga
npx supabase functions deploy pi-auth --project-ref jzzbmoopwnvgxxirulga
```

> **Note:** A2U actions also route through `pi-auth` if `pi-a2u` is not deployed. The app tries both function names automatically.

## 5. Frontend `.env` (optional display)

```bash
VITE_PI_A2U_AMOUNT=0.01
VITE_PI_A2U_MEMO=App Testnet reward
```

## 6. Verify

1. Open **Pi Browser** → `http://localhost:8080/testnet-reward` (or production URL).
2. Sign in with Pi → **Claim Test Pi**.
3. Check `/admin/testnet-progress` for wallet count and txid.
4. Edge logs: Supabase → Functions → `pi-a2u` → look for `Pi A2U payment completed successfully`.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `PI_WALLET_PRIVATE_SEED does not match` | Use the seed for the portal wallet `G` address |
| `Invalid API key` (Supabase) | Match `VITE_SUPABASE_ANON_KEY` to project `jzzbmoopwnvgxxirulga` |
| `ongoing_payment_found` | Cancel pending payment in Pi Wallet, retry |
| `already claimed` | That Pi UID already has a success row — use another account |
| Function not found / Failed to send request | Run `.\deploy-pi-a2u.ps1` or deploy `pi-auth` + `pi-a2u`; run migration SQL |
| Progress works but claim fails | Edge function not deployed or missing `PI_WALLET_PRIVATE_SEED` secret |

## Files added

- `supabase/migrations/20260525000000_pi_a2u_tables.sql`
- `supabase/functions/pi-a2u/index.ts`
- `src/lib/piA2uApi.ts`
- `src/components/pi/ClaimTestPiButton.tsx`
- `src/pages/TestnetRewardPage.tsx`
- `src/pages/admin/TestnetProgressPage.tsx`
