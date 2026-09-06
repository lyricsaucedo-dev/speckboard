import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardAd, Region } from '../lib/api';
import {
  normalizeShape,
  pathPixelShape,
  regionScreenRect,
  type PixelShape,
} from '../lib/shapes';

/** Board interaction: pan = navigate only; select = mass-select rectangles of cells. */
export type InteractMode = 'pan' | 'select' | 'view';

type Props = {
  ads: BoardAd[];
  gridWidth: number;
  gridHeight: number;
  selection?: Region[];
  onSelectionChange?: (regions: Region[]) => void;
  /** Append regions instead of replacing (mass select multi-region). */
  appendSelect?: boolean;
  /** pan | select | view (landing). */
  interactMode?: InteractMode;
  /**
   * Screen pixels per board cell (integer). Each cell = exactly 1 purchasable pixel.
   * Required for accurate 1:1 mapping on the buy page.
   */
  cellSize?: number;
  /**
   * Landing display: letterbox the true grid aspect inside the parent (no stretch).
   * Prefer over deprecated `cover` stretch mode.
   */
  letterbox?: boolean;
  /** @deprecated Prefer letterbox — stretch-fills parent and distorts cells. */
  cover?: boolean;
  /** Preview shape for current selection highlight (whole-region mask). */
  previewShape?: PixelShape;
  /** Live art preview for the primary selection region (data URL or https). */
  previewImageUrl?: string;
  onAdClick?: (ad: BoardAd) => void;
  onHoverCell?: (cell: { x: number; y: number } | null) => void;
  /** Called while panning (right/middle drag, or left in pan mode). dx/dy in screen px. */
  onPanDelta?: (dx: number, dy: number) => void;
  /**
   * Pinch zoom (touch). scaleRatio is currentDistance / startDistance for this gesture;
   * center is in viewport/client coords for zoom anchoring.
   */
  onPinchZoom?: (scaleRatio: number, centerClientX: number, centerClientY: number) => void;
};

const ACCENT = '#ff2d55';
/** Opaque enough that grid lines don't make the silhouette look like per-cell shapes. */
const ACCENT_FILL = 'rgba(255,45,85,0.55)';
const PAPER_DARK = '#09090b';
const PAPER_MID = '#121214';
const DANGER = '#ff453a';
const DANGER_FILL = 'rgba(255,69,58,0.5)';
const GRID_LINE = 'rgba(250,250,250,0.1)';
const GRID_MAJOR = 'rgba(250,250,250,0.2)';

function rectsOverlap(a: Region, b: Region) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number): Region {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const width = Math.abs(x1 - x0) + 1;
  const height = Math.abs(y1 - y0) + 1;
  return { x, y, width, height };
}

function clampRegion(r: Region, gw: number, gh: number): Region | null {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const width = Math.min(r.width, gw - x);
  const height = Math.min(r.height, gh - y);
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

function regionHitsSold(region: Region, ads: BoardAd[]) {
  return ads.some((ad) =>
    rectsOverlap(region, { x: ad.x, y: ad.y, width: ad.width, height: ad.height })
  );
}

function findAdAt(x: number, y: number, ads: BoardAd[]) {
  return ads.find(
    (ad) => x >= ad.x && x < ad.x + ad.width && y >= ad.y && y < ad.y + ad.height
  );
}

function hasOutboundLink(ad: BoardAd) {
  const url = (ad.linkUrl || '').trim();
  if (!url || url === 'https://' || url === '#') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Clip/mask the entire ad block to one display shape (full width×height bbox).
 * Never iterate cells — one path for the purchased region.
 */
function drawShapedAd(
  ctx: CanvasRenderingContext2D,
  ad: BoardAd,
  scale: number,
  img: HTMLImageElement | undefined
) {
  const { x: rx, y: ry, w: rw, h: rh } = regionScreenRect(ad, scale);
  const shape = normalizeShape(ad.shape);

  ctx.save();
  ctx.beginPath();
  pathPixelShape(ctx, shape, rx, ry, rw, rh);
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, rx, ry, rw, rh);
  } else {
    ctx.fillStyle = '#5a564e';
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();

  ctx.beginPath();
  pathPixelShape(ctx, shape, rx + 0.5, ry + 0.5, Math.max(0, rw - 1), Math.max(0, rh - 1));
  ctx.strokeStyle = hasOutboundLink(ad) ? 'rgba(255,45,85,0.9)' : 'rgba(245,245,247,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Selection preview: one silhouette for the whole region bbox (not per-cell mini-shapes).
 * Optional art is clipped to the same whole-region shape mask.
 */
function drawShapedRegion(
  ctx: CanvasRenderingContext2D,
  r: Region,
  scale: number,
  shape: PixelShape,
  fill: string,
  stroke: string,
  img?: HTMLImageElement
) {
  const { x: rx, y: ry, w: rw, h: rh } = regionScreenRect(r, scale);

  // Faint rectangular bounds so buyers still see the purchased cell block
  if (shape !== 'square') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,45,85,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(0, rw - 1), Math.max(0, rh - 1));
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  pathPixelShape(ctx, shape, rx, ry, rw, rh);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, rx, ry, rw, rh);
    // Light accent wash so selection still reads as "yours"
    ctx.fillStyle = 'rgba(255,45,85,0.18)';
    ctx.fillRect(rx, ry, rw, rh);
  } else {
    ctx.fillStyle = fill;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();

  ctx.beginPath();
  pathPixelShape(ctx, shape, rx + 0.5, ry + 0.5, Math.max(0, rw - 1), Math.max(0, rh - 1));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function PixelBoard({
  ads,
  gridWidth,
  gridHeight,
  selection = [],
  onSelectionChange,
  appendSelect = false,
  interactMode = 'select',
  cellSize,
  letterbox = false,
  cover = false,
  previewShape = 'square',
  previewImageUrl = '',
  onAdClick,
  onHoverCell,
  onPanDelta,
  onPinchZoom,
}: Props) {
  /*
   * Touch / pointer interaction model (buy board):
   * - 1 finger (or left mouse): mass-select a rectangle of cells
   * - 2 fingers: pan via centroid movement (onPanDelta); pinch distance → onPinchZoom
   * - Right / middle mouse drag: pan (desktop)
   * Parent also maps wheel → zoom. Avoid setState on pan frames for responsiveness.
   */
  const fitContain = letterbox || cover;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(2);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    kind: 'select' | 'pan' | 'click' | 'pinch';
    startX: number;
    startY: number;
    draft: Region | null;
    moved: boolean;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  /** Active pointers for multi-touch pan/pinch (id → client coords). */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    startDist: number;
    lastCx: number;
    lastCy: number;
  } | null>(null);
  const [draft, setDraft] = useState<Region | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  /** Integer screen px per cell — each cell is exactly one purchasable pixel. */
  const scale = Math.max(1, Math.round(cellSize ?? autoScale));

  useEffect(() => {
    for (const ad of ads) {
      if (imageCache.current.has(ad.imageUrl)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = ad.imageUrl;
      imageCache.current.set(ad.imageUrl, img);
      img.onload = () => setAutoScale((s) => s);
    }
  }, [ads]);

  useEffect(() => {
    if (!previewImageUrl) {
      previewImgRef.current = null;
      setPreviewTick((n) => n + 1);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      previewImgRef.current = img;
      setPreviewTick((n) => n + 1);
    };
    img.onerror = () => {
      if (cancelled) return;
      previewImgRef.current = null;
      setPreviewTick((n) => n + 1);
    };
    img.src = previewImageUrl;
    return () => {
      cancelled = true;
    };
  }, [previewImageUrl]);

  useEffect(() => {
    if (cellSize != null) return;
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      if (fitContain) {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        // Contain: largest integer cell size that fits without stretching aspect
        const sx = w / gridWidth;
        const sy = h / gridHeight;
        setAutoScale(Math.max(1, Math.floor(Math.min(sx, sy)) || 1));
        return;
      }
      const pad = 24;
      const w = Math.max(320, el.clientWidth - pad);
      setAutoScale(Math.max(1, Math.floor(w / gridWidth) || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridWidth, gridHeight, cellSize, fitContain]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing store = exact integer pixels: gridW * scale by gridH * scale
    const w = gridWidth * scale;
    const h = gridHeight * scale;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.imageSmoothingEnabled = false;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, PAPER_MID);
    grad.addColorStop(0.5, PAPER_DARK);
    grad.addColorStop(1, '#353230');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Checker hint via pattern (avoid 100k fillRect calls per frame)
    if (scale >= 2) {
      const pat = document.createElement('canvas');
      pat.width = scale * 2;
      pat.height = scale * 2;
      const pctx = pat.getContext('2d');
      if (pctx) {
        pctx.fillStyle = 'rgba(242,238,228,0.035)';
        pctx.fillRect(scale, 0, scale, scale);
        pctx.fillRect(0, scale, scale, scale);
        ctx.fillStyle = ctx.createPattern(pat, 'repeat') || 'transparent';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Crisp 1:1 cell boundaries
    // At scale >= 4: every cell. At 2–3: every cell faint. At 1: every 5th + majors.
    ctx.lineWidth = 1;
    if (scale >= 2) {
      ctx.strokeStyle = GRID_LINE;
      for (let x = 0; x <= gridWidth; x++) {
        const px = x * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let y = 0; y <= gridHeight; y++) {
        const py = y * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
      // Major every 10 cells for orientation
      ctx.strokeStyle = GRID_MAJOR;
      for (let x = 0; x <= gridWidth; x += 10) {
        const px = x * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let y = 0; y <= gridHeight; y += 10) {
        const py = y * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(242,238,228,0.12)';
      for (let x = 0; x <= gridWidth; x += 5) {
        const px = x * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let y = 0; y <= gridHeight; y += 5) {
        const py = y * scale + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    }

    for (const ad of ads) {
      drawShapedAd(ctx, ad, scale, imageCache.current.get(ad.imageUrl));
    }

    if (interactMode === 'select') {
      const previewImg = previewImgRef.current || undefined;
      selection.forEach((r, i) => {
        // Art preview only on primary (first) region — matches sidebar mini editor
        drawShapedRegion(
          ctx,
          r,
          scale,
          previewShape,
          ACCENT_FILL,
          ACCENT,
          i === 0 ? previewImg : undefined
        );
      });
      if (draft) {
        const bad = regionHitsSold(draft, ads);
        drawShapedRegion(
          ctx,
          draft,
          scale,
          previewShape,
          bad ? DANGER_FILL : 'rgba(255,45,85,0.62)',
          bad ? DANGER : ACCENT
        );
      }
      // No per-cell paint target on the main board — hover is coords only (sidebar tip).
    }
  }, [
    ads,
    draft,
    gridHeight,
    gridWidth,
    interactMode,
    previewImageUrl,
    previewShape,
    previewTick,
    scale,
    selection,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  const toCell = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Map through CSS size → backing store → cell index (1:1 with purchasable pixels)
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * gridWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * gridHeight);
    return {
      x: Math.max(0, Math.min(gridWidth - 1, x)),
      y: Math.max(0, Math.min(gridHeight - 1, y)),
    };
  };

  const openAdIfLinked = (cell: { x: number; y: number }) => {
    const ad = findAdAt(cell.x, cell.y, ads);
    if (!ad || !hasOutboundLink(ad)) return false;
    if (onAdClick) onAdClick(ad);
    else window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    return true;
  };

  const beginPinchFromPointers = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    pinchRef.current = { startDist: dist, lastCx: cx, lastCy: cy };
    // Cancel in-progress select when a second finger lands
    setDraft(null);
    dragRef.current = {
      kind: 'pinch',
      startX: 0,
      startY: 0,
      draft: null,
      moved: true,
      pointerX: cx,
      pointerY: cy,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const cell = toCell(e);

    if (interactMode === 'view') {
      if (e.button === 0) openAdIfLinked(cell);
      return;
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Second+ finger → pan/pinch (touch)
    if (pointersRef.current.size >= 2 && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
      e.preventDefault();
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      beginPinchFromPointers();
      return;
    }

    // Right-click or middle-click drag = pan (buy editor)
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: 'pan',
        startX: cell.x,
        startY: cell.y,
        draft: null,
        moved: false,
        pointerX: e.clientX,
        pointerY: e.clientY,
      };
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture may fail if pointer already released */
      }
      return;
    }

    if (e.button !== 0) return;

    // Left-click: pan mode still pans; select mode mass-selects
    if (interactMode === 'pan') {
      const hit = findAdAt(cell.x, cell.y, ads);
      dragRef.current = {
        kind: hit && hasOutboundLink(hit) ? 'click' : 'pan',
        startX: cell.x,
        startY: cell.y,
        draft: null,
        moved: false,
        pointerX: e.clientX,
        pointerY: e.clientY,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Mass select (left drag / one finger)
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const hit = findAdAt(cell.x, cell.y, ads);
    if (hit) {
      dragRef.current = {
        kind: 'click',
        startX: cell.x,
        startY: cell.y,
        draft: null,
        moved: false,
        pointerX: e.clientX,
        pointerY: e.clientY,
      };
      return;
    }

    dragRef.current = {
      kind: 'select',
      startX: cell.x,
      startY: cell.y,
      draft: { x: cell.x, y: cell.y, width: 1, height: 1 },
      moved: false,
      pointerX: e.clientX,
      pointerY: e.clientY,
    };
    setDraft({ x: cell.x, y: cell.y, width: 1, height: 1 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const drag = dragRef.current;
    const canvas = canvasRef.current;

    // Two-finger pan + pinch — no hover/draft React updates
    if (drag?.kind === 'pinch' && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const [a, b] = pts;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const pinch = pinchRef.current;
      if (pinch) {
        const dx = cx - pinch.lastCx;
        const dy = cy - pinch.lastCy;
        if (dx !== 0 || dy !== 0) onPanDelta?.(dx, dy);
        pinch.lastCx = cx;
        pinch.lastCy = cy;
        onPinchZoom?.(dist / pinch.startDist, cx, cy);
      }
      return;
    }

    // Pan: use client deltas only (movementX/Y is unreliable on Windows, esp. horizontal).
    // Skip hover state while panning to avoid re-render lag.
    if (drag?.kind === 'pan') {
      const dx = e.clientX - drag.pointerX;
      const dy = e.clientY - drag.pointerY;
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        drag.moved = true;
        drag.pointerX = e.clientX;
        drag.pointerY = e.clientY;
        onPanDelta?.(dx, dy);
      }
      if (canvas) canvas.style.cursor = 'grabbing';
      return;
    }

    const cell = toCell(e);
    // Skip hover React updates on touch — avoids re-renders during select drags
    if (e.pointerType !== 'touch') {
      setHover(cell);
      onHoverCell?.(cell);
    }

    if (canvas) {
      if (interactMode === 'view') {
        const ad = findAdAt(cell.x, cell.y, ads);
        canvas.style.cursor = ad && hasOutboundLink(ad) ? 'pointer' : 'default';
      } else if (interactMode === 'pan') {
        const ad = findAdAt(cell.x, cell.y, ads);
        canvas.style.cursor = ad && hasOutboundLink(ad) ? 'pointer' : 'grab';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }

    if (!drag) return;

    if (Math.abs(e.clientX - drag.pointerX) > 2 || Math.abs(e.clientY - drag.pointerY) > 2) {
      drag.moved = true;
    }

    if (drag.kind === 'click') return;

    // Selection draft (left-drag in select mode)
    const region = clampRegion(
      normalizeRect(drag.startX, drag.startY, cell.x, cell.y),
      gridWidth,
      gridHeight
    );
    setDraft(region);
    drag.draft = region;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);

    // Still two fingers after one lift — keep pinch; re-baseline distance
    if (pointersRef.current.size >= 2) {
      beginPinchFromPointers();
      return;
    }

    // Dropped to one finger mid-pinch: end gesture (don't finish as select)
    if (dragRef.current?.kind === 'pinch') {
      dragRef.current = null;
      pinchRef.current = null;
      setDraft(null);
      return;
    }

    pinchRef.current = null;

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === 'pan') {
      // Right / middle / left-pan gestures never open links on release
      return;
    }

    if (drag.kind === 'click') {
      setDraft(null);
      if (!drag.moved) openAdIfLinked({ x: drag.startX, y: drag.startY });
      return;
    }

    const region = drag.draft || draft;
    setDraft(null);
    if (!region || !onSelectionChange) return;
    if (regionHitsSold(region, ads)) return;
    onSelectionChange(appendSelect ? [...selection, region] : [region]);
  };

  const cssW = `${gridWidth * scale}px`;
  const cssH = `${gridHeight * scale}px`;

  return (
    <div
      className={`board-shell${fitContain ? ' board-letterbox' : ''}${cover && !letterbox ? ' board-cover' : ''}`}
      ref={wrapRef}
    >
      <div className="board-frame board-frame-bare">
        <canvas
          ref={canvasRef}
          className="pixel-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onAuxClick={(e) => {
            // Middle-click: prevent default browser behaviors
            if (e.button === 1) e.preventDefault();
          }}
          onPointerLeave={() => {
            setHover(null);
            onHoverCell?.(null);
          }}
          width={gridWidth * scale}
          height={gridHeight * scale}
          style={{
            width: cssW,
            height: cssH,
            imageRendering: 'pixelated',
            touchAction: 'none',
          }}
        />
      </div>
      {!fitContain && hover && (
        <div className="board-hover-tip" aria-live="polite">
          Cell ({hover.x}, {hover.y}) · <strong>1 px</strong> = $0.25
          {draft ? (
            <>
              {' '}
              · draft {draft.width}×{draft.height} ={' '}
              <strong>{draft.width * draft.height} px</strong>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
