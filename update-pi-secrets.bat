@echo off
REM Update Supabase secrets for Pi Network Mainnet API Key
REM Run this script to update the PI_API_KEY secret in Supabase

echo 🔐 Updating Supabase secrets for Pi Network Mainnet...
echo.

REM Set the new Pi API Key
call npx supabase secrets set PI_API_KEY=x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw
call npx supabase secrets set PI_A2U_API_KEY=x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw

REM Set the validation key
call npx supabase secrets set PI_VALIDATION_KEY=26ec4458680b98edc16b18ed68c2fb7841ee2c9d3b9cfdcfa82de36bea71f64074a2ee5d1fbea04762df431edb1458b44a2ff50679b16d93935b0b645e98174a

echo.
echo ✅ Secrets updated successfully!
echo.
echo ⚠️ IMPORTANT: Edge Functions must be redeployed to use the new secrets
echo Run: npx supabase functions deploy pi-payment-approve
echo Run: npx supabase functions deploy pi-payment-complete
echo.
pause
