# Deploy Pi A2U edge function + remind about secrets and migration
$ErrorActionPreference = "Stop"
$ProjectRef = "jzzbmoopwnvgxxirulga"

Write-Host "Deploying pi-a2u and pi-auth (A2U routes through pi-auth as fallback)..." -ForegroundColor Cyan

npx supabase functions deploy pi-a2u --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) {
    Write-Host "pi-a2u deploy failed. Trying pi-auth only (includes A2U handler)..." -ForegroundColor Yellow
}

npx supabase functions deploy pi-auth --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed. Log in: npx supabase login" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Set secrets (Pi Developer Portal):" -ForegroundColor Green
Write-Host '  npx supabase secrets set PI_A2U_API_KEY="your_key" --project-ref jzzbmoopwnvgxxirulga'
Write-Host '  npx supabase secrets set PI_WALLET_PRIVATE_SEED="S..." --project-ref jzzbmoopwnvgxxirulga'
Write-Host '  npx supabase secrets set PI_A2U_AMOUNT="0.01" --proje ct-ref jzzbmoopwnvgxxirulga'
Write-Host ""
Write-Host "Run SQL migration in Supabase Dashboard:" -ForegroundColor Green
Write-Host "  supabase/migrations/20260525000000_pi_a2u_tables.sql"
Write-Host ""
Write-Host "Done. Test: /testnet-reward and /admin/testnet-progress" -ForegroundColor Cyan
