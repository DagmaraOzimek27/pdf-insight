// Centralna konfiguracja stałych bezpieczeństwa, limitów i modelu dla Cloudflare Worker API Proxy.

export const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024; // 6 MB limit rozmiaru żądania HTTP
export const MAX_TEXT_LENGTH = 80_000;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_TOTAL_PAGES = 500;
export const MAX_IMAGES_PER_REQUEST = 5;
export const MAX_SINGLE_IMAGE_BASE64_LENGTH = 2 * 1024 * 1024;
export const MAX_RETRY_CODES = 5;

export const ALLOWED_ANALYZE_MODES = ['single', 'chunk', 'merge'] as const;

export const ALLOWED_RETRY_CODES = [
  'INVALID_JSON_RESPONSE',
  'DOCUMENT_METADATA_FORMAT',
  'SUMMARY_SENTENCE_COUNT',
  'KEY_POINTS_COUNT',
  'ENTITIES_FORMAT',
  'AMOUNTS_ISO4217',
  'DATES_ISO8601',
  'KEYWORDS_FORMAT',
  'SCHEMA_MISMATCH',
] as const;

export type ValidationRetryCode = (typeof ALLOWED_RETRY_CODES)[number];

export const RETRY_CODE_INSTRUCTIONS: Record<ValidationRetryCode, string> = {
  INVALID_JSON_RESPONSE:
    'Poprzednia odpowiedź nie była poprawnym obiektem JSON zgodnym ze schematem.',
  DOCUMENT_METADATA_FORMAT:
    'Popraw sekcję "document": wymagany dwuliterowy kod ISO 639-1 w polu "language", dozwolony "type" oraz data "YYYY-MM-DD" lub null.',
  SUMMARY_SENTENCE_COUNT:
    'Popraw pole "summary": musi zawierać dokładnie od 3 do 5 pełnych zdań zakończonych kropką.',
  KEY_POINTS_COUNT: 'Popraw pole "keyPoints": tablica musi zawierać od 3 do 7 niepustych punktów.',
  ENTITIES_FORMAT:
    'Popraw sekcję "entities": pola "organizations" i "people" muszą być tablicami niepustych napisów.',
  AMOUNTS_ISO4217:
    'Popraw pole "amounts": każda waluta w "currency" musi być 3-literowym kodem ISO 4217 wielkimi literami (np. PLN, EUR, USD — nigdy "zł").',
  DATES_ISO8601:
    'Popraw pole "dates": każda data musi być rzeczywistą datą kalendarzową w formacie YYYY-MM-DD.',
  KEYWORDS_FORMAT: 'Popraw pole "keywords": tablica niepustych słów kluczowych.',
  SCHEMA_MISMATCH: 'Popraw strukturę odpowiedzi tak, aby wszystkie wymagane pola były obecne.',
};

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
