import { BYTES_PER_KB, BYTES_PER_MB } from './config';

const POLISH_LANGUAGE_NAMES = new Intl.DisplayNames(['pl'], {
  type: 'language',
  fallback: 'none',
});

const AMOUNT_FORMATTER = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_MB).toFixed(2).replace('.', ',')} MB`;
  }
  if (bytes >= BYTES_PER_KB) {
    return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  }
  return `${bytes} B`;
}

export function formatLanguageCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  const displayName = POLISH_LANGUAGE_NAMES.of(normalized);
  if (displayName) {
    return `${displayName} (${normalized.toUpperCase()})`;
  }
  return normalized.toUpperCase();
}

export function formatAmountValue(value: number): string {
  return AMOUNT_FORMATTER.format(value);
}

export function formatTimestampPl(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return TIMESTAMP_FORMATTER.format(date);
}

export function buildJsonDownloadFileName(pdfFileName: string): string {
  const baseName = pdfFileName
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${baseName || 'dokument'}.insight.json`;
}
