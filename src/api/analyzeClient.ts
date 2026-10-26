import type { ZodIssue } from 'zod';
import type { ExtractedPdfDocument, ScannedPageImage } from '../lib/pdfExtractor';
import { validatePdfInsight, type PdfInsightResult } from '../lib/schema';

export const MAX_CHUNKS_TO_ANALYZE = 6;
const REQUEST_TIMEOUT_MS = 28_000;
const DEFAULT_DEV_API_URL = 'http://localhost:8787';

export type AnalysisProgressStage =
  | { stage: 'analyzing'; message: string }
  | { stage: 'retrying'; message: string }
  | { stage: 'chunk'; current: number; total: number; message: string }
  | { stage: 'merging'; message: string };

export interface AnalyzeClientOptions {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgressStage) => void;
}

interface ProxyAnalyzeRequest {
  fileName: string;
  totalPages: number;
  text: string;
  scannedImages: ScannedPageImage[];
  mode: 'single' | 'chunk' | 'merge';
  chunkInfo?: {
    chunkIndex: number;
    totalChunks: number;
  };
  validationFeedback?: string;
}

export class ApiClientError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}

export function resolveApiBaseUrl(explicitUrl?: string): string {
  const configured = explicitUrl ?? import.meta.env.VITE_API_URL ?? '';
  const trimmed = String(configured).trim().replace(/\/+$/, '');
  if (trimmed.length > 0) {
    return trimmed;
  }
  return DEFAULT_DEV_API_URL;
}

function formatValidationIssues(issues: ReadonlyArray<ZodIssue>): string {
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function syncVerifiedDocumentMetadata(
  rawCandidate: unknown,
  fileName: string,
  totalPages: number,
): unknown {
  if (typeof rawCandidate !== 'object' || rawCandidate === null) {
    return rawCandidate;
  }

  const record = rawCandidate as Record<string, unknown>;
  if (typeof record.document !== 'object' || record.document === null) {
    return rawCandidate;
  }

  return {
    ...record,
    document: {
      ...(record.document as Record<string, unknown>),
      fileName,
      pages: totalPages,
    },
  };
}

function createAttemptSignal(externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function postAnalyzeOnce(
  endpointUrl: string,
  payload: ProxyAnalyzeRequest,
  fetchImpl: typeof fetch,
  externalSignal?: AbortSignal,
): Promise<{ status: number; body: unknown }> {
  const { signal, cleanup } = createAttemptSignal(externalSignal);

  try {
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    let parsedBody: unknown = null;
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }

    return { status: response.status, body: parsedBody };
  } catch (error: unknown) {
    if (externalSignal?.aborted) {
      throw new ApiClientError('Analiza została przerwana przez użytkownika.');
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError(
        'Przekroczono czas oczekiwania na odpowiedź serwera AI. Spróbuj ponownie.',
      );
    }
    throw new ApiClientError(
      'Brak połączenia z serwerem analizy AI. Sprawdź połączenie internetowe i spróbuj ponownie.',
    );
  } finally {
    cleanup();
  }
}

function extractProxyErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

// Wysyła żądanie do API proxy i waliduje wynik w Zod; przy błędnej odpowiedzi AI wykonuje dokładnie 1 ponowną próbę (sekcja 04).
export async function requestValidatedInsight(
  basePayload: Omit<ProxyAnalyzeRequest, 'validationFeedback'>,
  options: AnalyzeClientOptions = {},
): Promise<PdfInsightResult> {
  const endpointUrl = `${resolveApiBaseUrl(options.apiUrl)}/api/analyze`;
  const fetchImpl = options.fetchImpl ?? fetch;

  let feedbackForRetry: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (attempt === 2) {
      options.onProgress?.({
        stage: 'retrying',
        message: 'Odpowiedź AI wymagała korekty formatu — trwa ponowna próba (1/1)...',
      });
    }

    const requestPayload: ProxyAnalyzeRequest = feedbackForRetry
      ? { ...basePayload, validationFeedback: feedbackForRetry }
      : basePayload;

    const { status, body } = await postAnalyzeOnce(
      endpointUrl,
      requestPayload,
      fetchImpl,
      options.signal,
    );

    // Błędy klienta/limitów (400, 403, 413, 429, 500) nie wynikają z formatu JSON modelu — nie ponawiamy ich.
    if (
      status === 400 ||
      status === 403 ||
      status === 404 ||
      status === 413 ||
      status === 429 ||
      status === 500
    ) {
      throw new ApiClientError(
        extractProxyErrorMessage(
          body,
          ` Żądanie zostało odrzucone przez serwer (kod ${status}).`,
        ).trim(),
        status,
      );
    }

    if (status !== 200) {
      if (attempt === 1) {
        feedbackForRetry =
          'Poprzednia odpowiedź nie była poprawnym obiektem JSON zgodnym ze schematem.';
        continue;
      }
      throw new ApiClientError(
        extractProxyErrorMessage(
          body,
          'Model AI nie zdołał wygenerować poprawnej odpowiedzi. Spróbuj ponownie.',
        ),
        status,
      );
    }

    const rawData =
      typeof body === 'object' && body !== null && 'data' in body
        ? (body as { data: unknown }).data
        : null;

    const candidate = syncVerifiedDocumentMetadata(
      rawData,
      basePayload.fileName,
      basePayload.totalPages,
    );
    const validation = validatePdfInsight(candidate);

    if (validation.success) {
      return validation.data;
    }

    if (attempt === 1) {
      feedbackForRetry = formatValidationIssues(validation.error.issues);
      continue;
    }

    throw new ApiClientError(
      'Odpowiedź modelu AI nie przeszła walidacji schematu danych mimo ponowienia próby. Spróbuj ponownie.',
    );
  }

  throw new ApiClientError('Nie udało się ukończyć analizy dokumentu.');
}

// Obsługuje zarówno standardowe pliki PDF (1 zapytanie), jak i długie dokumenty dzielone na fragmenty (F-08).
export async function analyzeExtractedPdf(
  documentData: ExtractedPdfDocument,
  options: AnalyzeClientOptions = {},
): Promise<PdfInsightResult> {
  if (documentData.chunks.length === 0) {
    throw new ApiClientError('Brak treści do analizy w przekazanym dokumencie PDF.');
  }

  if (documentData.chunks.length > MAX_CHUNKS_TO_ANALYZE) {
    throw new ApiClientError(
      `Dokument jest zbyt obszerny do jednorazowej analizy (${documentData.totalPages} stron). Wgraj krótszy dokument.`,
    );
  }

  if (documentData.chunks.length === 1) {
    const singleChunk = documentData.chunks[0];
    options.onProgress?.({
      stage: 'analyzing',
      message: 'Analizowanie treści dokumentu przez AI...',
    });

    return requestValidatedInsight(
      {
        fileName: documentData.fileName,
        totalPages: documentData.totalPages,
        text: singleChunk.text,
        scannedImages: singleChunk.scannedImages,
        mode: 'single',
      },
      options,
    );
  }

  const partialResults: PdfInsightResult[] = [];
  const totalChunks = documentData.chunks.length;

  for (const chunk of documentData.chunks) {
    options.onProgress?.({
      stage: 'chunk',
      current: chunk.chunkIndex + 1,
      total: totalChunks,
      message: `Analizowanie długiego dokumentu — fragment ${chunk.chunkIndex + 1} z ${totalChunks}...`,
    });

    const chunkResult = await requestValidatedInsight(
      {
        fileName: documentData.fileName,
        totalPages: documentData.totalPages,
        text: chunk.text,
        scannedImages: chunk.scannedImages,
        mode: 'chunk',
        chunkInfo: {
          chunkIndex: chunk.chunkIndex,
          totalChunks,
        },
      },
      options,
    );

    partialResults.push(chunkResult);
  }

  options.onProgress?.({
    stage: 'merging',
    message: 'Łączenie wyników ze wszystkich fragmentów dokumentu...',
  });

  const serializedPartials = partialResults
    .map(
      (part, index) =>
        `=== Część ${index + 1}/${totalChunks} ===\n${JSON.stringify(part, null, 2)}`,
    )
    .join('\n\n');

  return requestValidatedInsight(
    {
      fileName: documentData.fileName,
      totalPages: documentData.totalPages,
      text: serializedPartials,
      scannedImages: [],
      mode: 'merge',
    },
    options,
  );
}
