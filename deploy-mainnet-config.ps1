#!/usr/bin/env pwsh
# ============================================
# Droplink Mainnet Deployment Script
# Deploy Pi Network Mainnet Configuration to Supabase
# ============================================

Write-Host "🚀 Droplink Mainnet Configuration Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseCLI = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCLI) {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Pi Network Mainnet Credentials
$PI_API_KEY = "x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw"
$PI_VALIDATION_KEY = "c8c119ed9f09ef7bfbca58a9874950d4dc305b14be8b7d680b3fb52002a51e3b8e0e0602fe7bc25d7e775548bd860a771dfff8261b67f0b328be5f91c348fe12"

Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "  API Key: $($PI_API_KEY.Substring(0, 20))..." -ForegroundColor White
Write-Host "  Validation Key: $($PI_VALIDATION_KEY.Substring(0, 20))..." -ForegroundColor White
Write-Host ""

# Confirm deployment
$confirmation = Read-Host "Deploy these credentials to Supabase? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔧 Setting Supabase secrets..." -ForegroundColor Cyan

# Set environment variables in Supabase
try {
    # Set PI_API_KEY
    Write-Host "  Setting PI_API_KEY..." -ForegroundColor White
    supabase secrets set PI_API_KEY="$PI_API_KEY" 2>&1 | Out-Null
    
    # Set PI_VALIDATION_KEY
    Write-Host "  Setting PI_VALIDATION_KEY..." -ForegroundColor White
    supabase secrets set PI_VALIDATION_KEY="$PI_VALIDATION_KEY" 2>&1 | Out-Null
    
    # Set additional mainnet configuration
    Write-Host "  Setting PI_API_BASE_URL..." -ForegroundColor White
    supabase secrets set PI_API_BASE_URL="https://api.minepi.com" 2>&1 | Out-Null
    
    Write-Host "  Setting PI_NETWORK..." -ForegroundColor White
    supabase secrets set PI_NETWORK="mainnet" 2>&1 | Out-Null
    
    Write-Host "  Setting PI_NETWORK_PASSPHRASE..." -ForegroundColor White
    supabase secrets set PI_NETWORK_PASSPHRASE="Pi Mainnet" 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "✅ Supabase secrets configured successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error setting Supabase secrets: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify secrets: supabase secrets list" -ForegroundColor White
Write-Host "  2. Redeploy your functions if needed" -ForegroundColor White
Write-Host "  3. Test payment flows in Pi Browser" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Documentation:" -ForegroundColor Cyan
Write-Host "  Pi Network Payments: https://pi-apps.github.io/community-developer-guide/" -ForegroundColor White
Write-Host "  Pi Ad Network: https://github.com/pi-apps/pi-platform-docs/tree/master" -ForegroundColor White
Write-Host ""
Write-Host "✨ Deployment complete!" -ForegroundColor Green
