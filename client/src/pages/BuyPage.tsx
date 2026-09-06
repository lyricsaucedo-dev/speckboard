import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckoutModal } from '../components/CheckoutModal';
import { FloatingWindow } from '../components/FloatingWindow';
import { ImageToPixelsModal } from '../components/ImageToPixelsModal';
import { MiniBoardOverview } from '../components/MiniBoardOverview';
import { PixelBoard } from '../components/PixelBoard';
import {
  SelectionMiniEditor,
  ensureBlankArt,
} from '../components/SelectionMiniEditor';
import {
  LINK_MIN_PIXELS,
  api,
  formatUsd,
  regionPixels,
  type BoardAd,
  type Region,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { PIXEL_SHAPES, normalizeShape, type PixelShape } from '../lib/shapes';
import { MOBILE_BUY_MQ, useMediaQuery } from '../lib/useMediaQuery';

/** Zoom = integer screen pixels per board cell (1 cell = 1 purchasable pixel). */
const ZOOM_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];

function nearestZoomStep(target: number) {
  let best = ZOOM_STEPS[0];
  let bestDist = Math.abs(target - best);
  for (const s of ZOOM_STEPS) {
    const d = Math.abs(target - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export function BuyPage() {
  const { user, config } = useAuth();
  const isMobile = useMediaQuery(MOBILE_BUY_MQ);
  const [params, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState<BoardAd[]>([]);
  const [selection, setSelection] = useState<Region[]>([]);
  const [displayShape, setDisplayShape] = useState<PixelShape>('square');
  const [artUrl, setArtUrl] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMsg, setDraftMsg] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [zoom, setZoom] = useState(4);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  /** Mobile bottom sheet: peek (compact bar) vs expanded (full sidebar content). */
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const draftLoadedRef = useRef<string | null>(null);
  /** Pinch baseline: zoom at gesture start; ratio maps to discrete ZOOM_STEPS. */
  const pinchBaseZoomRef = useRef<number | null>(null);
  /** Cursor/center anchor applied in useLayoutEffect after zoom changes the canvas size. */
  const zoomAnchorRef = useRef<{
    contentX: number;
    contentY: number;
    viewX: number;
    viewY: number;
    ratio: number;
  } | null>(null);
  zoomRef.current = zoom;

  const loadBoard = useCallback(async () => {
    try {
      const board = await api.board();
      setAds(board.ads);
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    loadBoard();
    const t = setInterval(loadBoard, 15000);
    return () => clearInterval(t);
  }, [loadBoard]);

  // Load draft from ?draft=id (signed-in)
  useEffect(() => {
    const id = params.get('draft');
    if (!id || !user) return;
    if (draftLoadedRef.current === id) return;
    draftLoadedRef.current = id;
    (async () => {
      try {
        const { draft } = await api.getDraft(id);
        setSelection(draft.regions);
        setArtUrl(draft.imageDataUrl);
        setDisplayShape(normalizeShape(draft.shape));
        setDraftId(draft.id);
        setDraftTitle(draft.title || '');
        setDraftMsg('Draft loaded.');
        setEditorOpen(true);
      } catch (err) {
        setDraftMsg((err as Error).message);
        draftLoadedRef.current = null;
      }
    })();
  }, [params, user]);

  const primary = selection[0] ?? null;
  const pixels = useMemo(() => regionPixels(selection), [selection]);
  const priceCents = pixels * (config?.pixelPriceCents ?? 25);
  const linksUnlocked = pixels >= LINK_MIN_PIXELS;
  const gw = config?.gridWidth ?? 500;
  const gh = config?.gridHeight ?? 200;
  const pricePerPx = (config?.pixelPriceCents ?? 25) / 100;

  // Peek sheet summary when a selection appears; stay collapsed while editor paints
  useEffect(() => {
    if (isMobile && primary && !editorOpen) setSheetExpanded(true);
  }, [isMobile, primary, editorOpen]);

  const setZoomAnchored = useCallback((next: number, anchor?: { viewX: number; viewY: number }) => {
    const el = viewportRef.current;
    const oldZoom = zoomRef.current;
    if (next === oldZoom) return;
    if (el) {
      const rect = el.getBoundingClientRect();
      const viewX = anchor?.viewX ?? rect.width / 2;
      const viewY = anchor?.viewY ?? rect.height / 2;
      zoomAnchorRef.current = {
        contentX: el.scrollLeft + viewX,
        contentY: el.scrollTop + viewY,
        viewX,
        viewY,
        ratio: next / oldZoom,
      };
    }
    setZoom(next);
  }, []);

  const handlePinchZoom = useCallback(
    (scaleRatio: number, centerClientX: number, centerClientY: number) => {
      if (pinchBaseZoomRef.current == null) {
        pinchBaseZoomRef.current = zoomRef.current;
      }
      const target = pinchBaseZoomRef.current * scaleRatio;
      const next = nearestZoomStep(target);
      const el = viewportRef.current;
      if (!el) {
        setZoomAnchored(next);
        return;
      }
      const rect = el.getBoundingClientRect();
      setZoomAnchored(next, {
        viewX: centerClientX - rect.left,
        viewY: centerClientY - rect.top,
      });
    },
    [setZoomAnchored]
  );

  // Reset pinch baseline when fingers lift (no active touch on viewport)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const clearPinch = () => {
      pinchBaseZoomRef.current = null;
    };
    el.addEventListener('pointerup', clearPinch);
    el.addEventListener('pointercancel', clearPinch);
    return () => {
      el.removeEventListener('pointerup', clearPinch);
      el.removeEventListener('pointercancel', clearPinch);
    };
  }, []);

  // Apply scroll after React commits + browser lays out the resized canvas
  useLayoutEffect(() => {
    const el = viewportRef.current;
    const a = zoomAnchorRef.current;
    if (!el || !a) return;
    el.scrollLeft = a.contentX * a.ratio - a.viewX;
    el.scrollTop = a.contentY * a.ratio - a.viewY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  // Lock page scroll while on Buy (iOS rubber-band / address-bar jumps)
  useEffect(() => {
    document.documentElement.classList.add('buy-lock');
    document.body.classList.add('buy-lock');
    return () => {
      document.documentElement.classList.remove('buy-lock');
      document.body.classList.remove('buy-lock');
    };
  }, []);

  // Fit board width once when entering mobile buy (don’t fight later user zoom)
  const mobileFitDoneRef = useRef(false);
  useEffect(() => {
    if (!isMobile) {
      mobileFitDoneRef.current = false;
      return;
    }
    if (mobileFitDoneRef.current) return;
    const el = viewportRef.current;
    if (!el || el.clientWidth < 40) return;
    const usable = Math.max(240, el.clientWidth - 8);
    const fit = Math.max(1, Math.floor(usable / gw));
    setZoom(nearestZoomStep(Math.min(Math.max(fit, 1), 3)));
    mobileFitDoneRef.current = true;
  }, [isMobile, gw, ads.length]);

  // Fallback if fit hasn’t run yet
  useEffect(() => {
    if (isMobile && !mobileFitDoneRef.current && zoomRef.current === 4) {
      setZoom(2);
    }
  }, [isMobile]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpads often emit horizontal deltas — ignore those for zoom
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

      const oldZoom = zoomRef.current;
      const idx = ZOOM_STEPS.indexOf(oldZoom);
      const i = idx >= 0 ? idx : ZOOM_STEPS.findIndex((s) => s >= oldZoom);
      const base = i < 0 ? 2 : i;
      const dir = e.deltaY > 0 ? -1 : 1;
      const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, base + dir))];
      if (next === oldZoom) return;

      const rect = el.getBoundingClientRect();
      setZoomAnchored(next, {
        viewX: e.clientX - rect.left,
        viewY: e.clientY - rect.top,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoomAnchored]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const blockContext = (e: Event) => e.preventDefault();
    const blockMiddleDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const blockAux = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    el.addEventListener('contextmenu', blockContext);
    el.addEventListener('mousedown', blockMiddleDown);
    el.addEventListener('auxclick', blockAux);
    return () => {
      el.removeEventListener('contextmenu', blockContext);
      el.removeEventListener('mousedown', blockMiddleDown);
      el.removeEventListener('auxclick', blockAux);
    };
  }, []);

  const bumpZoom = (dir: number) => {
    const oldZoom = zoomRef.current;
    const idx = ZOOM_STEPS.indexOf(oldZoom);
    const i = idx >= 0 ? idx : 2;
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))];
    setZoomAnchored(next);
  };

  const handleSelectionChange = useCallback((regions: Region[]) => {
    const next = regions.slice(0, 1);
    setSelection(next);
    const r = next[0];
    if (!r) {
      setArtUrl('');
      setEditorOpen(false);
      setEditorFullscreen(false);
      setImageModalOpen(false);
      return;
    }
    setArtUrl(ensureBlankArt(r.width, r.height));
    setDraftMsg('');
    setEditorOpen(true);
    // Keep sheet collapsed while editing so the board/editor get the screen
    setSheetExpanded(false);
  }, []);

  const clearAll = () => {
    setSelection([]);
    setArtUrl('');
    setDraftId(null);
    setDraftTitle('');
    setDraftMsg('');
    setEditorOpen(false);
    setEditorFullscreen(false);
    setImageModalOpen(false);
    draftLoadedRef.current = null;
    if (params.get('draft')) {
      const next = new URLSearchParams(params);
      next.delete('draft');
      setSearchParams(next, { replace: true });
    }
  };

  const saveDraft = async () => {
    if (!user || !primary || !artUrl) return;
    setDraftBusy(true);
    setDraftMsg('');
    try {
      const res = await api.saveDraft({
        id: draftId || undefined,
        title: draftTitle.trim() || undefined,
        regions: selection,
        shape: displayShape,
        imageDataUrl: artUrl,
      });
      setDraftId(res.draft.id);
      setDraftTitle(res.draft.title);
      setDraftMsg('Draft saved.');
      const next = new URLSearchParams(params);
      next.set('draft', res.draft.id);
      setSearchParams(next, { replace: true });
      draftLoadedRef.current = res.draft.id;
    } catch (err) {
      setDraftMsg((err as Error).message);
    } finally {
      setDraftBusy(false);
    }
  };

  const canCheckout = pixels > 0 && Boolean(artUrl);

  const floatSize = useMemo(() => {
    if (!primary) return { w: 360, h: 420 };
    const cell = Math.max(8, Math.min(14, Math.floor(220 / Math.max(primary.width, primary.height))));
    const artW = Math.min(320, primary.width * cell + 48);
    const artH = Math.min(280, primary.height * cell + 48);
    return {
      w: Math.max(300, Math.min(420, artW + 40)),
      h: Math.max(360, Math.min(520, artH + 200)),
    };
  }, [primary]);

  return (
    <div className={`buy-layout${isMobile ? ' is-mobile' : ''}${sheetExpanded ? ' sheet-expanded' : ''}`}>
      <div className="buy-stage">
        {params.get('canceled') === '1' && (
          <p className="flash warn buy-toast">Checkout canceled — your selection is still here.</p>
        )}
        {loadError && (
          <p className="flash warn buy-toast">
            Could not load board ({loadError}). Is the API on port 3001?
          </p>
        )}

        <div className="buy-viewport mode-select" ref={viewportRef}>
          <PixelBoard
            ads={ads}
            gridWidth={gw}
            gridHeight={gh}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            appendSelect={false}
            interactMode="select"
            cellSize={zoom}
            previewShape={displayShape}
            previewImageUrl={artUrl}
            onHoverCell={setHoverCell}
            onPanDelta={(dx, dy) => {
              const el = viewportRef.current;
              if (!el) return;
              // Direct assignment (not += on read-modify in separate axes) keeps X/Y in sync
              el.scrollLeft = el.scrollLeft - dx;
              el.scrollTop = el.scrollTop - dy;
            }}
            onPinchZoom={handlePinchZoom}
            onAdClick={(ad) => window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')}
          />
        </div>

        <div className="buy-zoom-bar" aria-label="Zoom controls">
          <button type="button" onClick={() => bumpZoom(-1)} aria-label="Zoom out">
            −
          </button>
          <span title="Screen pixels per board cell">{zoom}px/cell</span>
          <button type="button" onClick={() => bumpZoom(1)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="btn ghost compact" onClick={() => setZoomAnchored(isMobile ? 2 : 4)}>
            Reset
          </button>
          {hoverCell && !isMobile && (
            <span className="zoom-hover-hint">
              ({hoverCell.x},{hoverCell.y}) · ${pricePerPx.toFixed(2)}/px
            </span>
          )}
        </div>

        {primary && (
          <FloatingWindow
            open={editorOpen}
            title={`Edit ${primary.width}×${primary.height}`}
            onClose={() => {
              setEditorOpen(false);
              setEditorFullscreen(false);
            }}
            initialX={isMobile ? 0 : 88}
            initialY={isMobile ? 0 : 100}
            initialWidth={floatSize.w}
            initialHeight={floatSize.h}
            fullscreen={editorFullscreen}
            onFullscreenChange={setEditorFullscreen}
            mobilePanel={isMobile}
          >
            <SelectionMiniEditor
              width={primary.width}
              height={primary.height}
              shape={displayShape}
              imageDataUrl={artUrl}
              onChange={setArtUrl}
              cellPx={Math.max(
                8,
                Math.min(
                  editorFullscreen || isMobile ? 24 : 16,
                  Math.floor(
                    (editorFullscreen || isMobile ? 640 : 260) /
                      Math.max(primary.width, primary.height)
                  )
                )
              )}
              maxDisplaySide={
                editorFullscreen || isMobile
                  ? Math.min(
                      720,
                      Math.max(
                        280,
                        (typeof window !== 'undefined' ? window.innerWidth : 900) -
                          (isMobile ? 32 : 420)
                      )
                    )
                  : Math.max(160, floatSize.w - 56)
              }
              onRequestImage={() => setImageModalOpen(true)}
            />
          </FloatingWindow>
        )}

        {primary && editorOpen && (
          <MiniBoardOverview
            open={editorFullscreen}
            ads={ads}
            gridWidth={gw}
            gridHeight={gh}
            selection={selection}
            previewShape={displayShape}
            previewImageUrl={artUrl}
          />
        )}
      </div>

      <aside
        className={`buy-sidebar${isMobile ? ' buy-sheet' : ''}${sheetExpanded ? ' is-expanded' : ''}`}
      >
        {isMobile && (
          <button
            type="button"
            className="buy-sheet-handle"
            aria-expanded={sheetExpanded}
            aria-label={sheetExpanded ? 'Collapse details' : 'Expand details'}
            onClick={() => setSheetExpanded((v) => !v)}
          >
            <span className="buy-sheet-grip" aria-hidden />
            <span className="buy-sheet-summary">
              {primary ? (
                <>
                  <strong>
                    {primary.width}×{primary.height}
                  </strong>
                  <span>
                    {pixels.toLocaleString()} px · {formatUsd(priceCents)}
                  </span>
                </>
              ) : (
                <span>Drag to select · Pinch zoom · 2-finger pan</span>
              )}
            </span>
            <span className="buy-sheet-chevron" aria-hidden>
              {sheetExpanded ? '▾' : '▴'}
            </span>
          </button>
        )}

        <div className="buy-sidebar-body">
        <div className="sidebar-block">
          <h2>Your area</h2>
          {primary ? (
            <>
              <p className="selection-dims" aria-live="polite">
                <strong>
                  {primary.width} × {primary.height} px
                </strong>
                <span>
                  {pixels.toLocaleString()} pixels · {formatUsd(priceCents)}
                </span>
              </p>
              <div className="selection-actions">
                {!editorOpen && (
                  <button
                    type="button"
                    className="btn primary wide"
                    onClick={() => setEditorOpen(true)}
                  >
                    Edit area
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost wide"
                  onClick={() => setImageModalOpen(true)}
                >
                  Image → pixels
                </button>
                <button type="button" className="btn ghost compact wide" onClick={clearAll}>
                  Clear selection
                </button>
              </div>
            </>
          ) : (
            <div className="mini-editor-empty">
              <p>{isMobile ? 'Drag on the board to claim an area' : 'Drag on the board to claim an area'}</p>
              <span className="field-hint">
                {isMobile
                  ? '1 finger = select · 2 fingers = pan · Pinch = zoom'
                  : 'Scroll = zoom · Right/middle-drag = pan'}
              </span>
            </div>
          )}
        </div>

        {primary && (
          <div className="sidebar-block">
            <h2>Shape</h2>
            <p className="field-hint" style={{ margin: 0 }}>
              Masks the whole block as one silhouette.
            </p>
            <div className="shape-grid" role="group" aria-label="Display shape">
              {PIXEL_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`shape-btn ${displayShape === s ? 'active' : ''}`}
                  onClick={() => setDisplayShape(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-block">
          <h2>Live price</h2>
          <div className="live-price" aria-live="polite">
            <span>
              {pixels.toLocaleString()} px
              {primary ? ` · ${primary.width}×${primary.height}` : ''}
            </span>
            <strong className="price-big">{formatUsd(priceCents)}</strong>
            <span className="price-formula">
              {pixels} × $0.25 = {formatUsd(priceCents)}
            </span>
          </div>
          <p className={`link-lock-note${linksUnlocked ? ' unlocked' : ''}`}>
            {linksUnlocked
              ? 'Links unlocked — set a destination URL at checkout.'
              : 'Links unlock at $5 (20 pixels)'}
          </p>
          <button
            type="button"
            className="btn primary wide"
            disabled={!canCheckout}
            onClick={() => setCheckoutOpen(true)}
          >
            Checkout
          </button>
          {primary && (
            <p className="field-hint" style={{ margin: 0 }}>
              Paint in the floating editor, then checkout.
            </p>
          )}
        </div>

        <div className="sidebar-block">
          <h2>Draft</h2>
          {user ? (
            <>
              <label className="draft-title-field">
                Title (optional)
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="My pixel art"
                  maxLength={80}
                  disabled={!primary}
                />
              </label>
              <button
                type="button"
                className="btn ghost wide"
                disabled={!primary || !artUrl || draftBusy}
                onClick={() => void saveDraft()}
              >
                {draftBusy ? 'Saving…' : draftId ? 'Update draft' : 'Save draft'}
              </button>
              <p className="field-hint" style={{ margin: 0 }}>
                Drafts are personal — they do not reserve board cells.
              </p>
              {draftMsg && (
                <p className="flash ok" style={{ margin: 0 }}>
                  {draftMsg}
                </p>
              )}
            </>
          ) : (
            <div className="inline-banner">
              Sign in to save drafts. <Link to="/auth">Sign in</Link>
            </div>
          )}
        </div>

        <div className="sidebar-block">
          <h2>Account</h2>
          {user ? (
            <p className="lead" style={{ margin: 0 }}>
              Signed in as {user.displayName || user.email}. Manage drafts &amp; pixels on the{' '}
              <Link to="/dashboard">dashboard</Link>.
            </p>
          ) : (
            <div className="inline-banner">
              Guest checkout locks creative after buy.{' '}
              <Link to="/auth">Sign in</Link> to keep edit access.
            </div>
          )}
        </div>
        </div>

        {isMobile && (
          <div className="buy-sheet-dock">
            {primary && !editorOpen && (
              <button
                type="button"
                className="btn ghost wide"
                onClick={() => {
                  setEditorOpen(true);
                  setSheetExpanded(false);
                }}
              >
                Edit area
              </button>
            )}
            {primary && (
              <button
                type="button"
                className="btn ghost wide"
                onClick={() => setImageModalOpen(true)}
              >
                Image
              </button>
            )}
            <button
              type="button"
              className="btn primary wide"
              disabled={!canCheckout}
              onClick={() => setCheckoutOpen(true)}
            >
              Checkout{primary ? ` · ${formatUsd(priceCents)}` : ''}
            </button>
          </div>
        )}
      </aside>

      {primary && (
        <ImageToPixelsModal
          mode="apply"
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          targetWidth={primary.width}
          targetHeight={primary.height}
          priceCentsPerPx={config?.pixelPriceCents ?? 25}
          onApply={(url) => {
            setArtUrl(url);
            setImageModalOpen(false);
            setEditorOpen(true);
          }}
        />
      )}

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        regions={selection}
        pixels={pixels}
        priceCents={priceCents}
        shape={displayShape}
        onShapeChange={setDisplayShape}
        initialImageUrl={artUrl}
        onSubmit={async (data) => {
          const res = await api.checkout({
            regions: selection,
            ...data,
          });
          window.location.href = res.url;
        }}
      />
    </div>
  );
}
