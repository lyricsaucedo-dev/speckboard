import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardAd, Region } from '../lib/api';
import type { PixelShape } from '../lib/shapes';
import { PixelBoard } from './PixelBoard';

type Props = {
  open: boolean;
  ads: BoardAd[];
  gridWidth: number;
  gridHeight: number;
  selection: Region[];
  previewShape?: PixelShape;
  previewImageUrl?: string;
};

const PANEL_W = 220;
const PANEL_H = 132;
const LANDSCAPE_PANEL_W = 160;
const LANDSCAPE_PANEL_H = 104;
const HEADER_H = 60;
const MOBILE_SHEET_PEEK = 140;

/**
 * Small live Speckboard overview shown while the selection editor is
 * content-fullscreen. Draggable so it can be moved out of the way while painting.
 */
export function MiniBoardOverview({
  open,
  ads,
  gridWidth,
  gridHeight,
  selection,
  previewShape = 'square',
  previewImageUrl = '',
}: Props) {
  const [pos, setPos] = useState({ x: 16, y: HEADER_H + 72 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const layoutInsets = () => {
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
    const compactLandscape =
      mobile && typeof window !== 'undefined' && window.innerHeight < 500;
    const sidebar = mobile ? 0 : 360;
    const bottomPad = compactLandscape ? 8 : mobile ? MOBILE_SHEET_PEEK + 16 : 8;
    const panelW = compactLandscape ? LANDSCAPE_PANEL_W : PANEL_W;
    const panelH = compactLandscape ? LANDSCAPE_PANEL_H : PANEL_H;
    return { mobile, compactLandscape, sidebar, bottomPad, panelW, panelH };
  };

  useEffect(() => {
    if (!open) return;
    const placeForViewport = () => {
      const { compactLandscape, sidebar, bottomPad, panelW, panelH } = layoutInsets();
      const stageH = Math.max(200, window.innerHeight - HEADER_H);
      const maxX = Math.max(8, window.innerWidth - sidebar - panelW - 8);
      setPos({
        x: Math.min(16, maxX),
        y: compactLandscape
          ? HEADER_H + 64
          : HEADER_H + Math.max(16, stageH - panelH - bottomPad - 24),
      });
    };
    placeForViewport();
    window.addEventListener('resize', placeForViewport);
    return () => window.removeEventListener('resize', placeForViewport);
  }, [open]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const { sidebar, bottomPad, panelW, panelH } = layoutInsets();
    const maxX = Math.max(8, window.innerWidth - sidebar - panelW - 8);
    const maxY = Math.max(HEADER_H + 8, window.innerHeight - panelH - bottomPad);
    setPos({
      x: Math.max(8, Math.min(maxX, d.origX + dx)),
      y: Math.max(HEADER_H + 8, Math.min(maxY, d.origY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
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
  const { panelW } = layoutInsets();

  return (
    <div
      className="mini-board-overview"
      style={{ left: pos.x, top: pos.y, width: panelW }}
      role="complementary"
      aria-label="Board overview"
    >
      <header className="mini-board-overview-title" onPointerDown={startDrag}>
        <span>Board</span>
        <span className="mini-board-overview-hint">drag</span>
      </header>
      <div className="mini-board-overview-body">
        <PixelBoard
          ads={ads}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          selection={selection}
          interactMode="view"
          letterbox
          previewShape={previewShape}
          previewImageUrl={previewImageUrl}
        />
      </div>
    </div>
  );
}
