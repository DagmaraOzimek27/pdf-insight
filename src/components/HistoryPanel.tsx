import { formatTimestampPl } from '../lib/formatters';
import type { HistoryEntry } from '../lib/historyStorage';
import { UI_COPY } from '../lib/uiCopy';

export interface HistoryPanelProps {
  entries: ReadonlyArray<HistoryEntry>;
  activeEntryId: string | null;
  disabled: boolean;
  onSelectEntry: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

export function HistoryPanel({
  entries,
  activeEntryId,
  disabled,
  onSelectEntry,
  onClearHistory,
}: HistoryPanelProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="history-panel" aria-labelledby="history-heading">
      <div className="history-panel__header">
        <div>
          <h2 id="history-heading" className="history-panel__title">
            {UI_COPY.history.heading}
          </h2>
          <p className="history-panel__hint">{UI_COPY.history.hint}</p>
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled}
          onClick={onClearHistory}
        >
          {UI_COPY.history.clearButton}
        </button>
      </div>

      <ul className="history-list">
        {entries.map((entry) => {
          const isActive = entry.id === activeEntryId;
          const docTypeLabel = UI_COPY.results.documentTypes[entry.result.document.type];

          return (
            <li key={entry.id} className="history-list__item">
              <button
                type="button"
                disabled={disabled}
                aria-current={isActive ? 'true' : undefined}
                className={`history-item-btn ${isActive ? 'history-item-btn--active' : ''}`}
                onClick={() => onSelectEntry(entry)}
              >
                <div className="history-item-btn__main">
                  <span className="history-item-btn__name">{entry.result.document.fileName}</span>
                  {isActive ? (
                    <span className="badge badge--active">{UI_COPY.history.activeBadge}</span>
                  ) : null}
                </div>
                <div className="history-item-btn__meta">
                  <span>{docTypeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{UI_COPY.history.pagesShort(entry.result.document.pages)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatTimestampPl(entry.analyzedAt)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
