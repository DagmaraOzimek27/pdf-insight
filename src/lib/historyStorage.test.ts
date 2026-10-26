import { describe, expect, it } from 'vitest';
import { HISTORY_STORAGE_KEY, MAX_HISTORY_ITEMS } from './config';
import { clearHistory, loadHistory, saveResultToHistory } from './historyStorage';
import type { PdfInsightResult } from './schema';

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function createSampleResult(index: number): PdfInsightResult {
  return {
    document: {
      fileName: `dokument_${index}.pdf`,
      pages: index + 1,
      language: 'pl',
      type: 'umowa',
      title: `Umowa testowa nr ${index}`,
      date: '2026-03-12',
    },
    summary: `To jest pierwsze zdanie podsumowania nr ${index}. Drugie zdanie opisuje zakres współpracy stron. Trzecie zdanie podaje termin realizacji zamówienia.`,
    keyPoints: [
      `Punkt kluczowy pierwszy dla dokumentu ${index}`,
      'Punkt kluczowy drugi dotyczący wynagrodzenia',
      'Punkt kluczowy trzeci dotyczący gwarancji',
    ],
    entities: {
      organizations: ['Nordic Retail Poland sp. z o.o.'],
      people: ['Jan Kowalski'],
    },
    amounts: [
      {
        value: 1000 * index,
        currency: 'PLN',
        context: 'Wynagrodzenie ryczałtowe netto',
      },
    ],
    dates: [
      {
        date: '2026-03-12',
        context: 'Data zawarcia umowy',
      },
    ],
    keywords: ['umowa', 'wdrożenie'],
  };
}

describe('historyStorage (F-09)', () => {
  it('zwraca pustą tablicę dla pustego magazynu oraz dla uszkodzonego JSON', () => {
    const storage = new MemoryStorage();
    expect(loadHistory(storage)).toEqual([]);

    storage.setItem(HISTORY_STORAGE_KEY, '{uszkodzony-json');
    expect(loadHistory(storage)).toEqual([]);

    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ obiektZamiastTablicy: true }));
    expect(loadHistory(storage)).toEqual([]);
  });

  it('zapisuje wyniki od najnowszego i pilnuje limitu MAX_HISTORY_ITEMS (10 pozycji)', () => {
    const storage = new MemoryStorage();

    for (let i = 1; i <= 13; i += 1) {
      saveResultToHistory(createSampleResult(i), storage);
    }

    const loaded = loadHistory(storage);
    expect(loaded).toHaveLength(MAX_HISTORY_ITEMS);
    expect(loaded[0].result.document.fileName).toBe('dokument_13.pdf');
    expect(loaded[MAX_HISTORY_ITEMS - 1].result.document.fileName).toBe('dokument_4.pdf');
  });

  it('waliduje wpisy schematem Zod przy odczycie i odfiltrowuje niepoprawne rekordy', () => {
    const storage = new MemoryStorage();
    const valid = createSampleResult(1);

    storage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'ok-1',
          analyzedAt: '2026-10-26T12:00:00.000Z',
          result: valid,
        },
        {
          id: 'bad-currency',
          analyzedAt: '2026-10-26T12:05:00.000Z',
          result: {
            ...valid,
            amounts: [{ value: 500, currency: 'zł', context: 'Błędna waluta spoza ISO 4217' }],
          },
        },
        {
          id: 'bad-date',
          analyzedAt: 'nie-data',
          result: valid,
        },
      ]),
    );

    const loaded = loadHistory(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('ok-1');
  });

  it('nie tworzy duplikatu przy ponownym zapisie identycznego wyniku analizy', () => {
    const storage = new MemoryStorage();
    const docA = createSampleResult(1);
    const docB = createSampleResult(2);

    saveResultToHistory(docA, storage);
    saveResultToHistory(docB, storage);
    const afterReAnalyzeA = saveResultToHistory(docA, storage);

    expect(afterReAnalyzeA).toHaveLength(2);
    expect(afterReAnalyzeA[0].result.document.fileName).toBe('dokument_1.pdf');
    expect(afterReAnalyzeA[1].result.document.fileName).toBe('dokument_2.pdf');
  });

  it('czyści historię z localStorage oraz działa bezpiecznie przy zablokowanym Storage', () => {
    const storage = new MemoryStorage();
    saveResultToHistory(createSampleResult(1), storage);
    expect(loadHistory(storage)).toHaveLength(1);

    clearHistory(storage);
    expect(loadHistory(storage)).toEqual([]);

    const throwingStorage: Storage = {
      length: 0,
      clear: () => {
        throw new Error('Blocked');
      },
      getItem: () => {
        throw new Error('Blocked');
      },
      key: () => null,
      removeItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Blocked');
      },
    };

    expect(loadHistory(throwingStorage)).toEqual([]);
    expect(saveResultToHistory(createSampleResult(2), throwingStorage)).toHaveLength(1);
    expect(() => clearHistory(throwingStorage)).not.toThrow();
  });
});
