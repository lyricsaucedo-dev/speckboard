import type { BoardAd, Region } from './api';

export const PIXELATE_MIN_WIDTH = 4;
export const PIXELATE_MAX_WIDTH = 128;

export function regionsOverlap(a: Region, b: Region): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function regionConflictsWithSold(region: Region, sold: BoardAd[]): boolean {
  return sold.some((ad) => regionsOverlap(region, ad));
}

/** Nearest-neighbor downscale → PNG data URL. */
export function pixelateToDataUrl(
  source: CanvasImageSource,
  outWidth: number,
  outHeight: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, outWidth, outHeight);
  ctx.drawImage(source, 0, 0, outWidth, outHeight);
  return canvas.toDataURL('image/png');
}

export function derivedHeight(outWidth: number, srcW: number, srcH: number): number {
  if (srcW <= 0) return outWidth;
  return Math.max(1, Math.round((outWidth * srcH) / srcW));
}

/** Max output width that keeps height on the board and within PIXELATE_MAX_WIDTH. */
export function maxPixelateWidth(
  srcW: number,
  srcH: number,
  gridWidth: number,
  gridHeight: number
): number {
  let maxW = Math.min(PIXELATE_MAX_WIDTH, gridWidth);
  if (srcW > 0 && srcH > 0) {
    const byHeight = Math.floor((gridHeight * srcW) / srcH);
    maxW = Math.min(maxW, Math.max(PIXELATE_MIN_WIDTH, byHeight));
  }
  return Math.max(PIXELATE_MIN_WIDTH, maxW);
}

/**
 * Place a WxH block near (preferX, preferY), nudging outward if sold pixels overlap.
 * Returns null when no free spot exists for this size.
 */
export function findFreePlacement(
  width: number,
  height: number,
  gridWidth: number,
  gridHeight: number,
  sold: BoardAd[],
  preferX: number,
  preferY: number
): Region | null {
  if (width < 1 || height < 1 || width > gridWidth || height > gridHeight) {
    return null;
  }

  const clampXY = (x: number, y: number): Region => ({
    x: Math.max(0, Math.min(gridWidth - width, Math.round(x))),
    y: Math.max(0, Math.min(gridHeight - height, Math.round(y))),
    width,
    height,
  });

  const start = clampXY(preferX - Math.floor(width / 2), preferY - Math.floor(height / 2));
  if (!regionConflictsWithSold(start, sold)) return start;

  const maxSpan = Math.max(gridWidth, gridHeight);
  const seen = new Set<string>();
  seen.add(`${start.x},${start.y}`);

  for (let radius = 1; radius <= maxSpan; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const candidate = clampXY(start.x + dx, start.y + dy);
        const key = `${candidate.x},${candidate.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!regionConflictsWithSold(candidate, sold)) return candidate;
      }
    }
  }

  return null;
}
