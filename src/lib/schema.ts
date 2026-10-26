import { z } from 'zod';
import {
  KEY_POINTS_MAX_ITEMS,
  KEY_POINTS_MIN_ITEMS,
  SUMMARY_MAX_SENTENCES,
  SUMMARY_MIN_SENTENCES,
} from './config';

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_LANGUAGE_REGEX = /^[a-z]{2}$/;
const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
const LANGUAGE_DISPLAY_NAMES = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
});

// Weryfikuje zarówno format RRRR-MM-DD, jak i realność daty w kalendarzu (np. odrzuca 2026-02-30).
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

export function isValidIsoLanguage(value: string): boolean {
  if (!ISO_LANGUAGE_REGEX.test(value)) {
    return false;
  }
  return LANGUAGE_DISPLAY_NAMES.of(value) !== undefined;
}

// Wymusza oficjalny 3-literowy kod ISO 4217 (np. PLN, EUR, USD) i odrzuca skróty potoczne typu "zł".
export function isValidIsoCurrency(value: string): boolean {
  return ISO_CURRENCY_REGEX.test(value) && SUPPORTED_CURRENCIES.has(value);
}

// Liczy zdania z pominięciem kropek w liczbach, datach i polskich skrótach prawniczych (np. "sp. z o.o.", "r.").
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed
    .replace(/(\d)\.(\d)/g, '$1_$2')
    .replace(/(\d)\.(\d)/g, '$1_$2')
    // Uwaga: brak flagi "i", aby klasa Unicode \p{Lu} rozróżniała wyłącznie wielkie litery nowego zdania
    .replace(/\b[Ss]p\.\s*z\s*o\.o\.(?!\s+\p{Lu}|\s*$)/gu, 'sp_ z o_o_')
    .replace(/\b[Ss]p\.\s*z\s*o\.o\./gu, 'sp_ z o_o.')
    .replace(/\b(?:S\.A\.|s\.a\.)(?!\s+\p{Lu}|\s*$)/gu, 'S_A_')
    .replace(/\b(?:S\.A\.|s\.a\.)/gu, 'S_A.')
    .replace(
      /\b(ok|np|tj|tzn|ul|al|nr|ust|art|pkt|poz|zał|wg|dot|por|im|św|dr|inż|prof|mr|mrs|ms|vs|approx)\./gi,
      '$1_',
    )
    .replace(/\b(r|mies|tys|mln|mld|godz|min|sek|str)\.(?!\s+\p{Lu}|\s*$)/gu, '$1_');

  return normalized
    .split(/(?:[.!?]+|…)['"”)]*(?:\s+|$)/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0).length;
}

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, { message: 'Data musi być w formacie ISO 8601 (YYYY-MM-DD).' });

export const isoLanguageSchema = z.string().refine(isValidIsoLanguage, {
  message: 'Język musi być dwuliterowym kodem ISO 639-1 (np. "pl", "en").',
});

export const isoCurrencySchema = z.string().refine(isValidIsoCurrency, {
  message: 'Waluta musi być trzyliterowym kodem ISO 4217 wielkimi literami (np. "PLN", "EUR").',
});

export const documentMetadataSchema = z
  .object({
    fileName: z.string().trim().min(1, 'Nazwa pliku jest wymagana.'),
    pages: z.number().int().positive('Liczba stron musi być dodatnią liczbą całkowitą.'),
    language: isoLanguageSchema,
    type: z.enum(DOCUMENT_TYPES),
    title: z.string().trim().min(1).nullable(),
    date: isoDateSchema.nullable(),
  })
  .passthrough();

export const amountItemSchema = z
  .object({
    value: z.number().finite(),
    currency: isoCurrencySchema,
    context: z.string().trim().min(1, 'Kontekst kwoty jest wymagany.'),
  })
  .passthrough();

export const dateItemSchema = z
  .object({
    date: isoDateSchema,
    context: z.string().trim().min(1, 'Kontekst daty jest wymagany.'),
  })
  .passthrough();

export const entitiesSchema = z
  .object({
    organizations: z.array(z.string().trim().min(1)),
    people: z.array(z.string().trim().min(1)),
  })
  .passthrough();

// Główny schemat wyniku zgodny z sekcją 04 briefu (.passthrough() pozwala dodawać pola bez usuwania bazowych).
export const pdfInsightSchema = z
  .object({
    document: documentMetadataSchema,
    summary: z
      .string()
      .trim()
      .min(1, 'Podsumowanie nie może być puste.')
      .refine(
        (text) => {
          const count = countSentences(text);
          return count >= SUMMARY_MIN_SENTENCES && count <= SUMMARY_MAX_SENTENCES;
        },
        {
          message: `Podsumowanie musi składać się z ${SUMMARY_MIN_SENTENCES} do ${SUMMARY_MAX_SENTENCES} zdań.`,
        },
      ),
    keyPoints: z
      .array(z.string().trim().min(1))
      .min(KEY_POINTS_MIN_ITEMS, `Wymagane są co najmniej ${KEY_POINTS_MIN_ITEMS} kluczowe punkty.`)
      .max(
        KEY_POINTS_MAX_ITEMS,
        `Dopuszczalne jest maksymalnie ${KEY_POINTS_MAX_ITEMS} kluczowych punktów.`,
      ),
    entities: entitiesSchema,
    amounts: z.array(amountItemSchema),
    dates: z.array(dateItemSchema),
    keywords: z.array(z.string().trim().min(1)),
  })
  .passthrough();

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type PdfInsightResult = z.infer<typeof pdfInsightSchema>;

export function validatePdfInsight(payload: unknown) {
  return pdfInsightSchema.safeParse(payload);
}
