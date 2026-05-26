// @ts-nocheck
// @ts-ignore-file - Deno edge function
/// <reference lib="deno.ns" />
declare const Deno: {
  env: { 
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
  };
};
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { A2U_ACTIONS, handlePiA2uRequest } from "../pi-a2u/handler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Simplified Pi Auth function for sign-in only
serve(async (req: Request) => {
  console.log(`[pi-auth] Incoming request: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    console.log(`[pi-auth] Request URL: ${url.pathname}${url.search ? '?' + url.search.substring(0, 20) + '...' : ''}`);
    
    // Validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("[pi-auth] Request body parse error:", parseError);
      throw new Error("Invalid request body - must be valid JSON");
    }

    const action = String(requestBody?.action || "");
    if (action && A2U_ACTIONS.has(action)) {
      console.log(`[pi-auth] Routing A2U action: ${action}`);
      return handlePiA2uRequest(req, requestBody);
    }

    const { accessToken } = requestBody;

    // Validate required fields
    if (!accessToken || typeof accessToken !== 'string') {
      console.error("Access token missing or invalid:", accessToken);
      throw new Error("Missing or invalid accessToken");
    }

    // Verify the access token with Pi API
    const piNetwork = Deno.env.get('PI_NETWORK') || 'testnet';
    const piApiUrl = piNetwork === 'testnet' ? 'https://api.testnet.minepi.com/v2/me' : 'https://api.minepi.com/v2/me';
    const piApiKey = Deno.env.get('PI_API_KEY') || Deno.env.get('VITE_PI_API_KEY');
    
    let piUserData;
    try {
      console.log(`Verifying token with Pi API (${piNetwork.toUpperCase()}): ${piApiUrl}`);
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      };
      
      if (piApiKey) {
        headers["X-Api-Key"] = piApiKey;
      }
      
      const piResponse = await fetch(piApiUrl, {
        headers,
      });

      const piResponseText = await piResponse.text();
      console.log(`Pi API raw response (${piResponse.status}):`, piResponseText);

      if (!piResponse.ok) {
        console.error("Pi API error:", piResponse.status, piResponseText);
        throw new Error(`Invalid Pi access token: ${piResponse.status} - ${piResponseText}`);
      }

      try {
        piUserData = JSON.parse(piResponseText);
      } catch (jsonError) {
        console.error("Failed to parse Pi API response JSON:", jsonError);
        throw new Error("Pi API response is not valid JSON");
      }
      console.log("Pi user verified:", JSON.stringify(piUserData));
    } catch (piError) {
      const errorMsg = piError instanceof Error ? piError.message : String(piError);
      console.error("Pi API verification failed:", errorMsg);
      throw new Error(`Failed to verify Pi access token: ${errorMsg}`);
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase environment variables missing", { hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseKey });
      throw new Error("Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);


    // Save Pi user data to Supabase, upsert on pi_user_id to avoid UNIQUE_VIOLATION
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert({
        username: piUserData.username,
        pi_user_id: piUserData.uid,
        business_name: piUserData.username,
        description: "",
        first_name: piUserData.first_name || "",
        last_name: piUserData.last_name || "",
        profile_photo: piUserData.profile_photo || ""
      }, { onConflict: "pi_user_id" })
      .select()
      .single();

    if (profileError) {
      console.error("Error saving profile to Supabase:", profileError);
      throw new Error("Failed to save profile to database");
    }

    // Return success response with profile information
    return new Response(
      JSON.stringify({ 
        success: true, 
        profile,
        piUser: {
          uid: piUserData.uid,
          username: piUserData.username,
          wallet_address: piUserData.wallet_address || null,
          meta: piUserData.meta || {},
        },
        emailSignIn: false, // Email sign-in is hidden
        emailSignUp: false  // Email sign-up is hidden
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    console.error("Pi auth error:", errorMessage);
    if (errorDetails) {
      console.error("Error details:", errorDetails);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        errorDetails
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});