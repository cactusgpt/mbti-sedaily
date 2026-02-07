// Runtime API configuration
// This allows changing API URL without rebuilding

function getApiUrl(): string {
  // For server-side rendering
  if (typeof window === 'undefined') {
    // Try to read from runtime environment first
    return process.env.API_URL || 
           process.env.NEXT_PUBLIC_API_URL || 
           'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev';
  }
  
  // For client-side, always use the hardcoded URL
  // since we can't access server env vars from browser
  return 'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev';
}

export const API_URL = getApiUrl();