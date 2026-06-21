/**
 * Secure Logging Utility
 * Prevents accidental exposure of sensitive environment variables and data
 */

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

interface SecureLogOptions {
  maskSensitive?: boolean;
  environment?: 'development' | 'production';
}

// List of sensitive keywords that should be masked
const SENSITIVE_KEYWORDS = [
  'api_key',
  'apikey',
  'secret',
  'password',
  'token',
  'private_key',
  'privatekey',
  'auth',
  'authorization',
  'bearer',
  'jwt',
  'session',
  'cookie',
  'supabase_key',
  'database_url',
  'connection_string',
];

/**
 * Masks sensitive data in strings
 */
function maskSensitiveData(value: any): any {
  if (typeof value === 'string') {
    // Check if the string contains sensitive keywords
    const lowerValue = value.toLowerCase();
    const isSensitive = SENSITIVE_KEYWORDS.some(keyword => 
      lowerValue.includes(keyword) || 
      lowerValue.includes(`vite_${keyword}`) ||
      lowerValue.includes(`${keyword}_`)
    );
    
    if (isSensitive && value.length > 8) {
      // Mask all but first 4 and last 4 characters for long sensitive strings
      return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
    }
    return value;
  }
  
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(item => maskSensitiveData(item));
    }
    
    const maskedObj: any = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      const isKeysensitive = SENSITIVE_KEYWORDS.some(keyword => 
        lowerKey.includes(keyword) || 
        lowerKey.includes(`vite_${keyword}`) ||
        lowerKey.includes(`${keyword}_`)
      );
      
      if (isKeysensitive && typeof val === 'string' && val.length > 8) {
        maskedObj[key] = `${val.substring(0, 4)}${'*'.repeat(val.length - 8)}${val.substring(val.length - 4)}`;
      } else {
        maskedObj[key] = maskSensitiveData(val);
      }
    }
    return maskedObj;
  }
  
  return value;
}

/**
 * Secure console log that automatically masks sensitive data
 */
class SecureLogger {
  private options: SecureLogOptions;

  constructor(options: SecureLogOptions = {}) {
    this.options = {
      maskSensitive: true,
      environment: (import.meta.env.MODE as 'development' | 'production') || 'development',
      ...options,
    };
  }

  private processArgs(args: any[]): any[] {
    if (!this.options.maskSensitive) {
      return args;
    }
    
    return args.map(arg => maskSensitiveData(arg));
  }

  private shouldLog(): boolean {
    // In production, reduce logging unless explicitly needed
    return this.options.environment === 'development' || import.meta.env.VITE_ENABLE_PRODUCTION_LOGS === 'true';
  }

  log(...args: any[]): void {
    if (this.shouldLog()) {
      console.log(...this.processArgs(args));
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(...this.processArgs(args));
    }
  }

  error(...args: any[]): void {
    // Always log errors, but mask sensitive data
    console.error(...this.processArgs(args));
  }

  debug(...args: any[]): void {
    if (this.shouldLog() && (import.meta.env.VITE_DEBUG_LOGS === 'true' || this.options.environment === 'development')) {
      console.debug(...this.processArgs(args));
    }
  }

  /**
   * Log environment variable status without exposing values
   */
  logEnvStatus(envName: string, value?: string): void {
    const hasValue = !!(value || import.meta.env[envName]);
    const prefix = envName.startsWith('VITE_') ? '[CLIENT ENV]' : '[SERVER ENV]';
    
    if (hasValue) {
      this.log(`${prefix} ✅ ${envName} is configured`);
    } else {
      this.warn(`${prefix} ❌ ${envName} is missing`);
    }
  }

  /**
   * Log API status without exposing keys
   */
  logApiStatus(serviceName: string, apiKey?: string): void {
    const hasKey = !!apiKey;
    if (hasKey) {
      this.log(`🔑 ${serviceName} API key is configured`);
    } else {
      this.warn(`🔑 ${serviceName} API key is missing`);
    }
  }
}

// Create default logger instance
export const secureLog = new SecureLogger();

// Export class for custom configurations
export { SecureLogger };

// Export utility functions
export { maskSensitiveData };

// Convenience functions for common logging patterns
export const logEnvStatus = (envName: string, value?: string) => secureLog.logEnvStatus(envName, value);
export const logApiStatus = (serviceName: string, apiKey?: string) => secureLog.logApiStatus(serviceName, apiKey);