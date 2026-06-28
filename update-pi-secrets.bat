@echo off
REM Update Supabase secrets for Pi Network Mainnet API Key
REM Run this script to update the PI_API_KEY secret in Supabase

echo 🔐 Updating Supabase secrets for Pi Network Mainnet...
echo.

REM Set the new Pi API Key
call npx supabase secrets set PI_API_KEY=x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw
call npx supabase secrets set PI_A2U_API_KEY=x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw

REM Set the validation key
call npx supabase secrets set PI_VALIDATION_KEY=c8c119ed9f09ef7bfbca58a9874950d4dc305b14be8b7d680b3fb52002a51e3b8e0e0602fe7bc25d7e775548bd860a771dfff8261b67f0b328be5f91c348fe12

echo.
echo ✅ Secrets updated successfully!
echo.
echo ⚠️ IMPORTANT: Edge Functions must be redeployed to use the new secrets
echo Run: npx supabase functions deploy pi-payment-approve
echo Run: npx supabase functions deploy pi-payment-complete
echo.
pause
