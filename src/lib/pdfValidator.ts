import { MAX_PDF_SIZE_BYTES, PDF_HEADER_PROBE_BYTES, PDF_MAGIC_SIGNATURE } from './config';

export { MAX_PDF_SIZE_BYTES };

export type PdfValidationResult = { valid: true } | { valid: false; error: string };

// Sprawdza sygnaturę binarną %PDF- w pierwszych 1024 bajtach (ochrona przed plikiem np. .jpg przemianowanym na .pdf).
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC_SIGNATURE.length) {
    return false;
  }
  const headerSlice = bytes.subarray(0, PDF_HEADER_PROBE_BYTES);
  const headerText = new TextDecoder('latin1').decode(headerSlice);
  return headerText.includes(PDF_MAGIC_SIGNATURE);
}

export function validatePdfMetadata(
  file: Pick<File, 'name' | 'size' | 'type'>,
): PdfValidationResult {
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Wybrany plik jest pusty (0 B). Wybierz prawidłowy dokument PDF.',
    };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Plik jest za duży. Maksymalny dozwolony rozmiar dokumentu PDF to 10 MB.',
    };
  }

  const hasPdfExtension = file.name.trim().toLowerCase().endsWith('.pdf');
  const hasAllowedMime = file.type === 'application/pdf' || file.type === '';

  if (!hasPdfExtension || !hasAllowedMime) {
    return {
      valid: false,
      error: 'Nieobsługiwany format pliku. Wgraj dokument w formacie PDF (.pdf).',
    };
  }

  return { valid: true };
}

export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  const metadataCheck = validatePdfMetadata(file);
  if (!metadataCheck.valid) {
    return metadataCheck;
  }

  const headerBuffer = await file.slice(0, PDF_HEADER_PROBE_BYTES).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);

  if (!hasPdfMagicBytes(headerBytes)) {
    return {
      valid: false,
      error: 'Plik nie jest prawidłowym dokumentem PDF (brak sygnatury nagłówka %PDF-).',
    };
  }

  return { valid: true };
}
