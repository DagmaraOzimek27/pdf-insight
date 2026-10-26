# SPEC.md — Specyfikacja Techniczna i Plan Realizacji PDF Insight

Ten dokument stanowi część uprzęży sterującej dla agenta AI (**AI Harness**) i współpracuje bezpośrednio z konstytucją projektu [`AGENTS.md`](./AGENTS.md). Definiuje zakres funkcjonalny, kontrakt danych wyjściowych, matrycę przypadków brzegowych oraz podział prac na weryfikowalne etapy.

---

## 1. Cel produktu i kryterium ukończenia (Definition of Done)

**PDF Insight** to aplikacja webowa przyjmująca plik PDF od użytkownika i zwracająca w czasie **poniżej 30 sekund** (bez konieczności konfigurowania środowiska ani podawania klucza API przez osobę testującą):
1. Zwięzłe podsumowanie dokumentu (3–5 zdań) w głównym języku dokumentu, bez domysłów spoza treści.
2. Ustrukturyzowane dane zweryfikowane schematem **Zod** przed wyświetleniem i eksportem do pliku `.json`.

---

## 2. Zakres wymagań funkcjonalnych (`F-01` – `F-10`)

| ID | Priorytet | Wymaganie i kryteria akceptacji | Moduł docelowy |
| :--- | :--- | :--- | :--- |
| **F-01** | `MUST` | Wgrywanie pliku PDF metodą *drag & drop*, z dysku oraz z klawiatury (`Tab`, `Enter`/`Space`); limit rozmiaru `> 0 B` i `<= 10 MB`; weryfikacja sygnatury binarnej `%PDF-`. | `src/lib/pdfValidator.ts`, `src/components/PdfDropzone.tsx` |
| **F-02** | `MUST` | Ekstrakcja tekstu strona po stronie w przeglądarce przy użyciu `pdfjs-dist` z poprawnym bundlowaniem workera dla podścieżki `/pdf-insight/`. | `src/lib/pdfExtractor.ts` |
| **F-03** | `MUST` | Streszczenie dokumentu od 3 do 5 zdań w głównym języku dokumentu, oparte wyłącznie na treści źródłowej. | `worker/src/index.ts`, `src/lib/schema.ts` |
| **F-04** | `MUST` | Walidacja odpowiedzi AI schematem Zod przed wyświetleniem; w przypadku błędnego formatu automatycznie dokładnie **1 ponowna próba (`1x retry`)**, a następnie czytelny komunikat błędu po polsku. | `src/lib/schema.ts`, `src/api/analyzeClient.ts` |
| **F-05** | `MUST` | Czytelna prezentacja wszystkich 7 sekcji schematu, podgląd sformatowanego JSON-a (z kopiowaniem do schowka) oraz pobranie pliku `.json`; całkowity zakaz `dangerouslySetInnerHTML`. | `src/components/InsightResults.tsx` |
| **F-06** | `MUST` | Obsługa trzech stanów interfejsu po polsku: stan pusty, stan ładowania z bieżącym etapem przetwarzania oraz stan błędu z przyciskiem „Spróbuj ponownie” dla ostatniego pliku. | `src/components/StatusBanner.tsx`, `src/components/EmptyStateGuide.tsx` |
| **F-07** | `MUST` | Publiczne wdrożenie pod adresem `https://dagmaraozimek27.github.io/pdf-insight/` z automatycznym pipeline'em CI/CD (GitHub Actions). | `vite.config.ts`, `.github/workflows/deploy.yml` |
| **F-08** | `SHOULD` | Obsługa wielostronicowych, długich dokumentów przez podział tekstu z zachowaniem granic stron (*chunking*) i scalenie wyników częściowych. | `src/lib/pdfExtractor.ts`, `src/api/analyzeClient.ts` |
| **F-09** | `SHOULD` | Lokalna historia ostatnich 10 analiz w `localStorage` z walidacją każdego wpisu schematem Zod przy odczycie oraz opcją wyczyszczenia historii. | `src/lib/historyStorage.ts`, `src/components/HistoryPanel.tsx` |
| **F-10** | `COULD` | Wykrywanie stron zeskanowanych (poniżej 25 znaków niebiałych na stronie), renderowanie ich na `<canvas>` do skompresowanego JPEG (base64) i przekazanie do multimodalnego modelu wizyjnego Gemini Flash. | `src/lib/pdfExtractor.ts`, `worker/src/index.ts` |

---

## 3. Kontrakt danych wyjściowych JSON

Wszystkie pola bazowe są wymagane (schemat dopuszcza rozszerzanie przez `.passthrough()`, nigdy usuwanie pól bazowych). Brak informacji w treści oznacza `null` (dla skalarów opcjonalnych) lub `[]` (dla list).

```json
{
  "document": {
    "fileName": "string (niepusty, nadpisywany zweryfikowaną nazwą pliku)",
    "pages": "number (całkowita > 0, nadpisywana rzeczywistą liczbą stron)",
    "language": "string (2-literowy kod ISO 639-1, np. 'pl', 'en')",
    "type": "'faktura' | 'umowa' | 'oferta' | 'raport' | 'inne'",
    "title": "string | null",
    "date": "string (YYYY-MM-DD, realna data kalendarzowa) | null"
  },
  "summary": "string (3–5 zdań w głównym języku dokumentu)",
  "keyPoints": ["string (od 3 do 7 elementów)"],
  "entities": {
    "organizations": ["string"],
    "people": ["string"]
  },
  "amounts": [
    {
      "value": "number",
      "currency": "string (3-literowy kod ISO 4217 wielkimi literami, np. 'PLN', 'EUR', 'USD')",
      "context": "string"
    }
  ],
  "dates": [
    {
      "date": "string (YYYY-MM-DD)",
      "context": "string"
    }
  ],
  "keywords": ["string"]
}
```

---

## 4. Matryca przypadków brzegowych i pułapek testowych (`Test_PDF_Insight_umowa_14-2026.pdf`)

1. **Ukryty atak Prompt Injection (str. 4):** Niewidoczny tekst próbujący wymusić na modelu uznanie umowy za nieważną i wpisanie kwoty `1 PLN`.
   - *Mechanizm obronny:* Separacja instrukcji systemowej (`systemInstruction`) od treści dokumentu zamkniętej w znacznikach `<untrusted_pdf_document>`, niska temperatura modelu (`0.1`) oraz sztywny `responseSchema`.
2. **Sekcja obcojęzyczna wewnątrz polskiego dokumentu (str. 10 — *Executive Summary* po angielsku):**
   - *Mechanizm obronny:* Jawna reguła wyboru głównego języka na podstawie dominującej treści całego dokumentu (`"pl"`), a nie pojedynczego załącznika lub streszczenia.
3. **Zeskanowany załącznik bez warstwy tekstowej (str. 11 — *Aneks nr 1* zmieniający stawkę na `13 100,00 PLN` netto od `2027-04-01` oraz limit na `135` użytkowników):**
   - *Mechanizm obronny:* Automatyczna detekcja strony bez warstwy tekstowej, render do obrazu JPEG `1.5x` i analiza multimodalna tekstu razem z obrazami skanów.
4. **Różnorodne zapisy walut i dat (`zł`, `PLN`, `EUR`, `USD`, `12.03.2026`, daty słowne):**
   - *Mechanizm obronny:* Normalizacja po stronie modelu do ISO 4217 i ISO 8601 weryfikowana w `src/lib/schema.ts` z automatycznym `1x retry` zawierającym listę błędów Zod w przypadku odchyleń.

---

## 5. Plan etapowy (Staged Delivery)

1. **Etap 1 — Fundament i kontrakt danych:** Konfiguracja React + Vite + TypeScript `strict` + ESLint + Prettier + Vitest oraz schemat walidacji `src/lib/schema.ts` z testami jednostkowymi.
2. **Etap 2 — Przetwarzanie PDF:** Walidacja sygnatury binarnej `%PDF-`, ekstrakcja tekstu `pdfjs-dist`, renderowanie skanów do JPEG oraz *chunking* długich dokumentów + testy jednostkowe.
3. **Etap 3 — Backend Proxy i klient API:** Bezstanowy Cloudflare Worker (`worker/`) z ochroną klucza `GEMINI_API_KEY`, CORS, *rate limitingiem* i izolacją *Prompt Injection* oraz klient `src/api/analyzeClient.ts` z `1x retry` + refaktoryzacja stałych do `config.ts` i konstytucja `AGENTS.md`.
4. **Etap 4 — Oprawa wektorowa, warstwa tekstowa i UI:** Autorskie grafiki `.svg` zaprojektowane w Affinity, wydzielona polska warstwa tekstowa `src/lib/uiCopy.ts`, dostępny interfejs responsywny od `360 px` oraz historia analiz w `localStorage`.
5. **Etap 5 — Wdrożenie produkcyjne, weryfikacja E2E i dokumentacja:** Publikacja Cloudflare Workera (Gemini API Tier 1), weryfikacja na 12-stronicowej umowie testowej, automatyczny deploy GitHub Actions na GitHub Pages oraz dokumentacja `README.md`, `AI_LOG.md` i `SPEC.md`.
