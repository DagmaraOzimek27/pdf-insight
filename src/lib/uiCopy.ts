import { MAX_HISTORY_ITEMS, MAX_PDF_SIZE_MB, MAX_SCANNED_PAGE_IMAGES } from './config';
import type { DocumentType } from './schema';

// Wydzielona warstwa tekstowa interfejsu — wszystkie komunikaty po polsku w jednym miejscu do wygodnej redakcji.
export const UI_COPY = {
  header: {
    logoAlt: 'PDF Insight',
    subtitle: 'Podsumowanie i uporządkowane dane JSON prosto z dokumentu PDF',
  },

  dropzone: {
    iconAlt: '',
    idleTitle: 'Przeciągnij tutaj plik PDF albo wybierz go z dysku',
    dragActiveTitle: 'Upuść plik PDF, aby rozpocząć analizę',
    selectButton: 'Wybierz plik PDF',
    selectAnotherButton: 'Wgraj inny dokument PDF',
    constraintsHint: `Plik .pdf do ${MAX_PDF_SIZE_MB} MB — obsługiwane są zarówno dokumenty tekstowe, jak i strony ze skanami (do ${MAX_SCANNED_PAGE_IMAGES} skanów na plik).`,
    keyboardHint: 'Obsługa z klawiatury: przejdź klawiszem Tab i naciśnij Enter lub Spację.',
    privacyLabel: 'Informacja o przesyłaniu danych:',
    privacyNotice:
      'Treść wgranego dokumentu PDF (tekst oraz obrazy zeskanowanych stron) jest przesyłana przez serwer pośredniczący do zewnętrznego API modelu AI (Google Gemini) wyłącznie w celu wykonania bieżącej analizy. Nie wgrywaj plików zawierających dane tajne lub szczególnie chronione.',
    historyToggleLabel: 'Zapisuj wyniki ostatnich analiz lokalnie w tej przeglądarce',
    historyToggleHint: '(możesz wyłączyć zapis w pamięci localStorage przed wgraniem dokumentu)',
  },

  emptyState: {
    title: 'Jak działa analiza?',
    steps: [
      {
        title: '1. Odczyt dokumentu i skanów',
        description:
          'Aplikacja sprawdza poprawność pliku PDF, odczytuje warstwę tekstową, a strony bez tekstu przygotowuje jako obrazy do odczytu optycznego.',
      },
      {
        title: '2. Streszczenie bez domysłów',
        description:
          'Otrzymujesz zwięzłe podsumowanie (3–5 zdań) w głównym języku dokumentu, oparte wyłącznie na jego rzeczywistej treści.',
      },
      {
        title: '3. Zweryfikowany plik JSON',
        description:
          'Kwoty (ISO 4217), daty (RRRR-MM-DD), podmioty i kluczowe punkty przechodzą walidację schematem Zod przed wyświetleniem i pobraniem.',
      },
    ],
  },

  loadingState: {
    title: 'Trwa analiza dokumentu',
    cancelButton: 'Przerwij',
    validatingFile: 'Sprawdzanie nagłówka i rozmiaru pliku PDF...',
    readingPages: (currentPage: number, totalPages: number) =>
      `Odczytywanie stron dokumentu i skanów: ${currentPage} z ${totalPages}...`,
    scansDetectedHint: (scanCount: number) =>
      `Wykryto strony bez warstwy tekstowej (${scanCount}) — dołączono ich obraz do analizy AI.`,
    scansOmittedWarning: (renderedCount: number, omittedPages: ReadonlyArray<number>) =>
      `Przekroczono limit ${MAX_SCANNED_PAGE_IMAGES} skanów: do analizy wizyjnej przekazano ${renderedCount} str., pominięto strony nr ${omittedPages.join(', ')}.`,
    analyzingDocument: 'Analiza treści dokumentu przez model AI...',
    retryingValidation: 'Odpowiedź modelu wymagała korekty formatu — ponawianie próby (1/1)...',
    analyzingChunk: (current: number, total: number) =>
      `Analiza długiego dokumentu — część ${current} z ${total}...`,
    mergingChunks: 'Łączenie wyników z poszczególnych części dokumentu...',
  },

  errorState: {
    title: 'Analiza nie powiodła się',
    lastFileLabel: 'Ostatnio wybrany plik:',
    retryButton: 'Spróbuj ponownie',
    dismissButton: 'Ukryj komunikat',
    fallbackMessage: 'Wystąpił nieoczekiwany błąd podczas przetwarzania pliku PDF.',
  },

  results: {
    sectionLabel: 'Wynik analizy',
    tabStructured: 'Widok uporządkowany',
    tabJson: 'Podgląd JSON',
    copyJsonButton: 'Kopiuj JSON',
    copiedJsonButton: 'Skopiowano JSON',
    copyErrorHint: 'Schowek jest niedostępny w tej przeglądarce — użyj przycisku pobierania .json.',
    downloadJsonButton: 'Pobierz .json',
    scanLimitWarningTitle: 'Uwaga — niepełny odczyt zeskanowanych stron:',
    scanLimitWarningBody: (omittedPages: ReadonlyArray<number>) =>
      `Dokument zawiera więcej skanów niż wynosi limit pojedynczej analizy (${MAX_SCANNED_PAGE_IMAGES} obrazów). Strony nr ${omittedPages.join(', ')} nie zostały odczytane wizyjnie — wynik może nie uwzględniać ich treści.`,

    documentTypes: {
      faktura: 'Faktura',
      umowa: 'Umowa',
      oferta: 'Oferta',
      raport: 'Raport',
      inne: 'Inny dokument',
    } satisfies Record<DocumentType, string>,

    metadata: {
      heading: 'Metadane dokumentu',
      fileName: 'Plik źródłowy',
      pages: 'Liczba stron',
      language: 'Główny język',
      type: 'Rodzaj dokumentu',
      title: 'Tytuł w dokumencie',
      date: 'Data główna',
      emptyValue: 'Brak danych w dokumencie',
    },

    summary: {
      heading: 'Podsumowanie',
    },

    keyPoints: {
      heading: 'Kluczowe punkty',
    },

    entities: {
      heading: 'Organizacje i osoby',
      organizationsSubheading: 'Organizacje i strony',
      organizationsEmpty: 'Brak wskazanych organizacji w treści dokumentu.',
      peopleSubheading: 'Wymienione osoby',
      peopleEmpty: 'Brak imiennie wskazanych osób w treści dokumentu.',
    },

    amounts: {
      heading: 'Kwoty i wartości',
      valueColumn: 'Kwota',
      currencyColumn: 'Waluta',
      contextColumn: 'Kontekst',
      empty: 'Brak kwot pieniężnych w dokumencie.',
    },

    dates: {
      heading: 'Daty i terminy',
      dateColumn: 'Data (ISO 8601)',
      contextColumn: 'Kontekst',
      empty: 'Brak dat i terminów w dokumencie.',
    },

    keywords: {
      heading: 'Słowa kluczowe',
      empty: 'Brak słów kluczowych.',
    },

    jsonPreview: {
      heading: 'Obiekt JSON zgodny ze schematem',
    },
  },

  history: {
    heading: 'Ostatnie analizy',
    hint: `Zapisane wyłącznie lokalnie w tej przeglądarce (do ${MAX_HISTORY_ITEMS} plików, bez automatycznego wygaszania). Wyczyszczenie usuwa zapisy oraz aktywny wynik z ekranu.`,
    clearButton: 'Wyczyść historię',
    activeBadge: 'Wyświetlany',
    pagesShort: (pages: number) => `${pages} str.`,
  },

  footer: {
    note: 'PDF Insight — analiza dokumentów PDF z walidacją kontraktu danych JSON.',
  },
} as const;
