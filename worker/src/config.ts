// Centralna konfiguracja stałych bezpieczeństwa, limitów i modelu dla Cloudflare Worker API Proxy.

export const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024; // 6 MB limit rozmiaru żądania HTTP
export const MAX_TEXT_LENGTH = 80_000;
export const MAX_IMAGES_PER_REQUEST = 5;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 15;
export const RATE_LIMIT_RETRY_AFTER_SECONDS = '60';
export const CORS_MAX_AGE_SECONDS = '86400';

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://dagmaraozimek27.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
] as const;
export const GEMINI_TEMPERATURE = 0.1;
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
