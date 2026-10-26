import { describe, expect, it } from 'vitest';
import {
  countSentences,
  isValidIsoCurrency,
  isValidIsoDate,
  pdfInsightSchema,
  validatePdfInsight,
  type PdfInsightResult,
} from './schema';

function createValidPayload(): PdfInsightResult {
  return {
    document: {
      fileName: 'Test_PDF_Insight_umowa_14-2026.pdf',
      pages: 12,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa ramowa nr 14/2026 o wdrożenie i utrzymanie systemu CRM',
      date: '2026-03-12',
    },
    summary:
      'Umowa ramowa nr 14/2026 zawarta 12.03.2026 r. pomiędzy Nordwave Logistics sp. z o.o. a Kwadrat Software S.A. dotyczy wdrożenia systemu CRM w modelu SaaS. Projekt obejmuje 5 etapów o wartości 184 500 PLN netto z uruchomieniem produkcyjnym zaplanowanym na 12 października 2026 r. Kontrakt obowiązuje przez 24 miesiące z gwarancją dostępności SLA na poziomie 99,5%. Zgodnie z Aneksem nr 1 system obejmie 135 użytkowników, a abonament wzrośnie do 13 100 PLN netto od kwietnia 2027 r.',
    keyPoints: [
      'Okres obowiązywania umowy wynosi 24 miesiące od 1 kwietnia 2026 r. do 31 marca 2028 r.',
      'Wynagrodzenie ryczałtowe za wdrożenie wynosi 184 500 PLN netto płatne w 5 etapach.',
      'Abonament utrzymaniowy wynosi 12 300 PLN netto miesięcznie, a od kwietnia 2027 r. 13 100 PLN netto.',
      'Docelowa liczba użytkowników po Aneksie nr 1 wynosi 135 osób.',
    ],
    entities: {
      organizations: ['Nordwave Logistics sp. z o.o.', 'Kwadrat Software S.A.'],
      people: ['Anna Kowalczyk', 'Marek Zieliński', 'Paweł Dąbrowski'],
    },
    amounts: [
      { value: 184500, currency: 'PLN', context: 'wynagrodzenie netto za wdrożenie' },
      { value: 8600, currency: 'EUR', context: 'roczna opłata licencyjna za 4 instancje' },
      { value: 890, currency: 'USD', context: 'miesięczny koszt infrastruktury chmurowej' },
    ],
    dates: [
      { date: '2026-04-01', context: 'początek obowiązywania umowy' },
      { date: '2026-10-12', context: 'planowany termin Go-live' },
    ],
    keywords: ['CRM', 'SaaS', 'SLA', 'migracja danych', 'SAP Business One'],
  };
}

describe('pdfInsightSchema', () => {
  it('akceptuje poprawny obiekt zgodny ze schematem z sekcji 04 briefu', () => {
    const result = validatePdfInsight(createValidPayload());
    expect(result.success).toBe(true);
  });

  it('dopuszcza null dla brakującej daty i tytułu dokumentu oraz puste tablice przy braku danych', () => {
    const payload = createValidPayload();
    payload.document.date = null;
    payload.document.title = null;
    payload.entities.people = [];
    payload.amounts = [];
    payload.dates = [];

    const result = validatePdfInsight(payload);
    expect(result.success).toBe(true);
  });

  it('pozwala na dodawanie dodatkowych pól bez usuwania pól bazowych', () => {
    const payloadWithExtra = {
      ...createValidPayload(),
      ocrUsed: true,
    };

    const result = pdfInsightSchema.safeParse(payloadWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('ocrUsed', true);
    }
  });

  it('odrzuca walutę zapisaną potocznie jako "zł" lub małymi literami zamiast kodu ISO 4217', () => {
    const payloadZl = createValidPayload();
    payloadZl.amounts = [{ value: 12500, currency: 'zł', context: 'wynagrodzenie' }];
    expect(validatePdfInsight(payloadZl).success).toBe(false);

    const payloadLower = createValidPayload();
    payloadLower.amounts = [{ value: 12500, currency: 'pln', context: 'wynagrodzenie' }];
    expect(validatePdfInsight(payloadLower).success).toBe(false);
    expect(isValidIsoCurrency('XYZ')).toBe(false);
  });

  it('odrzuca daty niezgodne z formatem ISO 8601 (np. "12.03.2026") oraz nieistniejące daty kalendarzowe', () => {
    const payloadDotDate = createValidPayload();
    payloadDotDate.document.date = '12.03.2026';
    expect(validatePdfInsight(payloadDotDate).success).toBe(false);

    const payloadInvalidCalendar = createValidPayload();
    payloadInvalidCalendar.dates = [{ date: '2026-02-30', context: 'błędna data lutowa' }];
    expect(validatePdfInsight(payloadInvalidCalendar).success).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
  });

  it('odrzuca zbyt krótkie (< 3) lub zbyt długie (> 5) podsumowanie', () => {
    const tooShort = createValidPayload();
    tooShort.summary = 'Pierwsze zdanie. Drugie zdanie.';
    expect(validatePdfInsight(tooShort).success).toBe(false);

    const tooLong = createValidPayload();
    tooLong.summary =
      'Zdanie pierwsze. Zdanie drugie. Zdanie trzecie. Zdanie czwarte. Zdanie piąte. Zdanie szóste.';
    expect(validatePdfInsight(tooLong).success).toBe(false);
  });

  it('poprawnie liczy zdania zawierające polskie skróty ("sp. z o.o.", "S.A.", "r.", "ok.")', () => {
    const text =
      'Umowa z dnia 12.03.2026 r. pomiędzy Nordwave sp. z o.o. a Kwadrat S.A. obejmuje ok. 120 osób. Drugi etap rusza w maju 2026 r. Trzecie zdanie zamyka opis.';
    expect(countSentences(text)).toBe(3);
  });

  it('nie zjada kropki kończącej zdanie po słowach "ok.", zaimku "im." ani akronimach "MS." / "DOT."', () => {
    const endingWithPronounIm =
      'Uprawnienia administracyjne przekazano również im. Kolejny etap obejmuje integrację, np. SAP Business One. Wdrożenie rusza przy ul. Prostej 12.';
    expect(countSentences(endingWithPronounIm)).toBe(3);

    const endingWithOkAndAcronym =
      'Wstępny audyt bezpieczeństwa wypadł ok. Wdrożono środowisko chmurowe MS. Spotkanie odbyło się w Szkole im. Adama Mickiewicza.';
    expect(countSentences(endingWithOkAndAcronym)).toBe(3);
  });

  it('odrzuca keyPoints zawierające mniej niż 3 lub więcej niż 7 elementów', () => {
    const tooFew = createValidPayload();
    tooFew.keyPoints = ['Punkt 1', 'Punkt 2'];
    expect(validatePdfInsight(tooFew).success).toBe(false);

    const tooMany = createValidPayload();
    tooMany.keyPoints = ['1', '2', '3', '4', '5', '6', '7', '8'];
    expect(validatePdfInsight(tooMany).success).toBe(false);
  });

  it('odrzuca nieznany typ dokumentu oraz błędny kod języka', () => {
    const invalidType = {
      ...createValidPayload(),
      document: { ...createValidPayload().document, type: 'paragon' },
    };
    expect(validatePdfInsight(invalidType).success).toBe(false);

    const invalidLanguage = createValidPayload();
    invalidLanguage.document.language = 'pol';
    expect(validatePdfInsight(invalidLanguage).success).toBe(false);
  });

  it('odrzuca obiekt pozbawiony wymaganych pól bazowych', () => {
    const { keywords: _removed, ...incompletePayload } = createValidPayload();
    void _removed;
    expect(validatePdfInsight(incompletePayload).success).toBe(false);
  });
});
