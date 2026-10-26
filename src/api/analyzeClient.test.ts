import { describe, expect, it, vi } from 'vitest';
import type { ExtractedPdfDocument } from '../lib/pdfExtractor';
import type { PdfInsightResult } from '../lib/schema';
import { ApiClientError, analyzeExtractedPdf, requestValidatedInsight } from './analyzeClient';

function createValidInsightPayload(overrides: Partial<PdfInsightResult> = {}): PdfInsightResult {
  return {
    document: {
      fileName: 'umowa.pdf',
      pages: 4,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa',
      date: '2026-09-01',
    },
    summary:
      'Umowa serwisowa reguluje zasady wsparcia technicznego pomiędzy stronami. Kontrakt został zawarty na okres dwunastu miesięcy z gwarancją czasu reakcji. Wynagrodzenie ryczałtowe płatne jest co miesiąc na podstawie faktury.',
    keyPoints: [
      'Okres obowiązywania umowy wynosi 12 miesięcy.',
      'Wynagrodzenie miesięczne wynosi 12 500 PLN netto.',
      'Termin płatności faktury to 14 dni.',
    ],
    entities: {
      organizations: ['Przykład sp. z o.o.'],
      people: ['Jan Kowalski'],
    },
    amounts: [{ value: 12500, currency: 'PLN', context: 'miesięczne wynagrodzenie netto' }],
    dates: [{ date: '2026-10-01', context: 'termin pierwszej płatności' }],
    keywords: ['serwis', 'SLA', 'wsparcie'],
    ...overrides,
  };
}

describe('analyzeClient (walidacja Zod, 1x retry i długie dokumenty F-08)', () => {
  it('zwraca wynik przy pierwszej próbie, gdy odpowiedź AI przechodzi walidację Zod', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: createValidInsightPayload() }), { status: 200 }),
      );

    const result = await requestValidatedInsight(
      {
        fileName: 'umowa_klienta.pdf',
        totalPages: 12,
        text: 'Treść dokumentu',
        scannedImages: [],
        mode: 'single',
      },
      { apiUrl: 'https://api.example.com', fetchImpl: mockFetch },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.document.fileName).toBe('umowa_klienta.pdf');
    expect(result.document.pages).toBe(12);
  });

  it('wykonuje automatycznie 1 ponowną próbę (retry), gdy 1. odpowiedź AI ma błędną walutę "zł", i zwraca poprawiony wynik', async () => {
    const invalidFirstAttempt = createValidInsightPayload({
      amounts: [{ value: 12500, currency: 'zł', context: 'wynagrodzenie' }],
    });
    const validSecondAttempt = createValidInsightPayload();

    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: invalidFirstAttempt }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: validSecondAttempt }), { status: 200 }),
      );

    const result = await requestValidatedInsight(
      {
        fileName: 'umowa.pdf',
        totalPages: 4,
        text: 'Treść dokumentu',
        scannedImages: [],
        mode: 'single',
      },
      { apiUrl: 'https://api.example.com', fetchImpl: mockFetch },
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(String(mockFetch.mock.calls[1][1]?.body)) as {
      validationFeedback?: string;
    };
    expect(secondCallBody.validationFeedback).toContain('amounts.0.currency');
    expect(result.amounts[0]?.currency).toBe('PLN');
  });

  it('zatrzymuje się po dokładnie 1 ponownej próbie (łącznie 2 wywołania) i rzuca polski komunikat błędu', async () => {
    const invalidAttempt = createValidInsightPayload({
      keyPoints: ['Tylko jeden punkt'],
    });

    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response(JSON.stringify({ data: invalidAttempt }), { status: 200 });
    });

    await expect(
      requestValidatedInsight(
        {
          fileName: 'umowa.pdf',
          totalPages: 4,
          text: 'Treść dokumentu',
          scannedImages: [],
          mode: 'single',
        },
        { apiUrl: 'https://api.example.com', fetchImpl: mockFetch },
      ),
    ).rejects.toThrow(/walidacji schematu/);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('nie ponawia bezcelowo zapytania przy błędzie limitu zapytań 429 lub blokadzie CORS 403', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Przekroczono limit zapytań.' }), { status: 429 }),
      );

    await expect(
      requestValidatedInsight(
        {
          fileName: 'umowa.pdf',
          totalPages: 4,
          text: 'Treść',
          scannedImages: [],
          mode: 'single',
        },
        { apiUrl: 'https://api.example.com', fetchImpl: mockFetch },
      ),
    ).rejects.toBeInstanceOf(ApiClientError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('analizuje wieloczęściowy długi dokument (F-08) i łączy wyniki częściowe w trybie merge', async () => {
    const part1 = createValidInsightPayload({ keywords: ['część-1'] });
    const part2 = createValidInsightPayload({ keywords: ['część-2'] });
    const merged = createValidInsightPayload({ keywords: ['część-1', 'część-2', 'połączone'] });

    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: part1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: part2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: merged }), { status: 200 }));

    const multiChunkDoc: ExtractedPdfDocument = {
      fileName: 'dlugi_raport.pdf',
      totalPages: 30,
      fullText: 'Pełny tekst',
      pages: [],
      scannedPageNumbers: [],
      chunks: [
        {
          chunkIndex: 0,
          totalChunks: 2,
          startPage: 1,
          endPage: 15,
          text: 'Tekst 1-15',
          scannedImages: [],
        },
        {
          chunkIndex: 1,
          totalChunks: 2,
          startPage: 16,
          endPage: 30,
          text: 'Tekst 16-30',
          scannedImages: [],
        },
      ],
    };

    const finalResult = await analyzeExtractedPdf(multiChunkDoc, {
      apiUrl: 'https://api.example.com',
      fetchImpl: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const thirdCallBody = JSON.parse(String(mockFetch.mock.calls[2][1]?.body)) as {
      mode?: string;
    };
    expect(thirdCallBody.mode).toBe('merge');
    expect(finalResult.keywords).toContain('połączone');
    expect(finalResult.document.pages).toBe(30);
  });
});
