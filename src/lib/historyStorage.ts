import { z } from 'zod';
import { HISTORY_OPT_IN_STORAGE_KEY, HISTORY_STORAGE_KEY, MAX_HISTORY_ITEMS } from './config';
import { pdfInsightSchema, type PdfInsightResult } from './schema';

export const historyEntrySchema = z.object({
  id: z.string().trim().min(1),
  analyzedAt: z
    .string()
    .trim()
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: 'Nieprawidłowy znacznik czasu analizy.',
    }),
  result: pdfInsightSchema,
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

function getDefaultStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function generateEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadHistorySavePreference(storage: Storage | null = getDefaultStorage()): boolean {
  if (!storage) {
    return true;
  }

  try {
    const raw = storage.getItem(HISTORY_OPT_IN_STORAGE_KEY);
    if (raw === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function setHistorySavePreference(
  enabled: boolean,
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(HISTORY_OPT_IN_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Wyciszenie przy zablokowanym Storage w trybie prywatnym.
  }
}

// Wczytuje historię z localStorage i waliduje każdy wpis schematem Zod (odrzuca wpisy uszkodzone bez kasowania poprawnych).
export function loadHistory(storage: Storage | null = getDefaultStorage()): HistoryEntry[] {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validEntries: HistoryEntry[] = [];
    for (const candidate of parsed) {
      const check = historyEntrySchema.safeParse(candidate);
      if (check.success) {
        validEntries.push(check.data);
      }
      if (validEntries.length >= MAX_HISTORY_ITEMS) {
        break;
      }
    }

    return validEntries;
  } catch {
    return [];
  }
}

export function saveResultToHistory(
  result: PdfInsightResult,
  storage: Storage | null = getDefaultStorage(),
): HistoryEntry[] {
  const validatedResult = pdfInsightSchema.safeParse(result);
  const existing = loadHistory(storage);

  if (!validatedResult.success) {
    return existing;
  }

  const newEntry: HistoryEntry = {
    id: generateEntryId(),
    analyzedAt: new Date().toISOString(),
    result: validatedResult.data,
  };

  // Jeśli ten sam dokument był już na liście, przenosimy zaktualizowany wynik na początek bez duplikatu.
  const deduplicated = existing.filter(
    (entry) =>
      !(
        entry.result.document.fileName === validatedResult.data.document.fileName &&
        entry.result.document.pages === validatedResult.data.document.pages &&
        entry.result.summary === validatedResult.data.summary
      ),
  );

  const nextEntries = [newEntry, ...deduplicated].slice(0, MAX_HISTORY_ITEMS);

  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      // Ignorujemy błąd przepełnienia pamięci (QuotaExceededError), zachowując aktualny stan w RAM.
    }
  }

  return nextEntries;
}

export function clearHistory(storage: Storage | null = getDefaultStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Bezpieczne wyciszenie w trybie prywatnym z zablokowanym zapisem.
  }
}
