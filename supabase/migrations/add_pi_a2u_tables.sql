-- Create Pi A2U Tables for Testnet Reward System

CREATE TABLE IF NOT EXISTS public.pi_a2u_transactions (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  payment_id TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0.01,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  txid TEXT,
  wallet_address TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pi_a2u_wallets (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  wallet_address TEXT NOT NULL,
  payment_id TEXT,
  txid TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_wallets_address
  ON public.pi_a2u_wallets(wallet_address);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_tx_success_uid
  ON public.pi_a2u_transactions(uid)
  WHERE status = 'success';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_wallets_payment_id
  ON public.pi_a2u_wallets(payment_id)
  WHERE payment_id IS NOT NULL;

-- Add payment_id column if it doesn't exist
ALTER TABLE public.pi_a2u_wallets
  ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Enable RLS
ALTER TABLE public.pi_a2u_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_a2u_transactions ENABLE ROW LEVEL SECURITY;

-- Public read policies (progress display)
CREATE POLICY IF NOT EXISTS "Anyone can view A2U wallet progress"
ON public.pi_a2u_wallets FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Anyone can view A2U transaction history"
ON public.pi_a2u_transactions FOR SELECT USING (true);

-- Service role can do all
CREATE POLICY IF NOT EXISTS "Service role manage A2U wallets"
ON public.pi_a2u_wallets FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role manage A2U transactions"
ON public.pi_a2u_transactions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
