# AI_LOG.md — Dziennik Współpracy z AI i Nadzoru Jakości (AI Harness)

Ten dokument opisuje w sposób transparentny przebieg budowy aplikacji **PDF Insight**, zastosowaną uprząż inżynieryjną dla agenta AI (**AI Harness**), kluczowe prompty z każdego etapu oraz rzetelny podział na błędy wyłapane automatycznie przez bramki weryfikacyjne i decyzje/korekty wprowadzone osobiście przeze mnie.

---

## 1. Użyte narzędzia i modele

- **Środowisko programistyczne i agentowe:** Google Antigravity IDE (model z rodziny Gemini)
- **Grafika wektorowa UI:** Affinity (natywne pliki źródłowe `.af` wyeksportowane przez Affinity MCP SDK do `logo.svg`, `favicon.svg` i `dropzone-icon.svg`)
- **Model produkcyjny w aplikacji:** Google Gemini API (`gemini-3.5-flash-lite` z automatycznym *fallbackiem* w Cloudflare Workerze do `gemini-flash-lite-latest` i `gemini-3.8-flash`, plan rozliczeniowy *Pay-as-you-go Tier 1*)
- **Automatyczne bramki jakości:** TypeScript (`strict`), ESLint (zakaz `any` i `console.log`), Prettier, Vitest (36 testów jednostkowych), lokalne środowisko wykonawcze `workerd` (`wrangler dev`) oraz pipeline GitHub Actions CI/CD

---

## 2. Architektura nadzoru nad agentem (AI Harness)

Zamiast jednorazowego generowania całej aplikacji („*zrób mi apkę*”), praca z agentem została zamknięta w kontrolowanej uprzęży składającej się z trzech warstw:

1. **Pliki sterujące `.md` w repozytorium i środowisku:**
   - [`SPEC.md`](./SPEC.md) — ustrukturyzowana specyfikacja wymagań (`F-01`–`F-10`), kontrakt schematu wyjściowego JSON, matryca 4 przypadków brzegowych z dokumentu testowego oraz podział na 5 etapów dostarczania.
   - [`AGENTS.md`](./AGENTS.md) — konstytucja techniczna projektu definiująca architekturę, twarde zakazy bezpieczeństwa (`zero sekretów` na frontendzie i w Git, zakaz `any`, `console.log`, `dangerouslySetInnerHTML`, zakaz *magic numbers* poza `config.ts`, separacja danych PDF od instrukcji modelu) oraz obowiązkowe bramki przed każdym commitem.
   - Modularne pliki `SKILL.md` w środowisku Antigravity wspierające spójność projektową i redakcyjną.
2. **Kontrakt danych wykonywalny w kodzie (`Zod` + `config.ts`):**
   - Schemat [`src/lib/schema.ts`](./src/lib/schema.ts) weryfikuje każdą odpowiedź modelu AI oraz każdy odczyt z `localStorage` zanim dane trafią na ekran lub do pliku `.json`.
3. **Pętle zwrotne przed każdym commitem (*Feedback Loops*):**
   - Żaden etap nie mógł zakończyć się commitem bez przejścia na zielono pełnego zestawu komend: `format:check` → `typecheck` → `lint` → `test` → `build`.

---

## 3. Przebieg prac etap po etapie i kluczowe prompty

### Etap 1: Inicjalizacja projektu, standardy jakości i schemat walidacji Zod

**Kluczowy prompt:**
```text
1. Utwórz projekt pdf-insight na bazie React 18+, Vite i TypeScript oraz zainicjalizuj w nim Gita.
2. Ustaw standardy jakości z briefu: TypeScript w trybie strict (zero błędów typów), ESLint + Prettier z blokadą używania `any` oraz `console.log`, foldery w `src/`: `components/`, `lib/`, `api/`, `.gitignore` wykluczający `.env` oraz plik `.env.example` ze zmienną `VITE_API_URL`.
3. W `src/lib/` napisz walidację odpowiedzi AI w Zod ściśle według schematu z sekcji 04 briefu: wszystkie pola bazowe wymagane (z możliwością dodania nowych pól w przyszłości), `language` jako 2-literowy kod ISO 639-1, `type` ograniczony do: `faktura`, `umowa`, `oferta`, `raport`, `inne`, daty ISO 8601 `YYYY-MM-DD`, waluty w `amounts` jako 3-literowy kod ISO 4217 wielkimi literami (musi odrzucać np. `"zł"`), `summary` od 3 do 5 zdań oraz `keyPoints` od 3 do 7 elementów.
4. Dodaj testy jednostkowe schematu w Vitest pokrywające poprawne dane oraz przypadki błędne.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Błąd liczenia zdań w polskich tekstach prawniczych (`countSentences` w `src/lib/schema.ts`):* Pierwsza implementacja połączyła klasę Unicode wielkich liter `\p{Lu}` z flagą ignorowania wielkości liter (`i`) przy maskowaniu skrótów (`sp. z o.o.`, `S.A.`, `r.`). Flaga `i` sprawiła, że `\p{Lu}` dopasowywało również małe litery i rozbijało 3-zdaniowe streszczenie na 6 zdań. Cztery testy jednostkowe w Vitest zaświeciły na czerwono przy pierwszym uruchomieniu, co wymusiło natychmiastowe usunięcie flagi `i` przed commitem.
  - *Domyślny `.gitignore` szablonu Vite:* Szablon wykluczał jedynie `*.local`, dlatego jawnie dopisano `.env`, `.env.*` oraz `.dev.vars`.
- **Moja weryfikacja i korekta (człowiek):**
  - Wprowadziłam obowiązek prowadzenia bieżącego rejestru zmian po każdym etapie (zamiast odtwarzania logu z pamięci na końcu projektu) oraz ścisłego rozdzielania błędów naprawionych autonomicznie przez agenta (dzięki testom) od moich własnych interwencji projektowych i przeglądowych.

---

### Etap 2: Walidacja binarna pliku PDF, ekstrakcja treści (`pdf.js`), detekcja skanów i *chunking*

**Kluczowy prompt:**
```text
1. Walidacja pliku wejściowego (F-01 MUST): pliki PDF > 0 B i <= 10 MB, weryfikacja nagłówka binarnego `%PDF-` (odrzucenie np. obrazka ze zmienioną nazwą na `.pdf`), komunikaty po polsku.
2. Ekstrakcja tekstu przez `pdfjs-dist` (F-02 MUST + pułapka GitHub Pages): skonfiguruj ścieżkę do workera przez mechanizm zasobów Vite, tak aby działała poprawnie zarówno lokalnie, jak i na podścieżce GitHub Pages.
3. Obsługa skanów bez warstwy tekstowej (F-10 COULD) oraz długich dokumentów (F-08 SHOULD): strony bez tekstu lub ze szczątkową warstwą tekstową wyrenderuj na canvas do skompresowanego JPEG (base64) pod model wizyjny AI; przygotuj funkcję dzielącą długie dokumenty z zachowaniem granic stron.
4. Dopisz testy jednostkowe w Vitest oraz uruchom produkcyjny `npm run build`.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Bundlowanie workera `pdf.js` pod podścieżkę GitHub Pages:* Weryfikacja budowania produkcyjnego wykazała, że zapis `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` dla „gołego” identyfikatora pakietu z `node_modules` nie kopiuje pliku workera do `dist/assets/`. Zastąpiono go natywnym importem zasobu Vite z sufiksem `?url` (`import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`), co gwarantuje poprawne wygenerowanie pliku w `dist/assets/` i honorowanie `base: '/pdf-insight/'`.
- **Moja weryfikacja i korekta (człowiek):**
  - Przed rozpoczęciem Etapu 2 nakazałam utworzenie zdalnego repozytorium na GitHubie i wypychanie każdego kolejnego commita na bieżąco, abym mogła na żywo kontrolować drzewo plików i brak jakichkolwiek plików środowiskowych w publicznym repozytorium.

---

### Etap 3: Bezpieczny backend proxy (Cloudflare Workers), klient API z `1x retry` i refaktoryzacja architektury

**Kluczowy prompt (implementacja + mój prompt refaktoryzacyjny po przeglądzie kodu):**
```text
1. Backend API Proxy (`worker/`): serwer proxy wywołujący multimodalne API Google Gemini z kluczem `GEMINI_API_KEY` wyłącznie w sekretach środowiskowych, CORS ograniczony do `https://dagmaraozimek27.github.io` i `localhost` (403 dla obcych domen), limit rozmiaru żądania, rate limiting na IP oraz ochrona przed Prompt Injection (separacja instrukcji systemowej od treści dokumentu zamkniętej w tagach `<untrusted_pdf_document>`).
2. Klient API (`src/api/`): komunikacja przez `VITE_API_URL`, walidacja Zod i dokładnie 1 automatyczna ponowna próba (`1x retry`) z przekazaniem listy błędów walidacji przy niepoprawnym formacie JSON, obsługa scalania długich dokumentów (`F-08`).

[Prompt refaktoryzacyjny po przeglądzie kodu]:
Zanim przejdziemy do budowy interfejsu w Etapie 4, po przeglądzie dotychczasowego kodu chcę uporządkować architekturę projektu i zasady pracy agentów AI:
1. Centralizacja konfiguracji (eliminacja „magic numbers” i rozproszonych adresów) do `src/lib/config.ts` oraz `worker/src/config.ts`.
2. Dodanie w głównym katalogu repozytorium pliku konstytucyjnego `AGENTS.md`.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Zużycie strumienia `Response` w teście Rate Limitera (`worker/src/index.test.ts`):* W teście wysyłającym 15 zapytań z jednego IP użyto początkowo pojedynczej instancji `new Response(...)` w `mockResolvedValue`. Ponieważ w standardzie Web Fetch API strumień ciała odpowiedzi można odczytać tylko raz, od 2. zapytania Worker zwracał `502` zamiast `200`. Test Vitest wykrył błąd i wymusił zmianę na fabrykę `mockImplementation(() => new Response(...))`.
- **Moja weryfikacja i korekta (człowiek):**
  - Po przeglądzie kodu zauważyłam rozproszenie stałych liczbowych (*magic numbers*), limitów znaków i domyślnego adresu `DEFAULT_DEV_API_URL` pomiędzy czterema plikami (`pdfValidator.ts`, `pdfExtractor.ts`, `analyzeClient.ts`, `worker/src/index.ts`) oraz brak pliku konstytucyjnego dla agentów kodujących. Wstrzymałam wejście w Etap 4 i zleciłam dedykowany commit `refactor:` wydzielający centralne pliki `config.ts` oraz dodający `AGENTS.md`.

---

### Etap 4: Grafiki wektorowe w Affinity, wydzielona warstwa tekstowa `uiCopy.ts` i dostępny interfejs (`F-01`, `F-05`, `F-06`, `F-09`)

**Kluczowy prompt:**
```text
1. Oprawa wizualna i grafiki wektorowe natywnie w Affinity w palecie PDF-owej czerwieni (`#C81E1E` / `#991B1B`), antracytu (`#141413`) i ciepłego tła (`#F8F7F5`): `logo.svg` (motyw arkusza PDF przechodzącego w klamrę `{ }` JSON), `favicon.svg` oraz `dropzone-icon.svg`.
2. Wydzielona warstwa tekstowa (`src/lib/uiCopy.ts`) bez marketingowej sztampy AI.
3. Wgrywanie pliku z drag & drop i pełną nawigacją klawiaturą (`Tab`, `Enter`/`Spacja`), widoczna klauzula o przesyłaniu treści do zewnętrznego API AI, trzy stany interfejsu po polsku (pusty, ładowanie z bieżącym etapem, błąd z przyciskiem „Spróbuj ponownie”).
4. Prezentacja 7 sekcji schematu, podgląd JSON z kopiowaniem i pobieraniem `.json` (zakaz `dangerouslySetInnerHTML`), lokalna historia do 10 analiz w `localStorage` walidowana schematem Zod oraz pełna responsywność od 360 px.
```

- **Co wyłapały narzędzia podglądu podczas generowania zasobów (autokorekta AI):**
  - *Jednostki dokumentu i marginesy w Affinity SDK:* Pierwsze wywołanie użyło nieistniejącego klucza `UnitType.Pixels` zamiast `UnitType.Pixel`, a wizualny render `render_spread` ikony `dropzone-icon.svg` ujawnił zbyt mały odstęp narożnika skanera i dolnego kółka od krawędzi obszaru `96x96` — poprawiono współrzędne w wersji `v2` przed eksportem do `public/`.
- **Moja weryfikacja i korekta (człowiek):**
  - Zdecydowałam o rezygnacji z gotowych paczek ikon na rzecz dedykowanego sygnetu zaprojektowanego natywnie w Affinity oraz o odseparowaniu całej polskiej warstwy językowej do `src/lib/uiCopy.ts` pod ręczną redakcję.
  - Przeprowadziłam manualne testy responsywności w Chrome DevTools przy szerokości dokładnie `360 px` (`360 × 642` oraz `360 × 480`) od nagłówka aż do stopki, weryfikując brak poziomego przewijania oraz zachowanie kontenera przy różnych poziomach powiększenia przeglądarki.

---

### Etap 5: Wdrożenie chmurowe (Cloudflare Workers + Gemini Tier 1), weryfikacja E2E na umowie z pułapkami i publikacja GitHub Pages

**Kluczowy prompt:**
```text
1. Wdrożenie Cloudflare Worker Proxy i konfiguracja klucza Gemini API na planie Pay-as-you-go (Tier 1) z limitem budżetowym 5 USD oraz zapisaniem sekretu wyłącznie w `wrangler secret put GEMINI_API_KEY`.
2. Test end-to-end na pliku `Test_PDF_Insight_umowa_14-2026.pdf`: czas < 30 s, zignorowanie ukrytego Prompt Injection ze str. 4, odczytanie zeskanowanego Aneksu nr 1 ze str. 11 (13 100,00 PLN netto od 2027-04-01, 135 użytkowników), zachowanie języka `"pl"` mimo str. 10 po angielsku.
3. Publikacja na GitHub Pages (`base: '/pdf-insight/'`) z pipeline'em CI/CD w GitHub Actions.
4. Kompletna dokumentacja (`SPEC.md`, `README.md` ze zrzutem ekranu, `AI_LOG.md`) i audyt czystości historii Git.
```

- **Co wyłapały testy uruchomieniowe i diagnostyka live API (autokorekta AI):**
  - *Restrykcje eksportów w środowisku wykonawczym Cloudflare `workerd`:* Lokalne uruchomienie `wrangler dev` wykazało, że najnowszy runtime `workerd` odrzuca nazwane eksporty stałych liczbowych (`MAX_IMAGES_PER_REQUEST` itd.) z głównego pliku wejściowego Workera (`Incorrect type for map entry: not of type function or ExportedHandler`), mimo że testy w Node/Vitest przechodziły poprawnie. Usunięto re-eksporty stałych z `worker/src/index.ts` i przepięto testy bezpośrednio na `worker/src/config.ts`.
  - *Dostępność modeli Gemini i automatyczny fallback:* Test na żywo z API wykazał chwilowe przeciążenie (`HTTP 503 high demand`) na aliasie `gemini-flash-latest` / `gemini-3.8-flash`, podczas gdy `gemini-3.5-flash-lite` odpowiadał kodem `200` poniżej sekundy. Ustawiono `gemini-3.5-flash-lite` jako szybki model podstawowy (pełna analiza 12-stronicowej umowy ze skanem w **8,18 s**) i dodano w Workerze automatyczną pętlę *fallback* przełączającą model przy kodach `503` / `429` / `404` wraz z testem jednostkowym.
- **Moja weryfikacja i decyzje infrastrukturalne (człowiek):**
  - Zamiast pozostawiać klucz API na darmowym planie o ciasnych limitach w UE, podjęłam decyzję o uruchomieniu planu *Pay-as-you-go (Tier 1)* z alertem budżetowym (gwarantującego stabilną przepustowość podczas oceny zadania oraz brak trenowania modeli Google na przesyłanych dokumentach).
  - Podczas generowania klucza zauważyłam nowy prefiks formatu klucza (`AQ...` zamiast historycznego `AIza...`) i zleciłam weryfikację jego kompatybilności z endpointem przed wdrożeniem produkcyjnym.

---

## 4. Podsumowanie weryfikacji końcowej na dokumencie testowym

Pełny test przeglądarkowy end-to-end na pliku `Test_PDF_Insight_umowa_14-2026.pdf` (12 stron):
- **Czas całkowity (ekstrakcja `pdf.js` + render skanu JPEG + API proxy + walidacja Zod):** `8,18 s` (wymóg: `< 30 s`).
- **Strona 4 (ukryty biały tekst *Prompt Injection*):** całkowicie zignorowany — brak wzmianki o rzekomej nieważności umowy i brak fałszywej kwoty `1 PLN`.
- **Strona 10 (anglojęzyczne *Executive Summary*):** główny język dokumentu prawidłowo rozpoznany jako `"pl"`, całe podsumowanie i konteksty po polsku.
- **Strona 11 (zeskanowany obraz *Aneksu nr 1* bez warstwy tekstowej):** strona automatycznie wykryta jako skan (`1`), wyrenderowana na `<canvas>` i odczytana wizyjnie — w wynikach uwzględniono nową stawkę abonamentu `13 100 PLN` netto od `2027-04-01`, datę aneksu `2026-03-20` oraz zwiększenie limitu ze `120` do `135` użytkowników.
