// Centralna konfiguracja stałych, limitów i progów aplikacji frontendowej (Single Source of Truth).

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB zgodnie z wymogiem F-01
export const PDF_HEADER_PROBE_BYTES = 1024;
export const PDF_MAGIC_SIGNATURE = '%PDF-';

export const MIN_TEXT_CHARS_PER_PAGE = 25;
export const MAX_SCANNED_PAGE_IMAGES = 5;
export const DEFAULT_MAX_CHARS_PER_CHUNK = 24_000;
export const MIN_CHUNK_BODY_BUDGET_CHARS = 500;
export const SCAN_RENDER_SCALE = 1.5;
export const SCAN_JPEG_QUALITY = 0.82;
export const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

export const SUMMARY_MIN_SENTENCES = 3;
export const SUMMARY_MAX_SENTENCES = 5;
export const KEY_POINTS_MIN_ITEMS = 3;
export const KEY_POINTS_MAX_ITEMS = 7;

export const DEFAULT_DEV_API_URL = 'http://localhost:8787';
export const REQUEST_TIMEOUT_MS = 28_000;
export const MAX_AI_ATTEMPTS = 2; // 1 próba podstawowa + maksymalnie 1 ponowna próba (sekcja 04)
export const MAX_VALIDATION_ISSUES_IN_FEEDBACK = 5;
export const MAX_CHUNKS_TO_ANALYZE = 6;

export const HISTORY_STORAGE_KEY = 'pdf-insight:history:v1';
export const MAX_HISTORY_ITEMS = 10;
export const MIN_SUPPORTED_VIEWPORT_PX = 360;
