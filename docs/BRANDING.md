# Metryczka Projektowa Znaku i Identyfikacji Wizualnej — PDF Insight

Dokument opisuje założenia projektowe, budowę geometryczną oraz parametry kolorystyczne i typograficzne systemu identyfikacji wizualnej aplikacji **PDF Insight**. Wszystkie elementy wektorowe (`logo.svg`, `favicon.svg`, `dropzone-icon.svg`) zostały zaprojektowane natywnie w środowisku **Affinity** (w przestrzeni barw sRGB, 72 DPI) z zamianą liternictwa na krzywe Béziera.

---

## 1. Znak główny (`public/logo.svg`)

<p align="left">
  <img src="../public/logo.svg" alt="Znak główny PDF Insight" width="280" />
</p>

### Idea i dekodowanie preferowane
Zadaniem aplikacji jest przekształcanie nieustrukturyzowanego dokumentu PDF (w tym skanów) w zweryfikowany, gotowy do użycia obiekt danych `JSON`. Znak koduje ten proces bezpośrednio w formie **syntetycznego ideogramu** czytanego od lewej do prawej (zgodnie z naturalnym kierunkiem czytania i przepływu danych w aplikacji):

1. **Strona wejściowa — arkusz PDF (`PdfSheet`, `PdfFold`, `PdfLines`):** Lewą połowę sygnetu tworzy pionowy moduł karty dokumentu w klasycznej PDF-owej czerwieni (`#C81E1E`) z charakterystycznym zagięciem narożnika w głębszym odcieniu karmazynu (`#991B1B`) oraz dwiema belkami symbolizującymi wiersze tekstu.
2. **Strona wyjściowa — klamra struktury danych (`JsonBrace`):** Prawa krawędź arkusza nie zamyka się prostą linią, lecz przechodzi w wyrazistą, antracytową klamrę zamykającą **`}`** (`#141413`, obrys `5,5 px` z miękkim wyprowadzeniem łuków i zaokrąglonymi zakończeniami `stroke-linecap: round`), jednoznacznie kojarzoną ze składnią obiektu JSON.
3. **Punkt ekstrakcji (`InsightDiamond`):** Na osi symetrii poziomej (`y = 32 px`), dokładnie w ognisku klamry `}`, umieszczono karmazynowy romb (*iskrę wglądu*), spinający kolorystycznie część dokumentową z częścią strukturalną i symbolizujący wydobycie kluczowej informacji z treści.

---

## 2. Semantyka form i relacja Sygnet + Logotyp

- **Prostokąt arkusza i poziome belki tekstu:** komunikują porządek dokumentowy, stabilność i rzetelność źródła (brak domysłów spoza dokumentu).
- **Dynamiczny dziób klamry `}` skierowany w prawo oraz romb:** wprowadzają wektor ruchu naprzód — przejście od surowego pliku do uporządkowanego wyniku.
- **Spójność zakończeń i promieni:** Zaokrąglenia zewnętrznych narożników arkusza, miękkie łuki klamry JSON oraz półokrągłe zakończenia wierszy tekstu trzymają jednolity charakter morfologiczny (brak przypadkowego zderzenia ostrych szpiców z miękkimi łukami, z wyjątkiem celowego akcentu centralnego rombu).
- **Logotyp słowny (`WordmarkText`):**
  - Złożony geometrycznym krojem bezszeryfowym o otwartych światłach wewnętrznych, zamienionym w Affinity na czyste ścieżki wektorowe (`convertToCurves`), co uniezależnia renderowanie znaku od czcionek zainstalowanych w systemie użytkownika.
  - Zastosowano dwudzielny podział barwny i wagowy analogiczny do sygnetu: człon **`PDF`** w mocnej odmianie i czerwieni `#C81E1E` odpowiada lewej części sygnetu, natomiast człon **`Insight`** w głębokim antracycie `#141413` odpowiada prawej części analitycznej.
  - Wspólna oś optyczna sygnetu i napisu przebiega na wysokości `y = 32 px` w polu `viewBox="0 0 250 64"`.

---

## 3. System wariantów i praca w skali mikro

Wszystkie elementy graficzne interfejsu dzielą tę samą paletę barw, grubość obrysów i logikę konstrukcyjną:

| Plik w repozytorium | Podgląd | Siatka bazowa | Przeznaczenie i korekta optyczna |
| :--- | :---: | :--- | :--- |
| [`public/logo.svg`](../public/logo.svg) | <img src="../public/logo.svg" alt="Logo" width="150" /> | `250 × 64 px` | Pełny układ poziomy (sygnet + logotyp) w nagłówku aplikacji. |
| [`public/favicon.svg`](../public/favicon.svg) | <img src="../public/favicon.svg" alt="Favicon" width="44" /> | `64 × 64 px` | Samodzielny sygnet osadzony na jasnym kafelku `#F8F7F5` z subtelną ramką `#E2DED7`. Zapobiega zlewaniu się antracytowej klamry `}` z ciemnym paskiem kart przeglądarki w trybie *Dark Mode* i zachowuje czytelność w skali `16 × 16 px`. |
| [`public/dropzone-icon.svg`](../public/dropzone-icon.svg) | <img src="../public/dropzone-icon.svg" alt="Ikona strefy wgrywania" width="56" /> | `96 × 96 px` | Ikona funkcjonalna strefy wgrywania: arkusz dokumentu ujęty w karmazynowe narożniki kadrujące skanera (`DropBrackets` — nawiązanie do obsługi skanów OCR/wizji `F-10`) z kołowym sygnalizatorem wgrywania. |

### Pole ochronne i skala minimalna
- **Pole ochronne (*Clear Space*):** wokół pełnego znaku należy zachować wolną przestrzeń równą co najmniej wysokości zagiętego narożnika arkusza (`12 px` w skali bazowej, czyli ok. `20%` wysokości sygnetu).
- **Minimalna wysokość wyświetlania:** `28 px` dla pełnego zestawienia `logo.svg` na ekranie; poniżej tej wielkości stosuje się wyłącznie sam sygnet (`favicon.svg`).

---

## 4. Paleta barw i dostępność kontrastu (WCAG 2.1)

Zamiast czystej bieli `#FFFFFF` i zimnej czerni `#000000`, identyfikacja opiera się na redakcyjnym zestawieniu ciepłego papieru z głębokim antracytem oraz dwoma tonami czerwieni dokumentowej:

| Rola w systemie | Nazwa robocza | HEX | RGB | Kontrast względem tła `#F8F7F5` |
| :--- | :--- | :--- | :--- | :--- |
| **Akcent główny (PDF / CTA)** | *PDF Crimson* | `#C81E1E` | `rgb(200, 30, 30)` | **5,53 : 1** (WCAG AA tekst / AAA duże elementy) |
| **Akcent ciemny (zagięcie / hover)** | *Deep Crimson* | `#991B1B` | `rgb(153, 27, 27)` | **7,60 : 1** (WCAG AAA) |
| **Kolor struktury i typografii** | *Editorial Anthracite* | `#141413` | `rgb(20, 20, 19)` | **17,40 : 1** (WCAG AAA) |
| **Tło bazowe aplikacji i kafelka** | *Warm Paper* | `#F8F7F5` | `rgb(248, 247, 245)` | — *(tło odniesienia)* |
| **Wypełnienie pomocnicze (zagięcie ikony)** | *Soft Rose Tint* | `#FEE2E2` | `rgb(254, 226, 226)` | Stosowane wyłącznie z obrysem `#141413` (`3 px`) |
