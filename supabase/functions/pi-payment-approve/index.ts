// Pi Payment Approve Edge Function - MAINNET
// This function handles Phase I of the Pi Network 3-phase payment flow
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
    const { paymentId, metadata } = await req.json();

    if (!paymentId) {
      throw new Error("Payment ID is required");
    }

    console.log('[APPROVAL] 🔄 Starting approval for paymentId:', paymentId);
    console.log('[APPROVAL] Client metadata:', JSON.stringify(metadata || {}));

    // Get Pi API Key from environment
    const PI_API_KEY = Deno.env.get('VITE_PI_API_KEY') || Deno.env.get('PI_API_KEY');
    if (!PI_API_KEY) {
      console.error('[APPROVAL] ❌ PI_API_KEY not configured in environment');
      console.error('[APPROVAL] Available env vars:', Object.keys(Deno.env.toObject()).filter(k => k.includes('PI')));
      throw new Error("PI_API_KEY not configured - check environment variables");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('[APPROVAL] ❌ Supabase env missing', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceKey });
      throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check idempotency - prevent duplicate approvals
    const { data: existingPayment } = await supabase
      .from('payment_idempotency')
      .select('*')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (existingPayment && (existingPayment.status === 'completed' || existingPayment.status === 'approved')) {
      console.log('[APPROVAL] ✅ Payment already processed:', paymentId, existingPayment.status);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment already processed',
          payment: { id: paymentId, status: existingPayment.status }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Step 1: Get payment details from Pi API
    console.log(`[APPROVAL] \u{1F4E1} Fetching payment details from Pi ${PI_NETWORK.toUpperCase()} API...`);
    console.log(`[APPROVAL] Network: ${PI_NETWORK.toUpperCase()}`);
    const getPaymentResponse = await fetch(`${PI_API_BASE_URL}/v2/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getPaymentResponse.ok) {
      const errorText = await getPaymentResponse.text();
      console.error('[APPROVAL] ❌ Failed to get payment from Pi API:', getPaymentResponse.status, errorText);
      throw new Error(`Failed to fetch payment: ${errorText}`);
    }

    const paymentDetails = await getPaymentResponse.json();
    console.log('[APPROVAL] Payment details:', JSON.stringify(paymentDetails));

    // Extract status properly - handle both string and object status
    const paymentStatus = typeof paymentDetails.status === 'object' 
      ? paymentDetails.status?.developer_approved === false ? 'pending' : paymentDetails.status
      : paymentDetails.status;
    
    console.log('[APPROVAL] Payment status:', paymentStatus);

    // Check if payment can be approved (should be in a state where developer hasn't approved yet)
    const canApprove = 
      paymentStatus === 'pending' || 
      paymentStatus === 'created' ||
      (typeof paymentDetails.status === 'object' && paymentDetails.status?.developer_approved === false);

    if (!canApprove) {
      console.error('[APPROVAL] ❌ Payment not in approvable state:', paymentStatus);
      throw new Error(`Payment cannot be approved. Status: ${JSON.stringify(paymentStatus)}`);
    }

    // Merge metadata from Pi API and client
    const piMetadata = paymentDetails.metadata || {};
    const finalMetadata = { ...piMetadata, ...metadata };

    // Try to resolve profileId from metadata or username
    let profileId = finalMetadata.profileId || null;
    
    if (!profileId && finalMetadata.username) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', finalMetadata.username)
        .maybeSingle();
      
      if (profile) {
        profileId = profile.id;
        console.log('[APPROVAL] Resolved profileId from username:', profileId);
      }
    }

    // Record payment for idempotency
    try {
      await supabase
        .from('payment_idempotency')
        .upsert({
          payment_id: paymentId,
          profile_id: profileId,
          status: 'pending',
          metadata: {
            ...finalMetadata,
            amount: paymentDetails.amount,
            approvalStartedAt: new Date().toISOString()
          },
        }, { onConflict: 'payment_id' });
      console.log('[APPROVAL] Idempotency record created');
    } catch (err) {
      console.warn('[APPROVAL] Idempotency record error:', err);
    }

    // Step 2: Approve the payment with Pi API
    console.log(`[APPROVAL] \u{1F4E1} Approving payment with Pi ${PI_NETWORK.toUpperCase()} API...`);
    const approveResponse = await fetch(`${PI_API_BASE_URL}/v2/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!approveResponse.ok) {
      const errorText = await approveResponse.text();
      console.error('[APPROVAL] ❌ Pi API approval failed:', approveResponse.status, errorText);
      
      // Update idempotency record to failed
      await supabase
        .from('payment_idempotency')
        .update({ status: 'failed' })
        .eq('payment_id', paymentId);
      
      throw new Error(`Pi API approval failed: ${errorText}`);
    }

    const approvalResult = await approveResponse.json();
    console.log('[APPROVAL] ✅ Pi API approval result:', JSON.stringify(approvalResult));

    // Update idempotency record to approved
    await supabase
      .from('payment_idempotency')
      .update({ 
        status: 'approved',
        metadata: {
          ...finalMetadata,
          amount: paymentDetails.amount,
          approvedAt: new Date().toISOString(),
          approvalResult
        }
      })
      .eq('payment_id', paymentId);

    const totalTime = Date.now() - startTime;
    console.log('[APPROVAL] ✅ SUCCESS in', totalTime, 'ms:', {
      paymentId,
      profileId,
      amount: paymentDetails.amount
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        payment: approvalResult,
        message: 'Payment approved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[APPROVAL] ❌ FAILED in', totalTime, 'ms:', errorMsg);
    console.error('[APPROVAL] Stack trace:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMsg,
        details: 'Payment approval failed. Please ensure PI_API_KEY is configured correctly in Supabase Edge Functions.',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
