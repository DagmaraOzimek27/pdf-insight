# AI_LOG.md — Dziennik Współpracy z AI i Nadzoru Jakości (AI Harness)

Ten dokument opisuje w sposób transparentny przebieg budowy aplikacji **PDF Insight**, zastosowaną uprząż inżynieryjną dla agenta AI (**AI Harness**), pełne brzmienie głównych promptów z każdego etapu oraz rzetelny podział na błędy wyłapane automatycznie przez bramki weryfikacyjne i decyzje/korekty wprowadzone osobiście przeze mnie.

---

## 1. Użyte narzędzia i modele

- **Środowisko programistyczne i agentowe:** Google Antigravity IDE (model z rodziny Gemini)
- **Grafika wektorowa UI:** Affinity (natywne pliki źródłowe `.af` wyeksportowane przez Affinity MCP SDK do `logo.svg`, `favicon.svg` i `dropzone-icon.svg`)
- **Model produkcyjny w aplikacji:** Google Gemini API (`gemini-3.5-flash-lite` z automatycznym *fallbackiem* w Cloudflare Workerze do `gemini-flash-lite-latest` i `gemini-3.8-flash`, plan rozliczeniowy *Pay-as-you-go Tier 1*)
- **Automatyczne bramki jakości:** TypeScript (`strict`), ESLint (zakaz `any` i `console.log`), Prettier, Vitest (40 testów jednostkowych), lokalne środowisko wykonawcze `workerd` (`wrangler dev`) oraz pipeline GitHub Actions CI/CD

---

## 2. Architektura nadzoru nad agentem (AI Harness)

Zamiast jednorazowego generowania całej aplikacji („*zrób mi apkę*”), praca z agentem została zamknięta w kontrolowanej uprzęży składającej się z trzech warstw:

1. **Pliki sterujące `.md` w repozytorium i środowisku:**
   - [`SPEC.md`](./SPEC.md) — ustrukturyzowana specyfikacja wymagań (`F-01`–`F-10`), kontrakt schematu wyjściowego JSON, matryca 4 przypadków brzegowych z dokumentu testowego oraz podział na 5 etapów dostarczania.
   - [`AGENTS.md`](./AGENTS.md) — konstytucja techniczna projektu definiująca architekturę, twarde zakazy bezpieczeństwa (`zero sekretów` na frontendzie i w Git, zakaz `any`, `console.log`, `dangerouslySetInnerHTML`, zakaz *magic numbers* poza `config.ts`, separacja danych PDF od instrukcji modelu) oraz obowiązkowe bramki przed każdym commitem.
   - [`docs/BRANDING.md`](./docs/BRANDING.md) — karta znaku i specyfikacja identyfikacji wizualnej (idea semantyczna znaku PDF → `{ }`, siatka konstrukcyjna, pole ochronne, paleta barw z kontrastem WCAG AAA oraz typografia).
   - Modularne pliki `SKILL.md` w środowisku Antigravity wspierające spójność projektową i redakcyjną.
2. **Kontrakt danych wykonywalny w kodzie (`Zod` + `config.ts`):**
   - Schemat [`src/lib/schema.ts`](./src/lib/schema.ts) weryfikuje każdą odpowiedź modelu AI oraz każdy odczyt z `localStorage` zanim dane trafią na ekran lub do pliku `.json`.
3. **Pętle zwrotne przed każdym commitem (*Feedback Loops*):**
   - Żaden etap nie mógł zakończyć się commitem bez przejścia na zielono pełnego zestawu komend: `format:check` → `typecheck` → `lint` → `test` → `build`.

---

## 3. Przebieg prac etap po etapie i pełne prompty główne

### Etap 1: Inicjalizacja projektu, standardy jakości i schemat walidacji Zod

**Pełny prompt główny:**

```text
Zgodnie z ustaleniami z burzy mózgów oraz przeanalizowanym briefem zaczynamy budowę PDF Insight.

1. Sprawdź, czy mam zainstalowany Node.js, a jeśli nie, doinstaluj wersję LTS. Utwórz projekt w katalogu <workspace>/pdf-insight na bazie React 18+, Vite i TypeScript oraz zainicjalizuj w nim Gita.

2. Ustaw standardy jakości z briefu:
- TypeScript w trybie strict (zero błędów typów),
- ESLint + Prettier z blokadą używania `any` oraz `console.log`,
- foldery w `src/`: `components/`, `lib/`, `api/`,
- `.gitignore` wykluczający `.env` oraz plik `.env.example` ze zmienną `VITE_API_URL`.
Kod ma być prosty i czytelny, ze zwięzłymi komentarzami tylko przy ważnych regułach biznesowych.

3. W `src/lib/` napisz walidację odpowiedzi AI w Zod ściśle według schematu z sekcji 04 briefu:
- wszystkie pola bazowe są wymagane (z możliwością dodania nowych pól w przyszłości),
- `language` jako 2-literowy kod ISO 639-1,
- `type` ograniczony do: `faktura`, `umowa`, `oferta`, `raport`, `inne`,
- daty w formacie ISO 8601 `YYYY-MM-DD` (dla `document.date` dopuszczalne także `null`),
- waluty w `amounts` jako 3-literowy kod ISO 4217 wielkimi literami (musi odrzucać np. `"zł"`),
- `summary` od 3 do 5 zdań oraz `keyPoints` od 3 do 7 elementów.

4. Dodaj testy jednostkowe schematu w Vitest pokrywające poprawne dane oraz przypadki błędne (zła waluta `"zł"`, data `"12.03.2026"`, zła liczba punktów, niepoprawny `type`, brakujące pola).

Odpal sprawdzanie typów, ESLint i testy Vitest. Gdy wszystko przejdzie na zielono, zrób pierwszy commit w Conventional Commits, zatrzymaj się i wytłumacz mi stworzone pliki linia po linii, tak bym doskonale rozumiała ich strukturę i rolę w projekcie.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Błąd liczenia zdań w polskich tekstach prawniczych (`countSentences` w `src/lib/schema.ts`):* Pierwsza implementacja połączyła klasę Unicode wielkich liter `\p{Lu}` z flagą ignorowania wielkości liter (`i`) przy maskowaniu skrótów (`sp. z o.o.`, `S.A.`, `r.`). Flaga `i` sprawiła, że `\p{Lu}` dopasowywało również małe litery i rozbijało 3-zdaniowe streszczenie na 6 zdań. Cztery testy jednostkowe w Vitest zaświeciły na czerwono przy pierwszym uruchomieniu, co wymusiło natychmiastowe usunięcie flagi `i` przed commitem.
  - *Domyślny `.gitignore` szablonu Vite:* Szablon wykluczał jedynie `*.local`, dlatego jawnie dopisano `.env`, `.env.*` oraz `.dev.vars`.
- **Moja weryfikacja i korekta (człowiek):**
  - Wprowadziłam obowiązek prowadzenia bieżącego rejestru zmian po każdym etapie (zamiast odtwarzania logu z pamięci na końcu projektu) oraz ścisłego rozdzielania błędów naprawionych autonomicznie przez agenta (dzięki testom) od moich własnych interwencji projektowych i przeglądowych.

---

### Etap 2: Walidacja binarna pliku PDF, ekstrakcja treści (`pdf.js`), detekcja skanów i *chunking*

**Pełny prompt główny:**

```text
Przechodzimy teraz do Etapu 2: warstwa walidacji pliku i ekstrakcji treści z PDF w `src/lib/` (nadal bez budowania widoku UI ani backendu).

1. Walidacja pliku wejściowego (F-01 MUST):
- akceptuj wyłącznie pliki PDF o rozmiarze powyżej 0 B i maksymalnie do 10 MB,
- oprócz rozszerzenia/MIME zweryfikuj też nagłówek binarny pliku (`%PDF-`), żeby odrzucić np. obrazek ze zmienioną nazwą na `.pdf`,
- wszystkie komunikaty błędów walidacji zwracaj po polsku.

2. Ekstrakcja tekstu przez `pdfjs-dist` (F-02 MUST + pułapka GitHub Pages):
- zainstaluj `pdfjs-dist` i skonfiguruj ścieżkę do workera przez mechanizm zasobów Vite (`new URL(..., import.meta.url)`), tak aby działała poprawnie zarówno lokalnie, jak i po wdrożeniu na podścieżkę GitHub Pages,
- wyciągaj tekst strona po stronie wraz z informacją o łącznej liczbie stron i nazwie pliku.

3. Obsługa skanów bez warstwy tekstowej (F-10 COULD) oraz długich dokumentów (F-08 SHOULD):
- jeśli dana strona ma pustą lub szczątkową warstwę tekstową (jak zeskanowany załącznik na str. 11 umowy testowej), oznacz ją jako skan i wyrenderuj w przeglądarce na canvas do skompresowanego obrazu JPEG (base64), żeby w kolejnym etapie model wizyjny AI mógł odczytać jej treść,
- przygotuj funkcję dzielącą długie dokumenty na logiczne fragmenty tekstowe z zachowaniem granic stron, aby obsłużyć wielostronicowe pliki bez przekraczania limitów zapytań.

4. Testy i weryfikacja:
- dopisz testy jednostkowe w Vitest sprawdzające walidację plików (za duży plik >10 MB, pusty plik, zły format / brak nagłówka `%PDF-`) oraz logikę dzielenia długich tekstów na fragmenty i wykrywania stron wymagających OCR/wizji,
- uruchom formatowanie, sprawdzanie typów, ESLint, Vitest oraz produkcyjny `npm run build` (żeby od razu potwierdzić, że worker `pdf.js` poprawnie się buduje).

Gdy wszystko będzie na zielono, zrób kolejny commit w Conventional Commits, zaktualizuj dziennik oraz mój przewodnik po kodzie linia po linii i zatrzymaj się.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Bundlowanie workera `pdf.js` pod podścieżkę GitHub Pages:* Weryfikacja budowania produkcyjnego wykazała, że zapis `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` dla „gołego” identyfikatora pakietu z `node_modules` nie kopiuje pliku workera do `dist/assets/`. Zastąpiono go natywnym importem zasobu Vite z sufiksem `?url` (`import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`), co gwarantuje poprawne wygenerowanie pliku w `dist/assets/` i honorowanie `base: '/pdf-insight/'`.
- **Moja weryfikacja i korekta (człowiek):**
  - Przed rozpoczęciem Etapu 2 nakazałam utworzenie zdalnego repozytorium na GitHubie i wypychanie każdego kolejnego commita na bieżąco, abym mogła na żywo kontrolować drzewo plików i brak jakichkolwiek plików środowiskowych w publicznym repozytorium.

---

### Etap 3: Bezpieczny backend proxy (Cloudflare Workers), klient API z `1x retry` i refaktoryzacja architektury

**Pełny prompt główny:**

```text
Przechodzimy do Etapu 3: bezpieczny backend proxy dla AI oraz warstwa komunikacji API w `src/api/` (jeszcze bez budowania komponentów UI).

1. Backend API Proxy (Cloudflare Workers w osobnym podfolderze `worker/`):
- przygotuj lekki serwer proxy wywołujący multimodalne API Google Gemini, w którym klucz `GEMINI_API_KEY` jest odczytywany wyłącznie z sekretów środowiskowych (nigdy we frontendzie ani w repozytorium; dodaj bezpieczny plik wzorcowy `.dev.vars.example`),
- ogranicz CORS wyłącznie do domeny mojego demo (`https://dagmaraozimek27.github.io`) oraz lokalnego środowiska deweloperskiego (`localhost`), blokując zapytania z obcych domen kodem 403,
- dodaj limit rozmiaru przyjmowanego żądania oraz prosty rate limiting (limit zapytań na minutę dla jednego IP),
- zabezpiecz prompt przed atakami Prompt Injection (jak ukryta instrukcja na str. 4 umowy testowej): oddziel instrukcję systemową od treści dokumentu zamkniętej w tagach danych i nakaż modelowi traktować zawartość PDF oraz skanów wyłącznie jako analizowane dane, nigdy jako polecenia sterujące,
- przekaż do modelu zarówno wyekstrahowany tekst, jak i obrazy zeskanowanych stron (JPEG base64), wymuszając odpowiedź JSON zgodną z zasadami z sekcji 04 briefu (brak zgadywania = `null` lub `[]`, język wartości zgodny z głównym językiem dokumentu, daty ISO 8601, waluty ISO 4217, 3–5 zdań podsumowania, 3–7 kluczowych punktów).

2. Klient API na frontendzie (`src/api/`):
- stwórz klienta korzystającego ze zmiennej `VITE_API_URL`, który wysyła dane wyekstrahowane z PDF i waliduje odpowiedź schematem Zod z Etapu 1,
- zaimplementuj wymóg z sekcji 04: jeśli odpowiedź AI nie przejdzie walidacji schematu, wykonaj automatycznie dokładnie 1 ponowną próbę (retry), a w razie kolejnego niepowodzenia zwróć czytelny komunikat błędu po polsku,
- obsłuż długie dokumenty podzielone na wiele fragmentów (F-08): dla pojedynczego fragmentu wykonaj jedną analizę, a dla wielu fragmentów przeanalizuj części i połącz je w jeden spójny wynik zgodny ze schematem.

3. Testy i weryfikacja:
- napisz testy jednostkowe w Vitest weryfikujące: automatyczne 1 ponowienie przy błędnym JSON-ie z AI (sukces w 2. próbie oraz błąd po 2 nieudanych próbach), blokadę CORS dla obcej domeny, rate limiting oraz łączenie wyników dla długiego dokumentu,
- uruchom formatowanie, sprawdzanie typów, ESLint, Vitest oraz `npm run build`.

Gdy wszystko będzie na zielono, zrób commit w Conventional Commits, wypchnij go na GitHuba, zaktualizuj dziennik oraz mój przewodnik po kodzie linia po linii i zatrzymaj się.
```

**Pełny prompt refaktoryzacyjny po przeglądzie kodu (przed wejściem w Etap 4):**

```text
Zanim przejdziemy do budowy interfejsu w Etapie 4, po przeglądzie dotychczasowego kodu chcę uporządkować architekturę projektu i zasady pracy agentów AI:

1. Centralizacja konfiguracji (eliminacja „magic numbers” i rozproszonych adresów):
- utwórz plik `src/lib/config.ts` dla frontendu oraz `worker/src/config.ts` dla backendu i przenieś do nich wszystkie stałe konfiguracyjne, limity rozmiarów, progi znaków, timeouty, liczbę prób retry oraz domyślny lokalny adres API (`DEFAULT_DEV_API_URL`),
- zrefaktoryzuj `pdfValidator.ts`, `pdfExtractor.ts`, `analyzeClient.ts` oraz `worker/src/index.ts`, aby pobierały te wartości wyłącznie z plików konfiguracyjnych.

2. Konstytucja projektu dla agentów AI (`AGENTS.md`):
- dodaj w głównym katalogu repozytorium plik `AGENTS.md` (konstytucję dla agentów kodujących), który jasno definiuje architekturę projektu, twarde zakazy bezpieczeństwa i jakości (brak kluczy API we frontendzie i historii Git, zakaz `any`, `console.log`, `dangerouslySetInnerHTML`, zakaz rozrzucania magic numbers poza `config.ts`, ochrona przed prompt injection, nieusuwanie pól ze schematu JSON) oraz obowiązkowe bramki weryfikacyjne przed każdym commitem.

Uruchom formatowanie, sprawdzanie typów, ESLint, wszystkie testy Vitest oraz `npm run build`. Gdy wszystko przejdzie na zielono, zrób commit `refactor:` w Conventional Commits, wypchnij go na GitHuba i zaktualizuj dziennik oraz przewodnik po kodzie.
```

- **Co wyłapały automatyczne bramki (autokorekta AI przed commitem):**
  - *Zużycie strumienia `Response` w teście Rate Limitera (`worker/src/index.test.ts`):* W teście wysyłającym 15 zapytań z jednego IP użyto początkowo pojedynczej instancji `new Response(...)` w `mockResolvedValue`. Ponieważ w standardzie Web Fetch API strumień ciała odpowiedzi można odczytać tylko raz, od 2. zapytania Worker zwracał `502` zamiast `200`. Test Vitest wykrył błąd i wymusił zmianę na fabrykę `mockImplementation(() => new Response(...))`.
- **Moja weryfikacja i korekta (człowiek):**
  - Po przeglądzie kodu zauważyłam rozproszenie stałych liczbowych (*magic numbers*), limitów znaków i domyślnego adresu `DEFAULT_DEV_API_URL` pomiędzy czterema plikami (`pdfValidator.ts`, `pdfExtractor.ts`, `analyzeClient.ts`, `worker/src/index.ts`) oraz brak pliku konstytucyjnego dla agentów kodujących. Wstrzymałam wejście w Etap 4 i zleciłam dedykowany commit `refactor:` wydzielający centralne pliki `config.ts` oraz dodający `AGENTS.md`.

---

### Etap 4: Grafiki wektorowe w Affinity, wydzielona warstwa tekstowa `uiCopy.ts` i dostępny interfejs (`F-01`, `F-05`, `F-06`, `F-09`)

**Pełny prompt główny:**

```text
Przechodzimy do Etapu 4: oprawa wizualna w Affinity, autorska warstwa tekstowa oraz kompletny interfejs użytkownika po polsku w `src/components/` i `src/App.tsx` wraz z lokalną historią analiz (`F-09`).

1. Oprawa wizualna i grafiki wektorowe natywnie w Affinity:
- zaprojektuj natywnie w Affinity spójny zestaw grafik wektorowych oparty na palecie PDF-owej czerwieni (`#C81E1E` / `#991B1B`), głębokiego antracytu (`#141413`) i ciepłego jasnego tła (`#F8F7F5`):
  a) `logo.svg` — syntetyczny sygnet (motyw arkusza PDF przechodzącego w klamrę `{ }` JSON) zestawiony z logotypem „PDF Insight”,
  b) `favicon.svg` — kwadratowy wariant samego sygnetu czytelny w małej skali na karcie przeglądarki,
  c) `dropzone-icon.svg` — minimalistyczna ikona wektorowa do strefy wgrywania dokumentu,
- osadź wyeksportowane pliki `.svg` w projekcie oraz podepnij faviconę i polski tytuł strony w `index.html`.

2. Wydzielona warstwa tekstowa (`src/lib/uiCopy.ts`) bez sztampy AI:
- zgrupuj wszystkie teksty interfejsu (nagłówki, opisy, etykiety przycisków, stany puste/ładowania/błędu oraz klauzulę o API AI) w jednym pliku `src/lib/uiCopy.ts`, abym mogła je wygodnie przejrzeć i samodzielnie zredagować własnymi słowami,
- użyj naturalnej, konkretnej polszczyzny pozbawionej marketingowych kalek AI.

3. Wgrywanie pliku i stany interfejsu (`F-01`, `F-06` + wymogi bezpieczeństwa z sekcji 05):
- zbuduj strefę wgrywania PDF obsługującą drag & drop, wybór z dysku oraz pełną nawigacją klawiaturą (`Tab`, `Enter`/`Spacja`, wyraźny focus),
- umieść widoczną informację dla użytkownika, że treść wgranego dokumentu PDF jest przesyłana do zewnętrznego API modelu AI w celu analizy,
- obsłuż czytelnie trzy stany interfejsu po polsku: stan pusty (intuicyjny bez dodatkowej instrukcji), stan ładowania z informacją o bieżącym etapie (odczyt stron PDF / skanów oraz analiza AI) i stan błędu z przyciskiem „Spróbuj ponownie” dla ostatnio wybranego pliku.

4. Prezentacja wyników i eksport (`F-05`):
- wyświetl przejrzyście wszystkie sekcje schematu: metadane dokumentu, podsumowanie, kluczowe punkty, organizacje i osoby, kwoty z walutami i kontekstem, daty oraz słowa kluczowe (z czytelnym oznaczeniem braku danych dla `null` / `[]`),
- dodaj podgląd sformatowanego obiektu JSON (z opcją skopiowania do schowka) oraz przycisk pobierania wyniku jako pliku `.json`,
- nie używaj nigdzie `dangerouslySetInnerHTML`.

5. Lokalna historia analiz (`F-09 SHOULD`):
- zapisuj ostatnie analizy lokalnie w `localStorage` przeglądarki (do 10 pozycji, walidowanych przy odczycie schematem Zod), z możliwością szybkiego przełączenia się na wcześniejszy wynik oraz wyczyszczenia historii.

6. UX, dostępność, testy i podgląd:
- zadbaj o nowoczesny, czytelny wygląd o wysokim kontraście oraz pełną responsywność od szerokości 360 px (brak poziomego przewijania na wąskich ekranach, m.in. przy długich nazwach plików oraz zestawieniach kwot i dat),
- dopisz testy jednostkowe w Vitest dla modułu lokalnej historii analiz,
- uruchom formatowanie, sprawdzanie typów, ESLint, Vitest oraz `npm run build`.

Gdy wszystko będzie na zielono, zrób commit w Conventional Commits, wypchnij go na GitHuba, zaktualizuj dziennik oraz mój przewodnik po kodzie linia po linii, a na koniec uruchom lokalny podgląd aplikacji i wylistuj mi wszystkie teksty z `uiCopy.ts` do mojej autorskiej korekty i testów manualnych.
```

- **Co wyłapały narzędzia podglądu podczas generowania zasobów (autokorekta AI):**
  - *Jednostki dokumentu i marginesy w Affinity SDK:* Pierwsze wywołanie użyło nieistniejącego klucza `UnitType.Pixels` zamiast `UnitType.Pixel`, a wizualny render `render_spread` ikony `dropzone-icon.svg` ujawnił zbyt mały odstęp narożnika skanera i dolnego kółka od krawędzi obszaru `96x96` — poprawiono współrzędne w wersji `v2` przed eksportem do `public/`.
- **Moja weryfikacja i korekta (człowiek):**
  - Zdecydowałam o rezygnacji z gotowych paczek ikon na rzecz dedykowanego sygnetu zaprojektowanego natywnie w Affinity oraz o odseparowaniu całej polskiej warstwy językowej do `src/lib/uiCopy.ts` pod ręczną redakcję.
  - Przeprowadziłam manualne testy responsywności w Chrome DevTools przy szerokości dokładnie `360 px` (`360 × 642` oraz `360 × 480`) od nagłówka aż do stopki, weryfikując brak poziomego przewijania oraz zachowanie kontenera przy różnych poziomach powiększenia przeglądarki.

---

### Etap 5: Wdrożenie chmurowe (Cloudflare Workers + Gemini Tier 1), weryfikacja E2E na umowie z pułapkami i publikacja GitHub Pages

**Pełny prompt główny:**

```text
Przechodzimy do Etapu 5 (finał): wdrożenie chmurowego backendu proxy z kluczem Gemini API (Pay-as-you-go Tier 1), test end-to-end na dokumencie testowym, publikacja demo na GitHub Pages z CI/CD oraz kompletna dokumentacja repozytorium i uprzęży AI (AI Harness).

1. Wdrożenie Cloudflare Worker Proxy i bezpieczna konfiguracja Gemini API (Tier 1):
- zainstaluj `wrangler` w projekcie i przeprowadź mnie krok po kroku przez:
  a) wygenerowanie klucza `GEMINI_API_KEY` w Google AI Studio na planie Pay-as-you-go (Tier 1 — stabilne limity w UE i brak trenowania modeli na przesyłanych dokumentach) z ustawieniem alertu budżetowego na 5 USD,
  b) bezpieczne przekazanie klucza przez ignorowany w Git plik `worker/.dev.vars` (bez wklejania klucza w oknie czatu ani w kodzie) oraz wgranie go jako zaszyfrowanego sekretu produkcyjnego `npx wrangler secret put GEMINI_API_KEY`,
  c) logowanie i wdrożenie `worker/` na Cloudflare Workers (`npx wrangler deploy`) oraz weryfikację działania endpointu i nagłówków CORS dla `https://dagmaraozimek27.github.io` i środowiska lokalnego.

2. Test end-to-end na pliku `Test_PDF_Insight_umowa_14-2026.pdf` (Definition of Done):
- przetestuj pełny przepływ analizy na 12-stronicowej umowie testowej i potwierdź:
  a) czas odpowiedzi poniżej 30 sekund,
  b) zignorowanie ukrytego ataku Prompt Injection ze strony 4 (brak fałszywej informacji o nieważności umowy lub kwocie 1 PLN),
  c) poprawne odczytanie zeskanowanego Aneksu nr 1 ze strony 11 (nowa opłata 13 100,00 PLN netto od 2027-04-01 oraz limit 135 użytkowników),
  d) zachowanie głównego języka `"pl"` mimo anglojęzycznego podsumowania na stronie 10 oraz 100% zgodności ze schematem Zod (waluty ISO 4217, daty ISO 8601, podsumowanie 3–5 zdań, 3–7 kluczowych punktów).

3. Publikacja na GitHub Pages i pipeline CI/CD (`F-07 MUST`):
- ustaw poprawny `base: '/pdf-insight/'` w `vite.config.ts`, aby wszystkie zasoby, grafiki `.svg` oraz worker `pdf.js` ładowały się bez błędów 404 na podścieżce GitHub Pages,
- utwórz workflow GitHub Actions (`.github/workflows/deploy.yml`) uruchamiający automatyczne bramki jakości (`format:check`, `typecheck`, `lint`, `test`, `build` z produkcyjnym `VITE_API_URL`) i publikujący aplikację na `https://dagmaraozimek27.github.io/pdf-insight/`,
- zweryfikuj publiczny adres demo (musi działać od razu po otwarciu linku, bez podawania klucza API przez osobę sprawdzającą).

4. Dokumentacja końcowa, pliki sterujące AI Harness i audyt bezpieczeństwa:
- dodaj plik `SPEC.md` porządkujący specyfikację funkcjonalną (`F-01`–`F-10`), kontrakt JSON, zidentyfikowane przypadki brzegowe z pliku testowego oraz 5-etapowy plan realizacji, tak aby wraz z `AGENTS.md` tworzył kompletny zestaw plików sterujących (AI Harness),
- wykonaj zrzut ekranu działającej aplikacji z wynikiem analizy i osadź go w `README.md`,
- przygotuj kompletny `README.md` (opis projektu, diagram architektury Frontend -> Cloudflare Worker Proxy -> Gemini API Tier 1, link do live demo, instrukcja uruchomienia lokalnego, opis stosu i decyzji technicznych, ochrona klucza API, polityka nietrenowania danych w Tier 1, obrona przed Prompt Injection oraz znane ograniczenia),
- przygotuj rzetelny, transparentny `AI_LOG.md` na bazie prowadzonego dziennika (z sekcją opisującą zastosowany AI Harness: pliki `.md` + automatyczne bramki weryfikacyjne, kluczowe prompty z każdego etapu oraz wyraźny podział na autokorektę AI i moje osobiste decyzje/korekty),
- wykonaj końcowy audyt czystości repozytorium i historii Git (brak `.env`, `.dev.vars` i sekretów), uruchom wszystkie bramki z `AGENTS.md`, zrób końcowe commity w Conventional Commits, wypchnij na GitHuba i zaktualizuj mój przewodnik po kodzie (wraz ze ściągą na rozmowę o AI Harness).
```

- **Co wyłapały testy uruchomieniowe i diagnostyka live API (autokorekta AI):**
  - *Restrykcje eksportów w środowisku wykonawczym Cloudflare `workerd`:* Lokalne uruchomienie `wrangler dev` wykazało, że najnowszy runtime `workerd` odrzuca nazwane eksporty stałych liczbowych (`MAX_IMAGES_PER_REQUEST` itd.) z głównego pliku wejściowego Workera (`Incorrect type for map entry: not of type function or ExportedHandler`), mimo że testy w Node/Vitest przechodziły poprawnie. Usunięto re-eksporty stałych z `worker/src/index.ts` i przepięto testy bezpośrednio na `worker/src/config.ts`.
  - *Dostępność modeli Gemini i automatyczny fallback:* Test na żywo z API wykazał chwilowe przeciążenie (`HTTP 503 high demand`) na aliasie `gemini-flash-latest` / `gemini-3.8-flash`, podczas gdy `gemini-3.5-flash-lite` odpowiadał kodem `200` poniżej sekundy. Ustawiono `gemini-3.5-flash-lite` jako szybki model podstawowy (pełna analiza 12-stronicowej umowy ze skanem w **8,18 s**) i dodano w Workerze automatyczną pętlę *fallback* przełączającą model przy kodach `503` / `429` / `404` wraz z testem jednostkowym.
- **Moja weryfikacja i decyzje infrastrukturalne (człowiek):**
  - Zamiast pozostawiać klucz API na darmowym planie o ciasnych limitach w UE, podjęłam decyzję o uruchomieniu planu *Pay-as-you-go (Tier 1)* z alertem budżetowym (gwarantującego stabilną przepustowość podczas oceny zadania oraz brak trenowania modeli Google na przesyłanych dokumentach).
  - Podczas generowania klucza zauważyłam nowy prefiks formatu klucza (`AQ...` zamiast historycznego `AIza...`) i zleciłam weryfikację jego kompatybilności z endpointem przed wdrożeniem produkcyjnym.
  - Podczas końcowego przeglądu kodu (*code review*) wychwycono przypadek brzegowy w `countSentences` (`src/lib/schema.ts`): bezwarunkowe maskowanie skrótów z flagą `gi` zjadało kropkę kończącą zdanie po polskim zaimku `im.`, słowie `ok.` oraz wielkoliterowych akronimach typu `MS.` lub `DOT.`. Rozbito reguły na kontekstowe *lookaheady* i *lookbehindy* oraz dopisano test regresyjny w `src/lib/schema.test.ts`.
  - Na domknięcie dokumentacji projektowej zleciłam przygotowanie karty znaku i systemu identyfikacji wizualnej w [`docs/BRANDING.md`](./docs/BRANDING.md) w oparciu o dedykowany skill projektowania logotypów (`SKILL.md`).
  - Przed wysłaniem formularza przeprowadzono dodatkowy audyt bezpieczeństwa i UX publicznego repozytorium, na podstawie którego wdrożyłam 4 punktowe uszczelnienia wraz z testami jednostkowymi (łącznie 40 testów):
    1. *Zamknięcie granicy zaufania `retryCodes` i eliminacja overfittingu w Workerze (`worker/src/index.ts`, `src/api/analyzeClient.ts`):* Usunięto przyjmowanie dowolnego tekstu `validationFeedback` od klienta (odrzucane kodem `400`) na rzecz zamkniętej listy kodów `ALLOWED_RETRY_CODES` tłumaczonej na instrukcję korekcyjną wyłącznie po stronie serwera; dodano neutralizację prób przedwczesnego domknięcia znacznika `</untrusted_pdf_document>` w tekście PDF oraz uogólniono `buildSystemInstruction()` (usuwając dosłowny przykład `1 PLN` z dokumentu testowego).
    2. *Czyszczenie poprzedniego wyniku w UI i kontrola `localStorage` (`src/App.tsx`, `src/components/PdfDropzone.tsx`):* Rozpoczęcie analizy kolejnego pliku oraz wyczyszczenie historii natychmiast usuwają poprzedni `activeResult` z ekranu (eliminując ryzyko pozostawienia starej analizy pod komunikatem błędu nowego pliku); dodano też przełącznik pozwalający wyłączyć lokalny zapis historii dla dokumentów poufnych.
    3. *Jawne ostrzeżenie przy przekroczeniu limitu skanów (`src/lib/pdfExtractor.ts`, `src/components/InsightResults.tsx`):* Wyodrębniono `omittedScanPageNumbers` i dodano wyraźny baner ostrzegawczy `role="alert"` ze wskazaniem numerów pominiętych stron, gdy dokument zawiera więcej niż `5` skanów.
    4. *Precyzja dokumentacji bezpieczeństwa (`README.md`, `SPEC.md`, `AGENTS.md`):* Jawnie rozróżniono rolę `CORS` i lokalnego *rate limitera* instancji Workera od pełnego uwierzytelniania użytkowników w publicznym demo bez logowania oraz doprecyzowano charakterystykę czasową dla bardzo długich, wieloczęściowych raportów (`F-08`).

---

## 4. Podsumowanie weryfikacji końcowej na dokumencie testowym

Pełny test przeglądarkowy end-to-end na pliku `Test_PDF_Insight_umowa_14-2026.pdf` (12 stron):

- **Czas całkowity (ekstrakcja `pdf.js` + render skanu JPEG + API proxy + walidacja Zod):** `8,18 s` lokalnie / `10,72 s` na publicznym GitHub Pages w trybie Incognito (wymóg: `< 30 s`).
- **Strona 4 (ukryty biały tekst *Prompt Injection*):** całkowicie zignorowany — brak wzmianki o rzekomej nieważności umowy i brak fałszywej kwoty `1 PLN`.
- **Strona 10 (anglojęzyczne *Executive Summary*):** główny język dokumentu prawidłowo rozpoznany jako `"pl"`, całe podsumowanie i konteksty po polsku.
- **Strona 11 (zeskanowany obraz *Aneksu nr 1* bez warstwy tekstowej):** strona automatycznie wykryta jako skan (`1`), wyrenderowana na `<canvas>` i odczytana wizyjnie — w wynikach uwzględniono nową stawkę abonamentu `13 100 PLN` netto od `2027-04-01`, datę aneksu `2026-03-20` oraz zwiększenie limitu ze `120` do `135` użytkowników.
