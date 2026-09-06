import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { pixelateToDataUrl } from '../lib/pixelate';
import { normalizeShape, type PixelShape } from '../lib/shapes';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const DEFAULT_COLOR = '#ff2d55';

type Props = {
  width: number;
  height: number;
  shape?: PixelShape | string;
  /** Current artwork as PNG data URL (1:1 with width×height). */
  imageDataUrl: string;
  onChange: (imageDataUrl: string) => void;
  /** CSS px per cell for display. */
  cellPx?: number;
  /** Cap for display size (floating window can pass a larger value). */
  maxDisplaySide?: number;
  /** When set, Image button opens this instead of a hidden file input. */
  onRequestImage?: () => void;
};

function blankDataUrl(w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.clearRect(0, 0, w, h);
  return c.toDataURL('image/png');
}

export function ensureBlankArt(w: number, h: number): string {
  return blankDataUrl(w, h);
}

/**
 * Mini Speckboard for the current selection: paint, fill, or drop an image.
 * Backing store is exactly width×height pixels (one board cell = one pixel).
 */
export function SelectionMiniEditor({
  width,
  height,
  shape = 'square',
  imageDataUrl,
  onChange,
  cellPx = 12,
  maxDisplaySide = 280,
  onRequestImage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(false);
  const lastPaintCellRef = useRef<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const skipReloadRef = useRef(false);
  const maskId = useId().replace(/:/g, '');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hexDraft, setHexDraft] = useState(DEFAULT_COLOR);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const displayShape = normalizeShape(shape);

  const emitFromCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    skipReloadRef.current = true;
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sizeChanged = canvas.width !== width || canvas.height !== height;
    if (sizeChanged) {
      canvas.width = width;
      canvas.height = height;
    }

    if (skipReloadRef.current && !sizeChanged) {
      skipReloadRef.current = false;
      return;
    }
    skipReloadRef.current = false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    if (!imageDataUrl) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1a1a1e' : '#121214';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const cctx = c.getContext('2d');
      if (!cctx) return;
      cctx.imageSmoothingEnabled = false;
      cctx.clearRect(0, 0, width, height);
      cctx.drawImage(img, 0, 0, width, height);
    };
    img.src = imageDataUrl;
  }, [width, height, imageDataUrl]);

  const toCell = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    return {
      x: Math.max(0, Math.min(width - 1, x)),
      y: Math.max(0, Math.min(height - 1, y)),
    };
  };

  const paintCell = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    let x0 = from.x;
    let y0 = from.y;
    const dx = Math.abs(to.x - x0);
    const sx = x0 < to.x ? 1 : -1;
    const dy = -Math.abs(to.y - y0);
    const sy = y0 < to.y ? 1 : -1;
    let error = dx + dy;

    while (true) {
      paintCell(x0, y0);
      if (x0 === to.x && y0 === to.y) break;
      const twiceError = 2 * error;
      if (twiceError >= dy) {
        error += dy;
        x0 += sx;
      }
      if (twiceError <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    paintRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const cell = toCell(e);
    paintCell(cell.x, cell.y);
    lastPaintCellRef.current = cell;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!paintRef.current) return;
    const cell = toCell(e);
    const previous = lastPaintCellRef.current;
    if (previous) paintLine(previous, cell);
    else paintCell(cell.x, cell.y);
    lastPaintCellRef.current = cell;
  };

  const onPointerUp = () => {
    if (!paintRef.current) return;
    paintRef.current = false;
    lastPaintCellRef.current = null;
    emitFromCanvas();
  };

  const fillAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    emitFromCanvas();
  };

  const clearArt = () => {
    skipReloadRef.current = false;
    onChange(blankDataUrl(width, height));
  };

  const loadFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Drop a PNG, JPEG, WebP, or GIF.');
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not read image'));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      skipReloadRef.current = false;
      onChange(pixelateToDataUrl(img, width, height));
    } catch (err) {
      setError((err as Error).message || 'Failed to load image');
    }
  };

  const setColorBoth = (v: string) => {
    setColor(v);
    setHexDraft(v);
  };

  const cssW = Math.max(width * cellPx, 48);
  const cssH = Math.max(height * cellPx, 48);
  const scale = Math.min(1, maxDisplaySide / Math.max(cssW, cssH));
  const dispW = Math.round(cssW * scale);
  const dispH = Math.round(cssH * scale);

  return (
    <div className="mini-editor">
      <div
        className={`mini-editor-stage${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void loadFile(file);
        }}
      >
        <div className="mini-editor-frame" style={{ width: dispW, height: dispH }}>
          <canvas
            ref={canvasRef}
            className="mini-editor-canvas"
            role="application"
            aria-label={`Paint ${width} by ${height} pixel selection`}
            width={width}
            height={height}
            style={{
              width: dispW,
              height: dispH,
              imageRendering: 'pixelated',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {displayShape !== 'square' && (
            <svg className="mini-editor-shape-overlay" width={dispW} height={dispH} aria-hidden>
              <defs>
                <mask id={maskId}>
                  {/* White = dim visible; black hole = show art inside shape */}
                  <rect width={dispW} height={dispH} fill="white" />
                  <ShapeMaskPath shape={displayShape} w={dispW} h={dispH} fill="black" />
                </mask>
              </defs>
              <rect
                width={dispW}
                height={dispH}
                fill="rgba(9,9,11,0.62)"
                mask={`url(#${maskId})`}
              />
              <g fill="none" stroke="rgba(255,45,85,0.9)" strokeWidth={1.5}>
                <ShapeMaskPath shape={displayShape} w={dispW} h={dispH} />
              </g>
            </svg>
          )}
        </div>
        <p className="mini-editor-size">
          {width}×{height} · paint · Image for upload
        </p>
      </div>

      <div className="mini-editor-tools">
        <label className="mini-color">
          <span>Color</span>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR}
            onChange={(e) => setColorBoth(e.target.value)}
            aria-label="Paint color"
          />
          <input
            type="text"
            className="mini-hex"
            value={hexDraft}
            onChange={(e) => {
              const v = e.target.value.trim();
              setHexDraft(v);
              if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v.toLowerCase());
            }}
            onBlur={() => {
              if (/^#[0-9a-fA-F]{6}$/.test(hexDraft)) setHexDraft(hexDraft.toLowerCase());
              else setHexDraft(color);
            }}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex color"
          />
        </label>
        <div className="mini-tool-row">
          <button type="button" className="btn ghost compact" onClick={fillAll}>
            Fill
          </button>
          <button type="button" className="btn ghost compact" onClick={clearArt}>
            Clear
          </button>
          <button
            type="button"
            className="btn ghost compact"
            onClick={() => {
              if (onRequestImage) onRequestImage();
              else fileRef.current?.click();
            }}
          >
            Image
          </button>
          {!onRequestImage && (
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadFile(file);
                e.target.value = '';
              }}
            />
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

function ShapeMaskPath({
  shape,
  w,
  h,
  fill,
}: {
  shape: PixelShape;
  w: number;
  h: number;
  fill?: string;
}) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;

  switch (shape) {
    case 'circle':
      return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />;
    case 'triangle':
      return <polygon points={`${cx},0 ${w},${h} 0,${h}`} fill={fill} />;
    case 'diamond':
      return <polygon points={`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`} fill={fill} />;
    case 'hexagon': {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} fill={fill} />;
    }
    case 'star': {
      const spikes = 5;
      const pts: string[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = (Math.PI * i) / spikes - Math.PI / 2;
        const ox = i % 2 === 0 ? rx : rx * 0.4;
        const oy = i % 2 === 0 ? ry : ry * 0.4;
        pts.push(`${cx + ox * Math.cos(a)},${cy + oy * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} fill={fill} />;
    }
    default:
      return <rect x={0} y={0} width={w} height={h} fill={fill} />;
  }
}
