import { describe, expect, it } from 'vitest';
import {
  MAX_PDF_SIZE_BYTES,
  hasPdfMagicBytes,
  validatePdfFile,
  validatePdfMetadata,
} from './pdfValidator';
import {
  chunkDocumentPages,
  configurePdfWorker,
  formatExtractedTextItems,
  isScannedPageText,
  partitionScannedPageNumbers,
  type ExtractedPage,
} from './pdfExtractor';

function createMockFile(
  content: Uint8Array | string,
  name: string,
  type = 'application/pdf',
): File {
  const part = typeof content === 'string' ? content : Uint8Array.from(content);
  return new File([part], name, { type });
}

describe('pdfValidator (F-01)', () => {
  it('akceptuje prawidłowy plik PDF z sygnaturą %PDF- i rozmiarem w limicie 10 MB', async () => {
    const file = createMockFile('%PDF-1.7\n1 0 obj\n<<>>\nendobj', 'umowa.pdf');
    const result = await validatePdfFile(file);
    expect(result).toEqual({ valid: true });
  });

  it('odrzuca pusty plik (0 B) z komunikatem po polsku', async () => {
    const emptyFile = createMockFile('', 'pusty.pdf');
    const result = await validatePdfFile(emptyFile);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('pusty');
    }
  });

  it('odrzuca plik przekraczający limit 10 MB', () => {
    const result = validatePdfMetadata({
      name: 'wielki_raport.pdf',
      size: MAX_PDF_SIZE_BYTES + 1,
      type: 'application/pdf',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('10 MB');
    }
  });

  it('odrzuca pliki o rozszerzeniu lub typie MIME innym niż PDF', async () => {
    const jpgFile = createMockFile('fake-image', 'skan.jpg', 'image/jpeg');
    const result = await validatePdfFile(jpgFile);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('PDF');
    }
  });

  it('odrzuca plik z rozszerzeniem .pdf, który nie posiada nagłówka binarnego %PDF-', async () => {
    const disguisedImage = createMockFile(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
      'udaje_pdf.pdf',
    );
    expect(hasPdfMagicBytes(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);

    const result = await validatePdfFile(disguisedImage);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('%PDF-');
    }
  });
});

describe('pdfExtractor helpers (F-02, F-08, F-10)', () => {
  it('konfiguruje URL workera pdf.js kompatybilny z bundlerem Vite', () => {
    const workerUrl = configurePdfWorker();
    expect(workerUrl).toContain('pdf.worker.min.mjs');
  });

  it('rozpoznaje strony bez warstwy tekstowej lub ze szczątkową stopką jako skany (F-10)', () => {
    expect(isScannedPageText('')).toBe(true);
    expect(isScannedPageText('   \n  Strona 11  ')).toBe(true);
    expect(
      isScannedPageText(
        'Aneks nr 1 do Umowy ramowej nr 14/2026 zawarty w Gdańsku dnia 20 marca 2026 r.',
      ),
    ).toBe(false);
  });

  it('składa fragmenty tekstu z pdf.js z zachowaniem końców linii (hasEOL)', () => {
    const rawItems = [
      { str: 'UMOWA RAMOWA', hasEOL: true },
      { str: 'zawarta w dniu', hasEOL: false },
      { str: '12.03.2026 r.', hasEOL: true },
      { markedContentProp: true },
    ];

    expect(formatExtractedTextItems(rawItems)).toBe('UMOWA RAMOWA\nzawarta w dniu 12.03.2026 r.');
  });

  it('dzieli długi dokument na fragmenty z zachowaniem granic stron i obrazów skanów (F-08 + F-10)', () => {
    const scanImage = {
      pageNumber: 3,
      mimeType: 'image/jpeg' as const,
      base64Data: 'base64jpegdata',
    };

    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: 'A'.repeat(400), isScanned: false, scanImage: null },
      { pageNumber: 2, text: 'B'.repeat(400), isScanned: false, scanImage: null },
      { pageNumber: 3, text: '', isScanned: true, scanImage },
    ];

    const chunks = chunkDocumentPages(pages, 600);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.startPage).toBe(1);
    expect(chunks[0]?.endPage).toBe(1);
    expect(chunks[0]?.scannedImages).toHaveLength(0);

    expect(chunks[1]?.startPage).toBe(2);
    expect(chunks[1]?.endPage).toBe(3);
    expect(chunks[1]?.scannedImages).toEqual([scanImage]);
    expect(chunks[1]?.totalChunks).toBe(2);
  });

  it('jawnie wyodrębnia numery pominiętych skanów po przekroczeniu limitu MAX_SCANNED_PAGE_IMAGES', () => {
    const sampleScan = {
      pageNumber: 1,
      mimeType: 'image/jpeg' as const,
      base64Data: 'scan-1',
    };
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: '', isScanned: true, scanImage: sampleScan },
      { pageNumber: 2, text: 'Treść tekstowa umowy', isScanned: false, scanImage: null },
      { pageNumber: 6, text: '', isScanned: true, scanImage: null },
      { pageNumber: 7, text: '', isScanned: true, scanImage: null },
    ];

    const partitioned = partitionScannedPageNumbers(pages);
    expect(partitioned.renderedScanPageNumbers).toEqual([1]);
    expect(partitioned.omittedScanPageNumbers).toEqual([6, 7]);

    const chunks = chunkDocumentPages(pages);
    expect(chunks[0]?.text).toContain('poza limitem obrazów');
  });

  it('bezpiecznie dzieli pojedynczą stronę przekraczającą maksymalny rozmiar fragmentu', () => {
    const hugePage: ExtractedPage = {
      pageNumber: 1,
      text: `${'Pierwszy akapit. '.repeat(40)}\n${'Drugi akapit. '.repeat(40)}`,
      isScanned: false,
      scanImage: null,
    };

    const chunks = chunkDocumentPages([hugePage], 700);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.startPage === 1 && chunk.endPage === 1)).toBe(true);
  });
});
