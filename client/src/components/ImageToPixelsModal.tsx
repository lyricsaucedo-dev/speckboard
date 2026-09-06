import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatUsd } from '../lib/api';
import {
  PIXELATE_MIN_WIDTH,
  derivedHeight,
  maxPixelateWidth,
  pixelateToDataUrl,
} from '../lib/pixelate';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

type PlaceProps = {
  mode?: 'place';
  open: boolean;
  onClose: () => void;
  gridWidth: number;
  gridHeight: number;
  priceCentsPerPx: number;
  onPlace: (result: {
    width: number;
    height: number;
    imageDataUrl: string;
  }) => void;
};

type ApplyProps = {
  mode: 'apply';
  open: boolean;
  onClose: () => void;
  /** Selection size — final art matches these board cells. */
  targetWidth: number;
  targetHeight: number;
  priceCentsPerPx?: number;
  onApply: (imageDataUrl: string) => void;
};

type Props = PlaceProps | ApplyProps;

function isApply(p: Props): p is ApplyProps {
  return p.mode === 'apply';
}

/**
 * Image → pixels modal.
 * - place: choose resolution, place a new board region
 * - apply: pixelate into the current selection (fixed W×H) with a detail slider
 */
export function ImageToPixelsModal(props: Props) {
  const { open, onClose } = props;
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [outWidth, setOutWidth] = useState(32);
  const [previewUrl, setPreviewUrl] = useState('');

  const applyMode = isApply(props);
  const targetW = applyMode ? props.targetWidth : 0;
  const targetH = applyMode ? props.targetHeight : 0;
  const gridWidth = applyMode ? targetW : props.gridWidth;
  const gridHeight = applyMode ? targetH : props.gridHeight;
  const priceCentsPerPx = applyMode
    ? props.priceCentsPerPx ?? 25
    : props.priceCentsPerPx;

  const maxW = useMemo(() => {
    if (!source) return Math.min(128, gridWidth || 128);
    if (applyMode) {
      // Detail slider: intermediate width up to selection width
      return Math.max(PIXELATE_MIN_WIDTH, targetW);
    }
    return maxPixelateWidth(source.naturalWidth, source.naturalHeight, gridWidth, gridHeight);
  }, [source, gridWidth, gridHeight, applyMode, targetW]);

  const outHeight = useMemo(() => {
    if (!source) return outWidth;
    return derivedHeight(outWidth, source.naturalWidth, source.naturalHeight);
  }, [source, outWidth]);

  const pixels = applyMode ? targetW * targetH : outWidth * outHeight;
  const priceCents = pixels * priceCentsPerPx;

  const reset = useCallback(() => {
    setDragOver(false);
    setError('');
    setSource(null);
    setSourceLabel('');
    setOutWidth(32);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!source) {
      setPreviewUrl('');
      return;
    }
    const w = Math.min(Math.max(PIXELATE_MIN_WIDTH, outWidth), maxW);
    if (w !== outWidth) {
      setOutWidth(w);
      return;
    }
    try {
      const h = derivedHeight(w, source.naturalWidth, source.naturalHeight);
      if (applyMode && targetW > 0 && targetH > 0) {
        // Pixelate at slider resolution, then nearest-neighbor into selection size
        const mid = document.createElement('canvas');
        mid.width = w;
        mid.height = h;
        const mctx = mid.getContext('2d');
        if (!mctx) throw new Error('Canvas unavailable');
        mctx.imageSmoothingEnabled = false;
        mctx.drawImage(source, 0, 0, w, h);
        const out = document.createElement('canvas');
        out.width = targetW;
        out.height = targetH;
        const octx = out.getContext('2d');
        if (!octx) throw new Error('Canvas unavailable');
        octx.imageSmoothingEnabled = false;
        // Cover-fit into selection
        const scale = Math.max(targetW / w, targetH / h);
        const dw = w * scale;
        const dh = h * scale;
        const dx = (targetW - dw) / 2;
        const dy = (targetH - dh) / 2;
        octx.drawImage(mid, dx, dy, dw, dh);
        setPreviewUrl(out.toDataURL('image/png'));
      } else {
        setPreviewUrl(pixelateToDataUrl(source, w, h));
      }
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Failed to pixelate image');
      setPreviewUrl('');
    }
  }, [source, outWidth, maxW, applyMode, targetW, targetH]);

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    if (
      !ACCEPT.split(',').some((t) => file.type === t) &&
      !/\.(png|jpe?g|webp|gif)$/i.test(file.name)
    ) {
      setError('Please choose a PNG, JPG, WebP, or GIF.');
      return;
    }
    setError('');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setSource(img);
      setSourceLabel(file.name);
      if (applyMode) {
        setOutWidth(Math.min(targetW, Math.max(PIXELATE_MIN_WIDTH, Math.round(targetW * 0.75))));
      } else {
        const initial = Math.min(
          32,
          maxPixelateWidth(img.naturalWidth, img.naturalHeight, gridWidth, gridHeight)
        );
        setOutWidth(initial);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not load that image.');
    };
    img.src = url;
  };

  if (!open) return null;

  const previewW = applyMode ? targetW : outWidth;
  const previewH = applyMode ? targetH : outHeight;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="modal-card image-pixels-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h2 id={titleId}>{applyMode ? 'Image → selection' : 'Image → pixels'}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="lead" style={{ marginTop: '0.75rem' }}>
          {applyMode
            ? `Drop a logo or meme, tune pixelation, then apply into your ${targetW}×${targetH} selection.`
            : 'Turn a logo or meme into board pixels. Drag an image in, tune resolution, then place it.'}
        </p>

        {!source ? (
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              loadFile(e.dataTransfer.files?.[0]);
            }}
          >
            <p>
              <strong>Drop an image here</strong>
              <span>PNG, JPG, WebP, or GIF</span>
            </p>
            <button
              type="button"
              className="btn ghost compact"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Choose image file"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="pixelate-workspace">
            <div className="pixelate-preview-wrap">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Pixelated preview ${previewW} by ${previewH}`}
                  className="pixelate-preview"
                  style={{
                    aspectRatio: `${previewW} / ${previewH}`,
                    width: `min(100%, ${Math.max(previewW * 8, 120)}px)`,
                  }}
                />
              ) : (
                <p className="field-hint">Generating preview…</p>
              )}
            </div>

            <p className="field-hint" style={{ margin: 0 }}>
              Source: {sourceLabel || 'image'} · {source.naturalWidth}×{source.naturalHeight}
              {applyMode ? ` → ${targetW}×${targetH} selection` : ''}
            </p>

            <label className="pixelate-slider-label">
              {applyMode
                ? `Pixelation detail (${outWidth} px sample)`
                : `Output width (${outWidth} px)`}
              <input
                type="range"
                min={PIXELATE_MIN_WIDTH}
                max={maxW}
                step={1}
                value={Math.min(outWidth, maxW)}
                onChange={(e) => setOutWidth(Number(e.target.value))}
                aria-valuemin={PIXELATE_MIN_WIDTH}
                aria-valuemax={maxW}
                aria-valuenow={outWidth}
                aria-describedby="pixelate-stats"
              />
            </label>

            <div id="pixelate-stats" className="pixelate-stats" aria-live="polite">
              <span>
                {previewW}×{previewH} = {pixels.toLocaleString()} px
              </span>
              <strong>{formatUsd(priceCents)}</strong>
            </div>

            <div className="pixelate-actions">
              <button type="button" className="btn ghost compact" onClick={() => reset()}>
                Different image
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!previewUrl}
                onClick={() => {
                  if (!previewUrl) return;
                  if (applyMode) {
                    props.onApply(previewUrl);
                  } else {
                    props.onPlace({
                      width: outWidth,
                      height: outHeight,
                      imageDataUrl: previewUrl,
                    });
                  }
                }}
              >
                {applyMode ? 'Apply to selection' : 'Place on the board'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
