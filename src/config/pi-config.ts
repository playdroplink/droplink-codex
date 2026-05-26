/**
 * Pi Network Configuration for DropLink (Mainnet or Sandbox)
 *
 * Official Documentation:
 * - Pi Developer Guide: https://pi-apps.github.io/community-developer-guide/
 * - Pi Payment API: https://pi-apps.github.io/community-developer-guide/
 * - Pi Ad Network: https://github.com/pi-apps/pi-platform-docs/tree/master
 */

import { isPiBrowserEnv } from "@/contexts/PiContext";

// Detect environment mode
const isTestnetMode = 
  import.meta.env.VITE_PI_NETWORK === 'testnet' || 
  window.location.hostname.includes('testnet') || 
  window.location.hostname.includes('localhost');

const sandboxFlag = isTestnetMode;

// Log configuration for debugging
if (typeof window !== 'undefined') {
  console.log(`[PI CONFIG] \u{1F310} Network Mode: ${isTestnetMode ? 'TESTNET (Sandbox)' : 'MAINNET (Production)'}`);
}

// Pi Network Credentials - From Pi Developer Portal
const PI_APP_ID = import.meta.env.VITE_PI_APP_ID ?? "droplink-317d26f51b67e992";
const PI_API_KEY = "x62ea5gjqi4fv1x5cojbi84al9zzdstehnnm3tfzjlt4bol8pq1eohej2udoelhw";
const PI_VALIDATION_KEY = "26ec4458680b98edc16b18ed68c2fb7841ee2c9d3b9cfdcfa82de36bea71f64074a2ee5d1fbea04762df431edb1458b44a2ff50679b16d93935b0b645e98174a";
const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL ?? "https://droplink.space";
const PAYMENT_RECEIVER_WALLET = import.meta.env.VITE_PI_PAYMENT_RECEIVER_WALLET ?? "GDSXE723WPHZ5RGIJCSYXTPKSOIGPTSXE4RF5U3JTNGTCHXON7ZVD4LJ";

// Base URLs based on network
const BASE_API_URL = isTestnetMode ? "https://api.testnet.minepi.com" : "https://api.minepi.com";
const HORIZON_URL = isTestnetMode ? "https://api.testnet.minepi.com" : "https://api.minepi.com";
const NETWORK_NAME = isTestnetMode ? "testnet" : "mainnet";
const NETWORK_PASSPHRASE = isTestnetMode ? "Pi Testnet" : "Pi Mainnet";

export const PI_CONFIG = {
  API_KEY: PI_API_KEY,
  BASE_URL: BASE_API_URL,
  NETWORK: NETWORK_NAME,
  NETWORK_PASSPHRASE,
  SANDBOX_MODE: sandboxFlag,
  ALLOW_MULTIPLE_ACCOUNTS: true,

  // Pi SDK Configuration - Following official guide
  SDK: {
    version: "2.0",
    sandbox: sandboxFlag,
  },
  
  // Official Documentation Links
  DOCUMENTATION: {
    DEVELOPER_GUIDE: "https://pi-apps.github.io/community-developer-guide/",
    PAYMENT_API: "https://pi-apps.github.io/community-developer-guide/",
    AD_NETWORK: "https://github.com/pi-apps/pi-platform-docs/tree/master",
    PLATFORM_DOCS: "https://github.com/pi-apps/pi-platform-docs",
  },
  
  // Authentication Scopes - Following official Pi SDK guide
  // username: Returns Pioneer's username for personalization
  // payments: Required to initialize Pi payments
  // wallet_address: Access wallet address for transactions
  // See: https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/piAppPlatform/piAppPlatformSDK/#scopes
  scopes: ['username', 'payments', 'wallet_address'],
  
  onIncompletePaymentFound: (payment: any) => {
    console.log('[PI CONFIG] ⚠️ Incomplete payment found from previous session:', payment);
    // Handle incomplete payments from previous sessions
    if (payment && payment.paymentId) {
      console.log('[PI CONFIG] 💾 Storing incomplete payment for recovery:', payment.paymentId);
      // Could optionally store this in localStorage for recovery flow
    }
  },
  
  CUSTOM_TOKENS: {
    example: {
      code: "EXAMPLE",
      issuer: "EXAMPLE_ISSUER_ADDRESS",
      name: "Example Token",
      home_domain: "example.com"
    }
  },
  
  // Validation key from validation-key.txt
  VALIDATION_KEY: PI_VALIDATION_KEY,
  
  // Subscription payment receiver wallet address
  PAYMENT_RECEIVER_WALLET: PAYMENT_RECEIVER_WALLET,
  
  PLATFORM_URL,
  MAINNET_URL: PLATFORM_URL,
  
  getAuthHeaders: (accessToken: string) => {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    // Add API key if available (required for Pi API authentication)
    if (PI_API_KEY) {
      headers['X-Api-Key'] = PI_API_KEY;
    }
    return headers;
  },
  
  ENDPOINTS: {
    ME: `${BASE_API_URL}/v2/me`,
    WALLETS: `${BASE_API_URL}/wallets`,
    TRANSACTIONS: `${BASE_API_URL}/transactions`,
    PAYMENTS: `${BASE_API_URL}/payments`,
    OPERATIONS: `${BASE_API_URL}/operations`,
    LEDGERS: `${BASE_API_URL}/ledgers`,
    EFFECTS: `${BASE_API_URL}/effects`,
    FEE_STATS: `${BASE_API_URL}/fee_stats`,
    PI_BLOCKCHAIN: `${BASE_API_URL}/blockchain`,
    PI_ASSETS: `${BASE_API_URL}/assets`,
    PI_ACCOUNT_BALANCES: `${BASE_API_URL}/accounts`,
    HORIZON: HORIZON_URL,
    PI_ASSET_DISCOVERY: `${BASE_API_URL}/assets`
  },

  // Mainnet token configuration should be added here if/when available
  // Example:
  // MAINNET_TOKEN: {
  //   code: "TOKEN",
  //   issuer: "MAINNET_ISSUER_ADDRESS",
  //   distributor: "MAINNET_DISTRIBUTOR_ADDRESS",
  //   name: "Your Token Name",
  //   home_domain: "yourtoken.com"
  // }
};

// Helper to check if Pi Network is available
export const isPiNetworkAvailable = (): boolean => {
  return isPiBrowserEnv();
};

// Helper to validate Pi configuration (sandbox or mainnet)
export const validatePiConfig = (): boolean => {
  return PI_CONFIG.API_KEY.length > 0 &&
         PI_CONFIG.VALIDATION_KEY.length > 0 &&
         PI_CONFIG.BASE_URL.length > 0 &&
         PI_CONFIG.NETWORK.length > 0 &&
         PI_CONFIG.SDK.version.length > 0;
};

// Network-aware validation to ensure SDK/base URL align with sandbox flag
export const validateMainnetConfig = (): boolean => {
  const isTestnet = PI_CONFIG.SANDBOX_MODE;
  const networkMatches = isTestnet 
    ? (PI_CONFIG.NETWORK === "testnet" || PI_CONFIG.NETWORK === "sandbox")
    : PI_CONFIG.NETWORK === "mainnet";
  
  const sdkMatches = PI_CONFIG.SDK.sandbox === isTestnet;
  const baseUrlMatches = isTestnet
    ? (PI_CONFIG.BASE_URL.includes("sandbox") || PI_CONFIG.BASE_URL.includes("testnet"))
    : PI_CONFIG.BASE_URL.includes("minepi.com");

  return validatePiConfig() && networkMatches && sdkMatches && baseUrlMatches;
};

// Enhanced Pi Network token detection for mainnet
export const getWalletTokens = async (walletAddress: string): Promise<any[]> => {
  try {
    console.log('🔍 Detecting Pi Network tokens for wallet:', walletAddress);
    
    // Try multiple detection methods for mainnet
    const detectionMethods = [
      detectViaPiMainnetAPI,
      detectViaStellarHorizon,
      detectViaDirectQuery
    ];
    
    const allTokens = [];
    
    for (const method of detectionMethods) {
      try {
        const tokens = await method(walletAddress);
        if (tokens && tokens.length > 0) {
          console.log(`✅ Found ${tokens.length} tokens via ${method.name}`);
          allTokens.push(...tokens);
        }
      } catch (error) {
        console.warn(`⚠️ Detection method ${method.name} failed:`, error);
        continue;
      }
    }
    
    // Remove duplicates
    const uniqueTokens = allTokens.filter((token, index, self) => 
      index === self.findIndex(t => t.asset_code === token.asset_code && t.asset_issuer === token.asset_issuer)
    );
    
    console.log(`📊 Total unique tokens found: ${uniqueTokens.length}`);
    return uniqueTokens;
  } catch (error) {
    console.error('❌ Failed to detect tokens:', error);
    return [];
  }
};

// Method 1: Detect via Pi Mainnet API
const detectViaPiMainnetAPI = async (walletAddress: string) => {
  const response = await fetch(
    `${PI_CONFIG.ENDPOINTS.PI_ACCOUNT_BALANCES}/${walletAddress}`,
    {
      headers: {
        'Authorization': `Bearer ${PI_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Pi API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.balances?.filter((balance: any) => balance.asset_type !== 'native') || [];
};

// Method 2: Detect via Stellar Horizon API
const detectViaStellarHorizon = async (walletAddress: string) => {
  const response = await fetch(
    `${PI_CONFIG.ENDPOINTS.HORIZON}/accounts/${walletAddress}/balances`
  );
  
  if (!response.ok) {
    throw new Error(`Horizon API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.balances?.filter((balance: any) => balance.asset_type !== 'native') || [];
};

// Method 3: Direct asset discovery query
const detectViaDirectQuery = async (walletAddress: string) => {
  try {
    const response = await fetch(
      `${PI_CONFIG.ENDPOINTS.PI_ASSET_DISCOVERY}?account=${walletAddress}`,
      {
        headers: {
          'Authorization': `Bearer ${PI_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Asset discovery error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.assets || [];
  } catch (error) {
    // Fallback to generic asset listing
    return [];
  }
};

// Create trustline for any Pi mainnet token
export const createTokenTrustline = async (tokenCode: string, tokenIssuer: string): Promise<boolean> => {
  try {
    console.log(`🔗 Creating trustline for token: ${tokenCode}`);
    
    if (typeof window !== 'undefined' && window.Pi) {
      const trustlineData = {
        amount: 0.0000001, // Minimum amount for trustline
        memo: `${tokenCode} trustline creation`,
        metadata: {
          type: 'change_trust',
          asset_code: tokenCode,
          asset_issuer: tokenIssuer,
          limit: "1000000000" // Default limit
        }
      };
      
      await window.Pi.createPayment(trustlineData, {
        onReadyForServerApproval: (paymentId: string) => {
          console.log(`📝 Trustline payment ready: ${paymentId}`);
        },
        onReadyForServerCompletion: (paymentId: string, txid: string) => {
          console.log(`✅ Trustline created successfully: ${txid}`);
        },
        onCancel: (paymentId: string) => {
          console.log(`❌ Trustline creation cancelled: ${paymentId}`);
        },
        onError: (error: Error) => {
          console.error(`❌ Trustline creation error:`, error);
          throw error;
        }
      });
      
      return true;
    }
    
    throw new Error('Pi Network SDK not available');
  } catch (error) {
    console.error('❌ Failed to create trustline:', error);
    return false;
  }
};

// Generic token balance checker
export const getTokenBalance = async (walletAddress: string, tokenCode?: string, tokenIssuer?: string): Promise<any> => {
  try {
    console.log(`🪙 Checking token balance for: ${tokenCode || 'all tokens'}`);
    
    const tokens = await getWalletTokens(walletAddress);
    
    if (tokenCode && tokenIssuer) {
      // Look for specific token
      const token = tokens.find(t => 
        t.asset_code === tokenCode && 
        t.asset_issuer === tokenIssuer
      );
      
      return token ? {
        balance: token.balance,
        hasTrustline: true,
        source: 'pi_mainnet',
        token_info: token
      } : {
        balance: "0",
        hasTrustline: false
      };
    } else {
      // Return all tokens
      return tokens;
    }
  } catch (error) {
    console.error('❌ Failed to get token balance:', error);
    return { balance: "0", hasTrustline: false };
  }
};

// Legacy function names for backwards compatibility - these now show warnings
export const getDROPTokenBalance = async (walletAddress: string): Promise<any> => {
  console.warn('⚠️ getDROPTokenBalance is deprecated. DROP token was configured for testnet only.');
  console.warn(`ℹ️ Use getTokenBalance() or getWalletTokens() for ${PI_CONFIG.SANDBOX_MODE ? 'sandbox' : 'mainnet'} token detection.`);
  return getTokenBalance(walletAddress);
};

export const createDROPTrustline = async (walletAddress: string): Promise<boolean> => {
  console.warn('⚠️ createDROPTrustline is deprecated. DROP token was configured for testnet only.');
  console.warn(`ℹ️ Use createTokenTrustline() for ${PI_CONFIG.SANDBOX_MODE ? 'sandbox' : 'mainnet'} tokens.`);
  return false;
};

export const addDROPToWallet = async (walletAddress: string): Promise<boolean> => {
  console.warn('⚠️ addDROPToWallet is deprecated. DROP token was configured for testnet only.');
  return false;
};

export const getAllWalletTokens = async (walletAddress: string): Promise<any[]> => {
  console.warn('⚠️ getAllWalletTokens is being renamed to getWalletTokens for clarity.');
  return getWalletTokens(walletAddress);
};

// IMPORTANT NOTE: 
// The DROP token configuration has been removed because it was testnet-specific.
// To implement proper mainnet tokens:
//
// 1. Token must be issued on Pi Mainnet (not testnet)
// 2. Must have a valid home_domain with proper pi.toml file
// 3. Must follow Pi Network token standards
// 4. Must be verified by Pi Network servers
//
// Example of proper mainnet token configuration when available:
// const MAINNET_TOKEN = {
//   code: "TOKEN",
//   issuer: "MAINNET_ISSUER_ADDRESS", 
//   home_domain: "yourtoken.com",
//   name: "Your Token Name"
// };

console.log(`✅ Pi Network Configuration loaded for ${PI_CONFIG.SANDBOX_MODE ? 'SANDBOX' : 'MAINNET'}`);
console.log('ℹ️ Previous testnet DROP token configuration has been removed');
console.log(`ℹ️ Use generic token detection methods for ${PI_CONFIG.SANDBOX_MODE ? 'sandbox' : 'mainnet'} tokens`);