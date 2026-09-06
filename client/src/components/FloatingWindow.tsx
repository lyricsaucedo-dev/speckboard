import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MOBILE_BUY_MQ, useMediaQuery } from '../lib/useMediaQuery';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Initial top-left in viewport coords */
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  /**
   * Content-area fullscreen: fills the buy stage (below navbar, left of sidebar).
   * Not browser / F11 fullscreen.
   */
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Mobile: near-fullscreen panel (CSS class); skips free drag/resize. */
  mobilePanel?: boolean;
};

/**
 * Draggable + resizable floating window for the selection mini-editor.
 * Closing does not clear selection/art — parent keeps state.
 * On mobile (`mobilePanel`), presents as a near-fullscreen dismissible panel.
 */
export function FloatingWindow({
  open,
  title,
  onClose,
  children,
  initialX = 72,
  initialY = 88,
  initialWidth = 360,
  initialHeight = 420,
  minWidth = 260,
  minHeight = 280,
  fullscreen = false,
  onFullscreenChange,
  mobilePanel = false,
}: Props) {
  const isMobileLayout = useMediaQuery(MOBILE_BUY_MQ);
  const useMobileChrome = mobilePanel || isMobileLayout;
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ w: initialWidth, h: initialHeight });
  const dragRef = useRef<{
    kind: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPos({ x: initialX, y: initialY });
    setSize({ w: initialWidth, h: initialHeight });
  }, [open, initialX, initialY, initialWidth, initialHeight]);

  const locked = fullscreen || useMobileChrome;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || locked) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.kind === 'move') {
        const maxX = Math.max(0, window.innerWidth - 80);
        const maxY = Math.max(0, window.innerHeight - 48);
        setPos({
          x: Math.max(0, Math.min(maxX, d.origX + dx)),
          y: Math.max(0, Math.min(maxY, d.origY + dy)),
        });
      } else {
        setSize({
          w: Math.max(minWidth, d.origW + dx),
          h: Math.max(minHeight, d.origH + dy),
        });
      }
    },
    [minWidth, minHeight, locked]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const startDrag = (kind: 'move' | 'resize', e: React.PointerEvent) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: size.w,
      origH: size.h,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  if (!open) return null;

  const className = [
    'floating-window',
    fullscreen ? 'is-fullscreen' : '',
    useMobileChrome && !fullscreen ? 'is-mobile-panel' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={
        fullscreen || useMobileChrome
          ? undefined
          : {
              left: pos.x,
              top: pos.y,
              width: size.w,
              height: size.h,
            }
      }
      role="dialog"
      aria-label={title}
      aria-modal={fullscreen || useMobileChrome || undefined}
    >
      <header
        className="floating-window-title"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          startDrag('move', e);
        }}
      >
        <span>{title}</span>
        <div className="floating-window-actions">
          {onFullscreenChange && (
            <button
              type="button"
              className="icon-btn floating-fs-btn"
              onClick={() => onFullscreenChange(!fullscreen)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Maximize board area'}
              title={fullscreen ? 'Exit fullscreen' : 'Maximize board area'}
            >
              {fullscreen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
                  <path d="M5 3H3v2H1V1h4v2zm6 0V1h4v4h-2V3h-2zM5 13v2H1v-4h2v2h2zm6 0h2v-2h2v4h-4v-2z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
                  <path d="M1 5V1h4v2H3v2H1zm10-2V1h4v4h-2V3h-2zM1 11h2v2h2v2H1v-4zm12 2h-2v2h4v-4h-2v2z" />
                </svg>
              )}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close editor">
            ×
          </button>
        </div>
      </header>
      <div className="floating-window-body">{children}</div>
      {!fullscreen && !useMobileChrome && (
        <div
          className="floating-window-resize"
          onPointerDown={(e) => startDrag('resize', e)}
          aria-label="Resize"
          title="Drag to resize"
        />
      )}
    </div>
  );
}
