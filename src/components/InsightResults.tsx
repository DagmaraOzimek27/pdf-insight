import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { COPY_FEEDBACK_DURATION_MS } from '../lib/config';
import {
  buildJsonDownloadFileName,
  formatAmountValue,
  formatLanguageCode,
} from '../lib/formatters';
import type { PdfInsightResult } from '../lib/schema';
import { UI_COPY } from '../lib/uiCopy';

export interface InsightResultsProps {
  result: PdfInsightResult;
  omittedScanPages?: ReadonlyArray<number>;
}

type ResultTab = 'structured' | 'json';

export function InsightResults({ result, omittedScanPages = [] }: InsightResultsProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('structured');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const structuredTabId = useId();
  const jsonTabId = useId();
  const structuredPanelId = useId();
  const jsonPanelId = useId();
  const structuredTabRef = useRef<HTMLButtonElement>(null);
  const jsonTabRef = useRef<HTMLButtonElement>(null);

  const formattedJson = useMemo(() => JSON.stringify(result, null, 2), [result]);
  const typeLabel = UI_COPY.results.documentTypes[result.document.type];

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopyStatus('copied');
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopyStatus('idle');
      }, COPY_FEEDBACK_DURATION_MS);
    } catch {
      setCopyStatus('error');
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([formattedJson], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = buildJsonDownloadFileName(result.document.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (activeTab === 'structured') {
        setActiveTab('json');
        jsonTabRef.current?.focus();
      } else {
        setActiveTab('structured');
        structuredTabRef.current?.focus();
      }
    }
  };

  return (
    <section className="results-shell" aria-label={UI_COPY.results.sectionLabel}>
      <div className="results-toolbar">
        <div className="results-toolbar__identity">
          <span className="badge badge--crimson">{typeLabel}</span>
          <h2 className="results-toolbar__title">
            {result.document.title ?? result.document.fileName}
          </h2>
        </div>

        <div className="results-toolbar__controls">
          <div
            className="tab-list"
            role="tablist"
            aria-label={UI_COPY.results.sectionLabel}
            onKeyDown={handleTabKeyDown}
          >
            <button
              ref={structuredTabRef}
              id={structuredTabId}
              type="button"
              role="tab"
              aria-selected={activeTab === 'structured'}
              aria-controls={structuredPanelId}
              tabIndex={activeTab === 'structured' ? 0 : -1}
              className={`tab-btn ${activeTab === 'structured' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('structured')}
            >
              {UI_COPY.results.tabStructured}
            </button>
            <button
              ref={jsonTabRef}
              id={jsonTabId}
              type="button"
              role="tab"
              aria-selected={activeTab === 'json'}
              aria-controls={jsonPanelId}
              tabIndex={activeTab === 'json' ? 0 : -1}
              className={`tab-btn ${activeTab === 'json' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('json')}
            >
              {UI_COPY.results.tabJson}
            </button>
          </div>

          <div className="results-toolbar__export">
            <button type="button" className="btn btn--secondary" onClick={handleCopyJson}>
              {copyStatus === 'copied'
                ? UI_COPY.results.copiedJsonButton
                : UI_COPY.results.copyJsonButton}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleDownloadJson}>
              {UI_COPY.results.downloadJsonButton}
            </button>
          </div>
        </div>
      </div>

      {copyStatus === 'error' ? (
        <p className="copy-error-note" role="alert">
          {UI_COPY.results.copyErrorHint}
        </p>
      ) : null}

      {omittedScanPages.length > 0 ? (
        <div className="scan-limit-warning" role="alert">
          <strong>{UI_COPY.results.scanLimitWarningTitle}</strong>{' '}
          <span>{UI_COPY.results.scanLimitWarningBody(omittedScanPages)}</span>
        </div>
      ) : null}

      {activeTab === 'structured' ? (
        <div
          id={structuredPanelId}
          role="tabpanel"
          aria-labelledby={structuredTabId}
          className="results-grid"
        >
          {/* 1. Podsumowanie */}
          <article className="result-card result-card--summary">
            <h3 className="result-card__heading">{UI_COPY.results.summary.heading}</h3>
            <p className="summary-text">{result.summary}</p>
          </article>

          {/* 2. Metadane dokumentu */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.metadata.heading}</h3>
            <dl className="meta-grid">
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.fileName}</dt>
                <dd className="meta-item__breakable">{result.document.fileName}</dd>
              </div>
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.type}</dt>
                <dd>{typeLabel}</dd>
              </div>
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.pages}</dt>
                <dd>{result.document.pages}</dd>
              </div>
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.language}</dt>
                <dd>{formatLanguageCode(result.document.language)}</dd>
              </div>
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.title}</dt>
                <dd>
                  {result.document.title ?? (
                    <span className="empty-inline">{UI_COPY.results.metadata.emptyValue}</span>
                  )}
                </dd>
              </div>
              <div className="meta-item">
                <dt>{UI_COPY.results.metadata.date}</dt>
                <dd>
                  {result.document.date ? (
                    <span className="iso-pill">{result.document.date}</span>
                  ) : (
                    <span className="empty-inline">{UI_COPY.results.metadata.emptyValue}</span>
                  )}
                </dd>
              </div>
            </dl>
          </article>

          {/* 3. Kluczowe punkty */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.keyPoints.heading}</h3>
            <ol className="key-points-list">
              {result.keyPoints.map((point, index) => (
                <li key={`${index}-${point.slice(0, 24)}`} className="key-points-list__item">
                  {point}
                </li>
              ))}
            </ol>
          </article>

          {/* 4. Organizacje i osoby */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.entities.heading}</h3>
            <div className="entities-columns">
              <div className="entities-block">
                <h4 className="entities-block__title">
                  {UI_COPY.results.entities.organizationsSubheading}
                </h4>
                {result.entities.organizations.length > 0 ? (
                  <ul className="entity-list">
                    {result.entities.organizations.map((org) => (
                      <li key={org} className="entity-list__item">
                        {org}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-block">{UI_COPY.results.entities.organizationsEmpty}</p>
                )}
              </div>

              <div className="entities-block">
                <h4 className="entities-block__title">
                  {UI_COPY.results.entities.peopleSubheading}
                </h4>
                {result.entities.people.length > 0 ? (
                  <ul className="entity-list">
                    {result.entities.people.map((person) => (
                      <li key={person} className="entity-list__item">
                        {person}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-block">{UI_COPY.results.entities.peopleEmpty}</p>
                )}
              </div>
            </div>
          </article>

          {/* 5. Kwoty i waluty */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.amounts.heading}</h3>
            {result.amounts.length > 0 ? (
              <div className="structured-rows" role="list">
                {result.amounts.map((item, index) => (
                  <div
                    key={`${item.currency}-${item.value}-${index}`}
                    className="structured-row structured-row--amount"
                    role="listitem"
                  >
                    <div className="structured-row__primary">
                      <span className="amount-number">{formatAmountValue(item.value)}</span>
                      <span className="currency-badge">{item.currency}</span>
                    </div>
                    <p className="structured-row__context">{item.context}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-block">{UI_COPY.results.amounts.empty}</p>
            )}
          </article>

          {/* 6. Daty i terminy */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.dates.heading}</h3>
            {result.dates.length > 0 ? (
              <div className="structured-rows" role="list">
                {result.dates.map((item, index) => (
                  <div
                    key={`${item.date}-${index}`}
                    className="structured-row structured-row--date"
                    role="listitem"
                  >
                    <div className="structured-row__primary">
                      <span className="iso-pill">{item.date}</span>
                    </div>
                    <p className="structured-row__context">{item.context}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-block">{UI_COPY.results.dates.empty}</p>
            )}
          </article>

          {/* 7. Słowa kluczowe */}
          <article className="result-card">
            <h3 className="result-card__heading">{UI_COPY.results.keywords.heading}</h3>
            {result.keywords.length > 0 ? (
              <ul className="keyword-chips">
                {result.keywords.map((keyword) => (
                  <li key={keyword} className="keyword-chip">
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-block">{UI_COPY.results.keywords.empty}</p>
            )}
          </article>
        </div>
      ) : (
        <div
          id={jsonPanelId}
          role="tabpanel"
          aria-labelledby={jsonTabId}
          className="result-card json-card"
        >
          <div className="json-card__header">
            <h3 className="result-card__heading">{UI_COPY.results.jsonPreview.heading}</h3>
          </div>
          <pre className="json-pre" tabIndex={0}>
            <code>{formattedJson}</code>
          </pre>
        </div>
      )}
    </section>
  );
}
