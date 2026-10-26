import { formatFileSize } from '../lib/formatters';
import { UI_COPY } from '../lib/uiCopy';

export type BannerState =
  | { kind: 'idle' }
  | {
      kind: 'loading';
      fileName: string;
      fileSize: number;
      stageMessage: string;
      scannedCount: number;
      omittedScanPages: ReadonlyArray<number>;
    }
  | {
      kind: 'error';
      message: string;
      lastFile: File | null;
    };

export interface StatusBannerProps {
  state: BannerState;
  onRetry: () => void;
  onCancel: () => void;
  onDismissError: () => void;
}

export function StatusBanner({ state, onRetry, onCancel, onDismissError }: StatusBannerProps) {
  if (state.kind === 'idle') {
    return null;
  }

  if (state.kind === 'loading') {
    return (
      <div className="status-card status-card--loading" role="status" aria-live="polite">
        <div className="status-card__header">
          <div className="status-card__title-group">
            <span className="spinner" aria-hidden="true" />
            <div>
              <h2 className="status-card__title">{UI_COPY.loadingState.title}</h2>
              <p className="status-card__file">
                <span className="status-card__filename">{state.fileName}</span>{' '}
                <span className="status-card__filesize">({formatFileSize(state.fileSize)})</span>
              </p>
            </div>
          </div>

          <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel}>
            {UI_COPY.loadingState.cancelButton}
          </button>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-track__bar" />
        </div>

        <p className="status-card__stage">{state.stageMessage}</p>

        {state.scannedCount > 0 && state.omittedScanPages.length === 0 ? (
          <p className="status-card__scan-note">
            {UI_COPY.loadingState.scansDetectedHint(state.scannedCount)}
          </p>
        ) : null}

        {state.omittedScanPages.length > 0 ? (
          <p className="status-card__scan-warning">
            {UI_COPY.loadingState.scansOmittedWarning(state.scannedCount, state.omittedScanPages)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="status-card status-card--error" role="alert">
      <div className="status-card__body">
        <h2 className="status-card__title">{UI_COPY.errorState.title}</h2>
        <p className="status-card__error-msg">{state.message}</p>

        {state.lastFile ? (
          <p className="status-card__file">
            <span>{UI_COPY.errorState.lastFileLabel}</span>{' '}
            <strong className="status-card__filename">{state.lastFile.name}</strong>{' '}
            <span className="status-card__filesize">({formatFileSize(state.lastFile.size)})</span>
          </p>
        ) : null}
      </div>

      <div className="status-card__actions">
        {state.lastFile ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {UI_COPY.errorState.retryButton}
          </button>
        ) : null}
        <button type="button" className="btn btn--secondary" onClick={onDismissError}>
          {UI_COPY.errorState.dismissButton}
        </button>
      </div>
    </div>
  );
}
