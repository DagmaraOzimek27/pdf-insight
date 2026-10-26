import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { UI_COPY } from '../lib/uiCopy';

export interface PdfDropzoneProps {
  disabled: boolean;
  hasActiveResult: boolean;
  onFileSelected: (file: File) => void;
}

export function PdfDropzone({ disabled, hasActiveResult, onFileSelected }: PdfDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  const constraintsId = useId();
  const privacyId = useId();
  const dropzoneIconSrc = `${import.meta.env.BASE_URL}dropzone-icon.svg`;

  const openFilePicker = () => {
    if (disabled) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && !disabled) {
      onFileSelected(file);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      event.dataTransfer.dropEffect = 'copy';
      if (!isDragActive) {
        setIsDragActive(true);
      }
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);

    if (disabled) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      onFileSelected(droppedFile);
    }
  };

  const dropzoneClasses = [
    'dropzone',
    isDragActive ? 'dropzone--active' : '',
    disabled ? 'dropzone--disabled' : '',
    hasActiveResult ? 'dropzone--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="upload-section" aria-label={UI_COPY.dropzone.selectButton}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={`${constraintsId} ${privacyId}`}
        className={dropzoneClasses}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="visually-hidden"
          tabIndex={-1}
          disabled={disabled}
          onChange={handleInputChange}
        />

        <img
          src={dropzoneIconSrc}
          alt={UI_COPY.dropzone.iconAlt}
          aria-hidden="true"
          width={72}
          height={72}
          className="dropzone__icon"
        />

        <div className="dropzone__content">
          <p className="dropzone__title">
            {isDragActive ? UI_COPY.dropzone.dragActiveTitle : UI_COPY.dropzone.idleTitle}
          </p>
          <p id={constraintsId} className="dropzone__hint">
            {UI_COPY.dropzone.constraintsHint}
          </p>
          <p className="dropzone__kbd-hint">{UI_COPY.dropzone.keyboardHint}</p>
        </div>

        <span className="btn btn--primary dropzone__cta" aria-hidden="true">
          {hasActiveResult ? UI_COPY.dropzone.selectAnotherButton : UI_COPY.dropzone.selectButton}
        </span>
      </div>

      <div id={privacyId} className="privacy-notice">
        <strong className="privacy-notice__label">{UI_COPY.dropzone.privacyLabel}</strong>{' '}
        <span>{UI_COPY.dropzone.privacyNotice}</span>
      </div>
    </section>
  );
}
