# AGENTS.md — Konstytucja Projektu PDF Insight

Ten dokument definiuje nienaruszalne zasady architektoniczne, standardy jakości oraz reguły bezpieczeństwa obowiązujące każdego agenta AI i programistę pracującego w tym repozytorium.

## 1. Architektura systemu

- **Frontend (`src/`)**: Statyczna aplikacja SPA (React 18+, Vite, TypeScript `strict`) wdrażana na GitHub Pages (`/pdf-insight/`). Odpowiada za walidację i ekstrakcję treści PDF (`pdfjs-dist`), walidację odpowiedzi (`Zod`), prezentację wyników, eksport `.json` oraz lokalną historię analiz (`localStorage`).
- **Backend Proxy (`worker/`)**: Bezstanowy Cloudflare Worker pośredniczący w komunikacji z Google Gemini API. Przechowuje klucz `GEMINI_API_KEY` w sekretach środowiskowych, egzekwuje politykę `CORS`, limity rozmiaru i _rate limiting_ oraz izoluje dane dokumentu przed atakami _prompt injection_.
- **Struktura katalogów**:
  - `src/components/` — komponenty interfejsu użytkownika (prezentacja i interakcja),
  - `src/lib/` — konfiguracja (`config.ts`), teksty UI (`uiCopy.ts`), schemat Zod (`schema.ts`), walidacja i ekstrakcja PDF, magazyn historii,
  - `src/api/` — klient HTTP komunikujący się z proxy (`VITE_API_URL`) z logiką walidacji i `1x retry`,
  - `worker/src/` — konfiguracja (`config.ts`) i obsługa żądań API proxy.

## 2. Twarde zakazy (Zero-Tolerance Rules)

1. **Żadnych sekretów po stronie klienta ani w Git**: Klucz API modelu AI nie może nigdy znaleźć się w kodzie frontendu, zmiennych `VITE_*`, logach, komentarzach ani historii commitów. Pliki `.env` oraz `.dev.vars` pozostają wykluczone w `.gitignore`.
2. **Zakaz obchodzenia systemu typów i bezpieczeństwa DOM**:
   - zakaz używania typu `any` (`@typescript-eslint/no-explicit-any: error`),
   - zakaz zostawiania wywołań `console.log` (`no-console: error`),
   - zakaz używania `dangerouslySetInnerHTML`.
3. **Zakaz rozpraszania „magic numbers” i zahardkodowanych URL-i**: Wszystkie limity rozmiarów, progi znaków, czasy _timeout_, limity _retry_ oraz domyślne adresy deweloperskie muszą być zdefiniowane centralnie w `src/lib/config.ts` (frontend) lub `worker/src/config.ts` (backend). Głównym źródłem adresu backendu na frontendzie jest zawsze `import.meta.env.VITE_API_URL`.
4. **Nienaruszalność kontraktu danych JSON**: Nie wolno usuwać ani zmieniać typów żadnego z pól bazowych schematu (`document`, `summary`, `keyPoints`, `entities`, `amounts`, `dates`, `keywords`). Brak danych w dokumencie zawsze oznacza `null` lub `[]` — model nie może zgadywać faktów. Daty muszą być w formacie ISO 8601 (`YYYY-MM-DD`), a waluty w 3-literowym standardzie ISO 4217 (`PLN`, `EUR`, `USD`).
5. **Obrona przed Prompt Injection**: Treść wyekstrahowana z PDF oraz obrazy zeskanowanych stron są traktowane wyłącznie jako niezaufane dane zamknięte w separatorach `<untrusted_pdf_document>`, nigdy jako polecenia sterujące dla modelu AI.

## 3. Standardy UX, dostępności i kodu

- Wszystkie komunikaty interfejsu użytkownika są po polsku i utrzymywane w wydzielonej warstwie tekstowej (`src/lib/uiCopy.ts`), bez marketingowych kalek językowych.
- Interfejs musi być w pełni obsługiwany z klawiatury (`Tab`, `Enter`, `Space`, wyraźny `:focus-visible`), zachowywać wysoki kontrast oraz pełną responsywność od szerokości `360 px` bez poziomego przewijania.
- Użytkownik musi widzieć czytelną informację, że treść wgranego pliku trafia do zewnętrznego API AI.
- W razie niepowodzenia walidacji odpowiedzi AI klient wykonuje automatycznie dokładnie `1` ponowną próbę (_retry_), a następnie prezentuje polski komunikat błędu z opcją ponowienia.

## 4. Obowiązkowe bramki przed każdym commitem

Żaden commit nie może zostać utworzony ani wypchnięty bez przejścia na zielono wszystkich poniższych komend:

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
```

Historia zmian musi składać się z małych, logicznych commitów zgodnych ze standardem **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
