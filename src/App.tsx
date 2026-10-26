import { useEffect, useRef, useState } from 'react';
import { ApiClientError, analyzeExtractedPdf } from './api/analyzeClient';
import { EmptyStateGuide } from './components/EmptyStateGuide';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { InsightResults } from './components/InsightResults';
import { PdfDropzone } from './components/PdfDropzone';
import { StatusBanner, type BannerState } from './components/StatusBanner';
import {
  clearHistory,
  loadHistory,
  loadHistorySavePreference,
  saveResultToHistory,
  setHistorySavePreference,
  type HistoryEntry,
} from './lib/historyStorage';
import { PdfExtractionError, extractPdfContent } from './lib/pdfExtractor';
import type { PdfInsightResult } from './lib/schema';
import { UI_COPY } from './lib/uiCopy';

export function App() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [saveHistoryEnabled, setSaveHistoryEnabled] = useState<boolean>(() =>
    loadHistorySavePreference(),
  );
  const [activeResult, setActiveResult] = useState<PdfInsightResult | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [omittedScanPages, setOmittedScanPages] = useState<number[]>([]);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [bannerState, setBannerState] = useState<BannerState>({ kind: 'idle' });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const isAnalyzing = bannerState.kind === 'loading';

  const handleToggleSaveHistory = (enabled: boolean) => {
    setSaveHistoryEnabled(enabled);
    setHistorySavePreference(enabled);
  };

  const runFileAnalysis = async (file: File) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Natychmiastowe wyczyszczenie poprzedniego wyniku zapobiega pomyleniu starej analizy z nową lub z błędem nowego pliku.
    setActiveResult(null);
    setActiveHistoryId(null);
    setOmittedScanPages([]);
    setLastSelectedFile(file);
    setBannerState({
      kind: 'loading',
      fileName: file.name,
      fileSize: file.size,
      stageMessage: UI_COPY.loadingState.validatingFile,
      scannedCount: 0,
      omittedScanPages: [],
    });

    try {
      const extracted = await extractPdfContent(file, (currentPage, totalPages) => {
        if (controller.signal.aborted) {
          return;
        }
        setBannerState((prev) =>
          prev.kind === 'loading'
            ? {
                ...prev,
                stageMessage: UI_COPY.loadingState.readingPages(currentPage, totalPages),
              }
            : prev,
        );
      });

      if (controller.signal.aborted) {
        return;
      }

      const renderedCount = extracted.renderedScanPageNumbers.length;
      const omittedPages = extracted.omittedScanPageNumbers;
      setBannerState({
        kind: 'loading',
        fileName: file.name,
        fileSize: file.size,
        stageMessage: UI_COPY.loadingState.analyzingDocument,
        scannedCount: renderedCount,
        omittedScanPages: omittedPages,
      });

      const insightResult = await analyzeExtractedPdf(extracted, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (controller.signal.aborted) {
            return;
          }

          let stageMessage: string = UI_COPY.loadingState.analyzingDocument;
          if (progress.stage === 'retrying') {
            stageMessage = UI_COPY.loadingState.retryingValidation;
          } else if (progress.stage === 'chunk') {
            stageMessage = UI_COPY.loadingState.analyzingChunk(progress.current, progress.total);
          } else if (progress.stage === 'merging') {
            stageMessage = UI_COPY.loadingState.mergingChunks;
          }

          setBannerState((prev) =>
            prev.kind === 'loading'
              ? {
                  ...prev,
                  stageMessage,
                }
              : prev,
          );
        },
      });

      if (controller.signal.aborted) {
        return;
      }

      if (saveHistoryEnabled) {
        const updatedHistory = saveResultToHistory(insightResult);
        setHistoryEntries(updatedHistory);
        setActiveHistoryId(updatedHistory[0]?.id ?? null);
      } else {
        setActiveHistoryId(null);
      }

      setOmittedScanPages(omittedPages);
      setActiveResult(insightResult);
      setBannerState({ kind: 'idle' });
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        setBannerState({ kind: 'idle' });
        return;
      }

      let errorMessage: string = UI_COPY.errorState.fallbackMessage;
      if (error instanceof PdfExtractionError || error instanceof ApiClientError) {
        errorMessage = error.message;
      } else if (error instanceof Error && error.message.trim().length > 0) {
        errorMessage = error.message;
      }

      setBannerState({
        kind: 'error',
        message: errorMessage,
        lastFile: file,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleCancelAnalysis = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBannerState({ kind: 'idle' });
  };

  const handleRetryLastFile = () => {
    if (lastSelectedFile && !isAnalyzing) {
      void runFileAnalysis(lastSelectedFile);
    }
  };

  const handleDismissError = () => {
    setBannerState({ kind: 'idle' });
  };

  const handleSelectHistoryEntry = (entry: HistoryEntry) => {
    if (isAnalyzing) {
      return;
    }
    setOmittedScanPages([]);
    setActiveResult(entry.result);
    setActiveHistoryId(entry.id);
    setBannerState({ kind: 'idle' });
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistoryEntries([]);
    setActiveHistoryId(null);
    setActiveResult(null);
    setOmittedScanPages([]);
  };

  return (
    <div className="app-layout">
      <Header />

      <main className="main-container">
        <PdfDropzone
          disabled={isAnalyzing}
          hasActiveResult={activeResult !== null}
          saveHistoryEnabled={saveHistoryEnabled}
          onToggleSaveHistory={handleToggleSaveHistory}
          onFileSelected={(file) => {
            void runFileAnalysis(file);
          }}
        />

        <StatusBanner
          state={bannerState}
          onRetry={handleRetryLastFile}
          onCancel={handleCancelAnalysis}
          onDismissError={handleDismissError}
        />

        {activeResult ? (
          <InsightResults
            key={`${activeHistoryId ?? activeResult.document.fileName}`}
            result={activeResult}
            omittedScanPages={omittedScanPages}
          />
        ) : bannerState.kind === 'idle' ? (
          <EmptyStateGuide />
        ) : null}

        <HistoryPanel
          entries={historyEntries}
          activeEntryId={activeHistoryId}
          disabled={isAnalyzing}
          onSelectEntry={handleSelectHistoryEntry}
          onClearHistory={handleClearHistory}
        />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>{UI_COPY.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
