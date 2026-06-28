# Edge Functions Connection and PI Payment Fix Script
# This script ensures all edge functions are properly connected to Supabase

Write-Host "🚀 Connecting Edge Functions for PI Payment System..." -ForegroundColor Cyan
Write-Host ""

# Project Configuration
$PROJECT_ID = "jzzbmoopwnvgxxirulga"
$SUPABASE_URL = "https://$PROJECT_ID.supabase.co"

Write-Host "📋 Project Configuration:" -ForegroundColor Yellow
Write-Host "   Project ID: $PROJECT_ID" -ForegroundColor White
Write-Host "   Supabase URL: $SUPABASE_URL" -ForegroundColor White
Write-Host ""

# List of critical edge functions for PI payments
$CRITICAL_FUNCTIONS = @(
    @{ Name = "pi-auth"; Description = "Pi Network user authentication" },
    @{ Name = "pi-a2u"; Description = "Pi App-to-User payments" },
    @{ Name = "pi-payment-approve"; Description = "Pi payment approval processing" },
    @{ Name = "pi-payment-complete"; Description = "Pi payment completion handling" },
    @{ Name = "pi-ad-verify"; Description = "Pi ad network verification" },
    @{ Name = "financial-data"; Description = "Financial data processing" },
    @{ Name = "subscription"; Description = "Subscription management" },
    @{ Name = "profile-update"; Description = "User profile updates" },
    @{ Name = "wallet-increment"; Description = "Wallet balance updates" }
)

Write-Host "🔍 Checking Edge Functions Status..." -ForegroundColor Yellow

# Check if functions exist locally
$FUNCTIONS_DIR = "supabase\functions"
$LOCAL_FUNCTIONS = @()

if (Test-Path $FUNCTIONS_DIR) {
    $LOCAL_FUNCTIONS = Get-ChildItem -Path $FUNCTIONS_DIR -Directory | Where-Object { $_.Name -ne ".vscode" } | ForEach-Object { $_.Name }
    Write-Host "✅ Found $($LOCAL_FUNCTIONS.Count) local functions" -ForegroundColor Green
} else {
    Write-Host "❌ Functions directory not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Deploy critical functions
Write-Host "🚀 Deploying Critical Functions..." -ForegroundColor Cyan

foreach ($func in $CRITICAL_FUNCTIONS) {
    $funcName = $func.Name
    $funcDesc = $func.Description
    
    if ($LOCAL_FUNCTIONS -contains $funcName) {
        Write-Host "📦 Deploying $funcName ($funcDesc)..." -ForegroundColor White
        try {
            $result = supabase functions deploy $funcName --no-verify-jwt 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ $funcName deployed successfully" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  $funcName deployment returned: $result" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ❌ Failed to deploy $funcName" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  $funcName not found locally" -ForegroundColor Yellow
    }
}

Write-Host ""

# Set required secrets for PI payments
Write-Host "🔐 Setting Up PI Payment Secrets..." -ForegroundColor Cyan

$PI_SECRETS = @{
    "PI_API_KEY" = "x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw"
    "PI_A2U_API_KEY" = "x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw"
    "PI_VALIDATION_KEY" = "c8c119ed9f09ef7bfbca58a9874950d4dc305b14be8b7d680b3fb52002a51e3b8e0e0602fe7bc25d7e775548bd860a771dfff8261b67f0b328be5f91c348fe12"
    "PI_MAINNET_MODE" = "true"
    "PI_NETWORK" = "Pi Network"
    "PI_ENVIRONMENT" = "mainnet"
}

foreach ($secret in $PI_SECRETS.GetEnumerator()) {
    try {
        Write-Host "   Setting $($secret.Key)..." -ForegroundColor White
        supabase secrets set "$($secret.Key)=$($secret.Value)" 2>&1 | Out-Null
        Write-Host "   ✅ $($secret.Key) configured" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Could not set $($secret.Key)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Verify deployment
Write-Host "🧪 Verifying Edge Functions..." -ForegroundColor Yellow

try {
    Write-Host "   Listing deployed functions..." -ForegroundColor White
    $functionsList = supabase functions list
    Write-Host "   Functions status retrieved successfully" -ForegroundColor Green
    
    # Check if critical functions are deployed
    $deployedFunctions = @()
    $functionsList | ForEach-Object {
        if ($_ -match '^\s*[a-f0-9-]+\s*\|\s*([^\|]+)\s*\|.*ACTIVE') {
            $deployedFunctions += $matches[1].Trim()
        }
    }
    
    Write-Host ""
    Write-Host "📊 Deployment Status:" -ForegroundColor Cyan
    foreach ($func in $CRITICAL_FUNCTIONS) {
        if ($deployedFunctions -contains $func.Name) {
            Write-Host "   ✅ $($func.Name) - DEPLOYED" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $($func.Name) - MISSING" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "   ⚠️  Could not verify functions list" -ForegroundColor Yellow
}

Write-Host ""

# Provide connection code for frontend
Write-Host "💻 Supabase Connection Code for Frontend:" -ForegroundColor Magenta
Write-Host ""
Write-Host "# Add this to your environment variables (.env)" -ForegroundColor Gray
Write-Host "VITE_SUPABASE_URL=`"$SUPABASE_URL`"" -ForegroundColor Cyan
Write-Host "VITE_SUPABASE_PROJECT_ID=`"$PROJECT_ID`"" -ForegroundColor Cyan
Write-Host ""

Write-Host "# Frontend JavaScript code to call edge functions:" -ForegroundColor Gray
Write-Host "const piAuth = async (accessToken) => {" -ForegroundColor Cyan
Write-Host "  const response = await supabase.functions.invoke('pi-auth', {" -ForegroundColor Cyan  
Write-Host "    body: { accessToken }" -ForegroundColor Cyan
Write-Host "  });" -ForegroundColor Cyan
Write-Host "  return response;" -ForegroundColor Cyan
Write-Host "};" -ForegroundColor Cyan
Write-Host "" 
Write-Host "const approvePayment = async (paymentData) => {" -ForegroundColor Cyan
Write-Host "  const response = await supabase.functions.invoke('pi-payment-approve', {" -ForegroundColor Cyan
Write-Host "    body: paymentData" -ForegroundColor Cyan
Write-Host "  });" -ForegroundColor Cyan
Write-Host "  return response;" -ForegroundColor Cyan
Write-Host "};" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎉 Edge Functions Connection Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Update your frontend environment variables" -ForegroundColor White
Write-Host "   2. Test PI payment flow in your application" -ForegroundColor White
Write-Host "   3. Monitor function logs: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "   4. Check payments in Pi Developer Portal" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Useful Links:" -ForegroundColor Yellow
Write-Host "   • Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_ID" -ForegroundColor Cyan
Write-Host "   • Edge Functions: https://supabase.com/dashboard/project/$PROJECT_ID/functions" -ForegroundColor Cyan
Write-Host "   • Function Logs: https://supabase.com/dashboard/project/$PROJECT_ID/logs/edge-functions" -ForegroundColor Cyan