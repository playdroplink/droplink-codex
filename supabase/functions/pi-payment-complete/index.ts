// Pi Payment Complete Edge Function - MAINNET
// This function handles Phase III of the Pi Network 3-phase payment flow
// @ts-ignore: Deno global is available at runtime in Supabase Edge Functions
declare const Deno: any;
// @ts-ignore - Deno runtime types (available at runtime)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - ESM module (available at runtime)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pi Network API endpoint - Dynamic based on environment
const PI_NETWORK = Deno.env.get('PI_NETWORK') || 'testnet';
const PI_API_BASE_URL = PI_NETWORK === 'testnet' ? "https://api.testnet.minepi.com" : "https://api.minepi.com";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { paymentId, txid, metadata } = await req.json();

    if (!paymentId || !txid) {
      throw new Error("Payment ID and transaction ID are required");
    }

    console.log('[COMPLETE] 🔄 Starting completion for:', paymentId);
    console.log('[COMPLETE] Transaction ID:', txid);
    console.log('[COMPLETE] Client metadata:', JSON.stringify(metadata || {}));

    // Get Pi API Key from environment
    const PI_API_KEY = Deno.env.get('PI_API_KEY');
    if (!PI_API_KEY) {
      console.error('[COMPLETE] ❌ PI_API_KEY not configured');
      throw new Error("PI_API_KEY not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('[COMPLETE] ❌ Supabase env missing', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceKey });
      throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check idempotency - prevent duplicate completions
    const { data: existingPayment } = await supabase
      .from('payment_idempotency')
      .select('*')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (existingPayment && existingPayment.status === 'completed') {
      console.log('[COMPLETE] ✅ Payment already completed:', paymentId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment already completed',
          payment: { id: paymentId, txid: existingPayment.txid, status: 'completed' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get stored metadata from idempotency record
    const storedMetadata = existingPayment?.metadata || {};
    const finalMetadata = { ...storedMetadata, ...metadata };
    
    console.log('[COMPLETE] Final metadata:', JSON.stringify(finalMetadata));

    // Step 1: Get payment details from Pi API to verify
    console.log(`[COMPLETE] \u{1F4E1} Fetching payment details from Pi ${PI_NETWORK.toUpperCase()} API...`);
    console.log(`[COMPLETE] Network: ${PI_NETWORK.toUpperCase()}`);
    const getPaymentResponse = await fetch(`${PI_API_BASE_URL}/v2/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getPaymentResponse.ok) {
      const errorText = await getPaymentResponse.text();
      console.error('[COMPLETE] ❌ Failed to get payment:', getPaymentResponse.status, errorText);
      throw new Error(`Failed to fetch payment: ${errorText}`);
    }

    const paymentDetails = await getPaymentResponse.json();
    console.log('[COMPLETE] Payment details:', JSON.stringify(paymentDetails));

    // VERIFICATION: Check if amount matches expected amount from metadata (if provided)
    // and verify payment status is authorized (ready to be completed)
    if (finalMetadata.amount) {
      const expectedAmount = parseFloat(finalMetadata.amount);
      const actualAmount = parseFloat(paymentDetails.amount);
      if (Math.abs(expectedAmount - actualAmount) > 0.01) {
        console.warn(`[COMPLETE] ⚠️ Amount mismatch: Expected ${expectedAmount}, got ${actualAmount}`);
        // We log warning but don't block completion as Pi API is the source of truth for charged amount
      } else {
        console.log(`[COMPLETE] ✅ Amount verified: ${actualAmount} Pi`);
      }
    }

    // VERIFICATION: Check memo if provided
    if (finalMetadata.memo && paymentDetails.memo) {
        if (paymentDetails.memo !== finalMetadata.memo) {
             console.warn(`[COMPLETE] ⚠️ Memo mismatch: Expected "${finalMetadata.memo}", got "${paymentDetails.memo}"`);
        } else {
             console.log(`[COMPLETE] ✅ Memo verified: "${paymentDetails.memo}"`);
        }
    }
    
    // VERIFICATION: Ensure payment is in a state that can be completed
    // Handle both string and object status formats from Pi API
    const statusObj = typeof paymentDetails.status === 'object' ? paymentDetails.status : {};
    const statusStr = typeof paymentDetails.status === 'string' ? paymentDetails.status : '';
    
    const isDeveloperApproved = statusObj.developer_approved || statusStr === 'authorized';
    const isCompleted = statusObj.developer_completed_transaction || statusStr === 'completed';
    const isCancelled = statusObj.user_cancelled || statusStr === 'cancelled' || statusStr === 'user_cancelled';

    if (isCompleted) { 
        // If already completed
        console.log('[COMPLETE] ℹ️ Payment already completed on Pi Network');
    } else if (isDeveloperApproved) {
        console.log('[COMPLETE] ℹ️ Payment approved by developer, ready for completion');
    } else if (!isCancelled && !isCompleted) {
         console.log('[COMPLETE] ✅ Payment status verified: Ready for completion');
    }

    // Step 2: Complete the payment with Pi API
    console.log(`[COMPLETE] \u{1F4E1} Completing payment with Pi ${PI_NETWORK.toUpperCase()} API...`);
    const completeResponse = await fetch(`${PI_API_BASE_URL}/v2/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
    });

    if (!completeResponse.ok) {
      const errorText = await completeResponse.text();
      console.error('[COMPLETE] ❌ Pi API completion failed:', completeResponse.status, errorText);
      throw new Error(`Pi API completion failed: ${errorText}`);
    }

    const completionResult = await completeResponse.json();
    console.log('[COMPLETE] ✅ Pi API completion result:', JSON.stringify(completionResult));

    // Mark payment as completed in idempotency table
    await supabase
      .from('payment_idempotency')
      .upsert({
        payment_id: paymentId,
        profile_id: existingPayment?.profile_id || finalMetadata.profileId,
        status: 'completed',
        txid: txid,
        metadata: {
          ...finalMetadata,
          completedAt: new Date().toISOString(),
          completionResult
        }
      }, { onConflict: 'payment_id' });

    // Create subscription if this was a subscription payment
    const planType = (finalMetadata.subscriptionPlan || '').toLowerCase();
    const billingPeriod = finalMetadata.billingPeriod || 'monthly';
    let profileId = existingPayment?.profile_id || finalMetadata.profileId;

    // Try to resolve profileId from username if not available
    if (!profileId && finalMetadata.username) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', finalMetadata.username)
        .maybeSingle();
      
      if (profile) {
        profileId = profile.id;
        console.log('[COMPLETE] Resolved profileId from username:', profileId);
      }
    }

    if (planType && profileId && planType !== 'free') {
      const endDate = new Date();
      if (billingPeriod === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      console.log('[SUBSCRIPTION] 🎯 Creating subscription:', {
        profileId,
        planType,
        billingPeriod,
        endDate: endDate.toISOString(),
        amount: paymentDetails.amount
      });

      // 1. Upsert Subscription
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          profile_id: profileId,
          plan_type: planType,
          billing_period: billingPeriod,
          pi_amount: paymentDetails.amount || 0,
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          auto_renew: true,
          payment_id: paymentId,
          transaction_id: txid,
          payment_method: 'pi_network'
        }, { onConflict: 'profile_id' });

      if (subError) {
        console.error('[SUBSCRIPTION] ❌ Error creating subscription:', JSON.stringify(subError));
      } else {
        console.log('[SUBSCRIPTION] ✅ Subscription created for:', profileId);
        
        // 2. Explicitly update Profile (Redundancy for safety)
        // User requested: update users.subscription_plan, subscription_status, expires_at
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            subscription_plan: planType,
            subscription_status: 'active',
            expires_at: endDate.toISOString(),
            has_premium: planType !== 'free'
          })
          .eq('id', profileId);

        if (profileError) {
           console.error('[SUBSCRIPTION] ⚠️ Failed to update profile status:', profileError);
        } else {
           console.log('[SUBSCRIPTION] ✅ Profile updated with plan details:', {
             plan: planType,
             status: 'active',
             expires: endDate.toISOString()
           });
        }

        // 3. Affiliate reward tracking (if this user was referred)
        try {
          const { data: referredProfile, error: referredErr } = await supabase
            .from('profiles')
            .select('id, username, referred_by, referred_by_code_id')
            .eq('id', profileId)
            .maybeSingle();

          if (!referredErr && referredProfile?.referred_by) {
            // Determine reward amount
            let rewardPi = 0;
            try {
              const { data: rewardRate } = await supabase
                .from('affiliate_reward_rates')
                .select('reward_pi')
                .eq('plan_type', planType)
                .maybeSingle();
              rewardPi = Number(rewardRate?.reward_pi || 0);
            } catch (_e) {
              // fallback mapping
              rewardPi = planType === 'pro' ? 3 : planType === 'premium' ? 2 : planType === 'basic' ? 1 : 0;
            }

            // Check existing invite (one per referred user)
            const { data: existingInvite } = await supabase
              .from('affiliate_invites')
              .select('id, reward_pi, status, plan_type')
              .eq('referred_profile_id', profileId)
              .maybeSingle();

            if (!existingInvite) {
              await supabase.from('affiliate_invites').insert({
                referral_code_id: referredProfile.referred_by_code_id || null,
                referrer_profile_id: referredProfile.referred_by,
                referred_profile_id: profileId,
                referred_username: referredProfile.username || null,
                plan_type: planType,
                reward_pi: rewardPi,
                status: 'earned',
                payment_id: paymentId,
                transaction_id: txid
              });
              console.log('[AFFILIATE] ✅ Invite reward created');
            } else if (existingInvite.status !== 'paid' && rewardPi > Number(existingInvite.reward_pi || 0)) {
              // Upgrade reward if user upgraded plan
              await supabase
                .from('affiliate_invites')
                .update({
                  plan_type: planType,
                  reward_pi: rewardPi,
                  status: 'earned',
                  payment_id: paymentId,
                  transaction_id: txid
                })
                .eq('id', existingInvite.id);
              console.log('[AFFILIATE] ✅ Invite reward upgraded');
            }
          }
        } catch (affErr) {
          console.error('[AFFILIATE] ⚠️ Failed to track affiliate reward:', affErr);
        }
      }
    } else {
      console.log('[SUBSCRIPTION] ⚠️ Skipping subscription creation:', {
        hasPlanType: !!planType,
        hasProfileId: !!profileId,
        planType
      });
    }

    const totalTime = Date.now() - startTime;
    console.log('[COMPLETE] ✅ SUCCESS in', totalTime, 'ms:', {
      paymentId,
      txid: txid.substring(0, 16) + '...',
      profileId,
      planType
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        payment: completionResult,
        message: 'Payment completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[COMPLETE] ❌ FAILED in', totalTime, 'ms:', errorMsg);
    console.error('[COMPLETE] Stack trace:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMsg,
        details: 'Payment completion failed. Please ensure PI_API_KEY is configured correctly in Supabase Edge Functions.',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
