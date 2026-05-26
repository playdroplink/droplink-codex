# Deploy Edge Functions with Environment Variables
# This script deploys the Pi payment edge functions with proper environment configuration

Write-Host "🚀 Deploying Edge Functions to Supabase..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "📋 Loading environment variables from .env..." -ForegroundColor Green
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "⚠️  .env file not found" -ForegroundColor Yellow
}

# Get PI_API_KEY from environment
$PI_API_KEY = $env:PI_API_KEY
if (-not $PI_API_KEY) {
    Write-Host "❌ PI_API_KEY not found in environment variables" -ForegroundColor Red
    Write-Host "   Please set PI_API_KEY in your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PI_API_KEY found: $($PI_API_KEY.Substring(0, 10))..." -ForegroundColor Green
Write-Host ""

# Set secrets in Supabase
Write-Host "🔐 Setting secrets in Supabase..." -ForegroundColor Cyan
try {
    supabase secrets set PI_API_KEY="$PI_API_KEY" 2>&1 | Out-Null
    Write-Host "✅ PI_API_KEY secret configured" -ForegroundColor Green
    if ($env:SUPABASE_URL) {
        supabase secrets set SUPABASE_URL="$env:SUPABASE_URL" 2>&1 | Out-Null
        Write-Host "✅ SUPABASE_URL secret configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SUPABASE_URL not found in env; skipping" -ForegroundColor Yellow
    }
    if ($env:SUPABASE_SERVICE_ROLE_KEY) {
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$env:SUPABASE_SERVICE_ROLE_KEY" 2>&1 | Out-Null
        Write-Host "✅ SUPABASE_SERVICE_ROLE_KEY secret configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SUPABASE_SERVICE_ROLE_KEY not found in env; skipping" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Failed to set secret (may need to link project first)" -ForegroundColor Yellow
}

Write-Host ""

# Deploy edge functions
$functions = @(
    "pi-auth",
    "pi-a2u",
    "pi-payment-approve",
    "pi-payment-complete",
    "pi-ad-verify",
    "subscription"
)

foreach ($func in $functions) {
    Write-Host "📦 Deploying function: $func" -ForegroundColor Cyan
    try {
        supabase functions deploy $func --no-verify-jwt
        Write-Host "✅ $func deployed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to deploy $func" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify secrets: supabase secrets list" -ForegroundColor White
Write-Host "   2. Check function logs: supabase functions logs <function-name>" -ForegroundColor White
Write-Host "   3. Test payment flow in the app" -ForegroundColor White
