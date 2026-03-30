/**
 * API Configuration
 * 서버/클라이언트에서 동일한 API URL 사용 보장
 */

// MBTI 전용 API Gateway
const PROD_URL = 'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev';
export const API_URL = import.meta.env.VITE_API_URL ?? PROD_URL;

console.log('API_URL configured:', API_URL);