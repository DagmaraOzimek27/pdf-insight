import { GlobalWorkerOptions, getDocument, type PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  DEFAULT_MAX_CHARS_PER_CHUNK,
  JPEG_DATA_URL_PREFIX,
  MAX_SCANNED_PAGE_IMAGES,
  MIN_CHUNK_BODY_BUDGET_CHARS,
  MIN_TEXT_CHARS_PER_PAGE,
  SCAN_JPEG_QUALITY,
  SCAN_RENDER_SCALE,
} from './config';
import { validatePdfFile } from './pdfValidator';

export { DEFAULT_MAX_CHARS_PER_CHUNK, MAX_SCANNED_PAGE_IMAGES, MIN_TEXT_CHARS_PER_PAGE };

export interface ScannedPageImage {
  pageNumber: number;
  mimeType: 'image/jpeg';
  base64Data: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isScanned: boolean;
  scanImage: ScannedPageImage | null;
}

export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  startPage: number;
  endPage: number;
  text: string;
  scannedImages: ScannedPageImage[];
}

export interface ExtractedPdfDocument {
  fileName: string;
  totalPages: number;
  fullText: string;
  pages: ExtractedPage[];
  scannedPageNumbers: number[];
  renderedScanPageNumbers: number[];
  omittedScanPageNumbers: number[];
  chunks: DocumentChunk[];
}

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

interface PdfTextFragment {
  str: string;
  hasEOL?: boolean;
}

function isPdfTextFragment(item: unknown): item is PdfTextFragment {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str: unknown }).str === 'string'
  );
}

let isWorkerConfigured = false;

// Import z sufiksem ?url gwarantuje skopiowanie workera z node_modules do dist/assets/ z uwzględnieniem base na GitHub Pages.
export function configurePdfWorker(): string {
  if (!isWorkerConfigured) {
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    isWorkerConfigured = true;
  }
  return pdfWorkerUrl;
}

// Strony bez warstwy tekstowej lub z samą numeracją/stopką (< 25 znaków) klasyfikujemy jako skany (F-10).
export function isScannedPageText(text: string): boolean {
  const nonWhitespaceLength = text.replace(/\s+/g, '').length;
  return nonWhitespaceLength < MIN_TEXT_CHARS_PER_PAGE;
}

// Rozdziela wykryte strony skanów na odczytane wizyjnie oraz pominięte po przekroczeniu limitu MAX_SCANNED_PAGE_IMAGES.
export function partitionScannedPageNumbers(pages: ReadonlyArray<ExtractedPage>): {
  renderedScanPageNumbers: number[];
  omittedScanPageNumbers: number[];
} {
  const renderedScanPageNumbers: number[] = [];
  const omittedScanPageNumbers: number[] = [];

  for (const page of pages) {
    if (!page.isScanned) {
      continue;
    }
    if (page.scanImage !== null) {
      renderedScanPageNumbers.push(page.pageNumber);
    } else {
      omittedScanPageNumbers.push(page.pageNumber);
    }
  }

  return { renderedScanPageNumbers, omittedScanPageNumbers };
}

export function formatExtractedTextItems(items: ReadonlyArray<unknown>): string {
  const parts: string[] = [];

  for (const item of items) {
    if (!isPdfTextFragment(item)) {
      continue;
    }
    if (item.str.length > 0) {
      parts.push(item.str);
    }
    parts.push(item.hasEOL ? '\n' : ' ');
  }

  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function renderPageToJpegBase64(
  page: PDFPageProxy,
  pageNumber: number,
): Promise<ScannedPageImage | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const viewport = page.getViewport({ scale: SCAN_RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  try {
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY);
    if (!dataUrl.startsWith(JPEG_DATA_URL_PREFIX)) {
      return null;
    }

    return {
      pageNumber,
      mimeType: 'image/jpeg',
      base64Data: dataUrl.slice(JPEG_DATA_URL_PREFIX.length),
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function splitOversizedText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n+/);
  const slices: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      slices.push(current);
      current = '';
    }

    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      for (let offset = 0; offset < paragraph.length; offset += maxChars) {
        slices.push(paragraph.slice(offset, offset + maxChars));
      }
    }
  }

  if (current) {
    slices.push(current);
  }

  return slices;
}

// Dzieli długie dokumenty na fragmenty z zachowaniem granic stron (F-08), przypisując do nich obrazy skanów.
export function chunkDocumentPages(
  pages: ReadonlyArray<ExtractedPage>,
  maxCharsPerChunk: number = DEFAULT_MAX_CHARS_PER_CHUNK,
): DocumentChunk[] {
  if (pages.length === 0) {
    return [];
  }

  interface RawChunk {
    startPage: number;
    endPage: number;
    sections: string[];
    scannedImages: ScannedPageImage[];
  }

  const rawChunks: RawChunk[] = [];
  let activeChunk: RawChunk | null = null;
  let activeLength = 0;

  for (const page of pages) {
    const header = `[Strona ${page.pageNumber}]`;
    const body =
      page.isScanned && !page.text
        ? page.scanImage
          ? '(Strona zeskanowana — treść na obrazie)'
          : '(Strona zeskanowana poza limitem obrazów — brak odczytu wizyjnego tej strony)'
        : page.text;
    const formattedPage = `${header}\n${body}`;

    if (formattedPage.length > maxCharsPerChunk) {
      if (activeChunk) {
        rawChunks.push(activeChunk);
        activeChunk = null;
        activeLength = 0;
      }

      const bodyBudget = Math.max(
        MIN_CHUNK_BODY_BUDGET_CHARS,
        maxCharsPerChunk - header.length - 16,
      );
      const parts = splitOversizedText(body, bodyBudget);
      parts.forEach((part, partIdx) => {
        rawChunks.push({
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          sections: [`${header} (część ${partIdx + 1}/${parts.length})\n${part}`],
          scannedImages: partIdx === 0 && page.scanImage ? [page.scanImage] : [],
        });
      });
      continue;
    }

    const separatorLength = activeChunk ? 2 : 0;
    if (activeChunk && activeLength + separatorLength + formattedPage.length > maxCharsPerChunk) {
      rawChunks.push(activeChunk);
      activeChunk = null;
      activeLength = 0;
    }

    if (!activeChunk) {
      activeChunk = {
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        sections: [formattedPage],
        scannedImages: page.scanImage ? [page.scanImage] : [],
      };
      activeLength = formattedPage.length;
    } else {
      activeChunk.endPage = page.pageNumber;
      activeChunk.sections.push(formattedPage);
      if (page.scanImage) {
        activeChunk.scannedImages.push(page.scanImage);
      }
      activeLength += separatorLength + formattedPage.length;
    }
  }

  if (activeChunk) {
    rawChunks.push(activeChunk);
  }

  const totalChunks = rawChunks.length;
  return rawChunks.map((chunk, index) => ({
    chunkIndex: index,
    totalChunks,
    startPage: chunk.startPage,
    endPage: chunk.endPage,
    text: chunk.sections.join('\n\n'),
    scannedImages: chunk.scannedImages,
  }));
}

export async function extractPdfContent(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void,
): Promise<ExtractedPdfDocument> {
  const validation = await validatePdfFile(file);
  if (!validation.valid) {
    throw new PdfExtractionError(validation.error);
  }

  configurePdfWorker();

  const fileBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(fileBuffer) });

  try {
    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    if (totalPages <= 0) {
      throw new PdfExtractionError('Dokument PDF nie zawiera żadnych stron.');
    }

    const pages: ExtractedPage[] = [];
    const scannedPageNumbers: number[] = [];
    let renderedScansCount = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = formatExtractedTextItems(textContent.items);
      const isScanned = isScannedPageText(text);

      let scanImage: ScannedPageImage | null = null;
      if (isScanned) {
        scannedPageNumbers.push(pageNumber);
        if (renderedScansCount < MAX_SCANNED_PAGE_IMAGES) {
          scanImage = await renderPageToJpegBase64(page, pageNumber);
          if (scanImage) {
            renderedScansCount += 1;
          }
        }
      }

      page.cleanup();
      pages.push({ pageNumber, text, isScanned, scanImage });
      onProgress?.(pageNumber, totalPages);
    }

    const fullText = pages
      .filter((page) => page.text.length > 0)
      .map((page) => `[Strona ${page.pageNumber}]\n${page.text}`)
      .join('\n\n');

    const { renderedScanPageNumbers, omittedScanPageNumbers } = partitionScannedPageNumbers(pages);
    const hasAnyReadableContent = fullText.trim().length > 0 || renderedScanPageNumbers.length > 0;

    if (!hasAnyReadableContent) {
      throw new PdfExtractionError(
        'Nie udało się odczytać treści dokumentu PDF (brak warstwy tekstowej oraz brak możliwości odczytu skanu).',
      );
    }

    const chunks = chunkDocumentPages(pages);

    await pdfDocument.destroy();

    return {
      fileName: file.name,
      totalPages,
      fullText,
      pages,
      scannedPageNumbers,
      renderedScanPageNumbers,
      omittedScanPageNumbers,
      chunks,
    };
  } catch (error: unknown) {
    if (error instanceof PdfExtractionError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfExtractionError(
        'Dokument PDF jest zabezpieczony hasłem. Wgraj odblokowany plik PDF.',
      );
    }
    throw new PdfExtractionError(
      'Nie udało się odczytać pliku PDF. Upewnij się, że plik nie jest uszkodzony.',
    );
  }
}
