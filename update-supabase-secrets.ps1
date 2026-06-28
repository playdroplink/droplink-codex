# Update Supabase Secrets with New Pi API Key
# Run this to update edge function environment variables

Write-Host "🔧 Updating Supabase Edge Function Secrets..." -ForegroundColor Cyan
Write-Host ""

# New Pi API Key
$PI_API_KEY = "zmdsfbedi4idcsniyy7ee1twwulq2cbruighxqgtqozyk6ph1fjswft69cddgqwk"
$PI_VALIDATION_KEY = "c8c119ed9f09ef7bfbca58a9874950d4dc305b14be8b7d680b3fb52002a51e3b8e0e0602fe7bc25d7e775548bd860a771dfff8261b67f0b328be5f91c348fe12"

Write-Host "📋 Secrets to update:" -ForegroundColor Yellow
Write-Host "  • PI_API_KEY: $($PI_API_KEY.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  • VITE_PI_API_KEY: $($PI_API_KEY.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  • PI_VALIDATION_KEY: $($PI_VALIDATION_KEY.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Method 1: Using Supabase Dashboard (RECOMMENDED)
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "METHOD 1: Update via Supabase Dashboard (Recommended)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://supabase.com/dashboard/project/jzzbmoopwnvgxxirulga/settings/vault" -ForegroundColor White
Write-Host ""
Write-Host "2. Add/Update these secrets:" -ForegroundColor White
Write-Host ""
Write-Host "   Name: PI_API_KEY" -ForegroundColor Yellow
Write-Host "   Value: $PI_API_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "   Name: VITE_PI_API_KEY" -ForegroundColor Yellow
Write-Host "   Value: $PI_API_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "   Name: PI_VALIDATION_KEY" -ForegroundColor Yellow
Write-Host "   Value: $PI_VALIDATION_KEY" -ForegroundColor Gray
Write-Host ""

# Method 2: Using Supabase CLI
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "METHOD 2: Update via Supabase CLI" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these commands:" -ForegroundColor White
Write-Host ""
Write-Host "npx supabase secrets set PI_API_KEY=`"$PI_API_KEY`"" -ForegroundColor Yellow
Write-Host "npx supabase secrets set VITE_PI_API_KEY=`"$PI_API_KEY`"" -ForegroundColor Yellow
Write-Host "npx supabase secrets set PI_VALIDATION_KEY=`"$PI_VALIDATION_KEY`"" -ForegroundColor Yellow
Write-Host ""

# Copy commands to clipboard option
$copyToClipboard = Read-Host "Copy CLI commands to clipboard? (y/n)"
if ($copyToClipboard -eq 'y') {
    $commands = @"
npx supabase secrets set PI_API_KEY="$PI_API_KEY"
npx supabase secrets set VITE_PI_API_KEY="$PI_API_KEY"
npx supabase secrets set PI_VALIDATION_KEY="$PI_VALIDATION_KEY"
"@
    Set-Clipboard -Value $commands
    Write-Host "✅ Commands copied to clipboard!" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "EDGE FUNCTIONS THAT USE PI_API_KEY:" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ pi-auth" -ForegroundColor Gray
Write-Host "✓ pi-payment-approve" -ForegroundColor Gray
Write-Host "✓ pi-payment-complete" -ForegroundColor Gray
Write-Host "✓ verify-payment" -ForegroundColor Gray
Write-Host "✓ verify-ad-reward" -ForegroundColor Gray
Write-Host "✓ pi-ad-verify" -ForegroundColor Gray
Write-Host ""
Write-Host "After updating secrets, these functions will use the new API key automatically." -ForegroundColor Cyan
Write-Host ""
