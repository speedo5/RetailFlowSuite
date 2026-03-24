/**
 * =============================================================================
 * ENVIRONMENT CONFIGURATION
 * =============================================================================
 * 
 * Centralized environment configuration for the Finetech POS frontend.
 * All environment variables should be accessed through this file.
 * 
 * To configure:
 * 1. Copy .env.example to .env in the project root
 * 2. Update values as needed
 * 3. Restart the dev server
 * 
 * =============================================================================
 */

export const environment = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  
  // Feature Flags
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  
  // App Configuration
  appName: import.meta.env.VITE_APP_NAME || 'Finetech POS',
  companyName: import.meta.env.VITE_COMPANY_NAME || 'Finetech Media Ltd',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@finetech.co.ke',
  
  // Computed
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

/**
 * Debug logger - only logs when debug mode is enabled
 */
export const debugLog = (...args: unknown[]) => {
  if (environment.debugMode) {
    console.log('[DEBUG]', ...args);
  }
};

/**
 * Validate required environment variables
 * Call this on app startup to ensure proper configuration
 */
export const validateEnvironment = () => {
  const warnings: string[] = [];
  
  if (!import.meta.env.VITE_API_URL && !environment.useMockData) {
    warnings.push('VITE_API_URL is not set. Using default: http://localhost:5000/api');
  }
  
  if (environment.useMockData) {
    warnings.push('Running in MOCK DATA mode. API calls will use local mock data.');
  }
  
  if (warnings.length > 0 && environment.isDevelopment) {
    console.warn('=== Environment Warnings ===');
    warnings.forEach(w => console.warn(`⚠️ ${w}`));
    console.warn('============================');
  }
  
  return { isValid: true, warnings };
};

export default environment;
