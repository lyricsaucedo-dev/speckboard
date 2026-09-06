/** Shared pixel-board display shapes — visual mask of an owned/selected region as ONE silhouette. */
export const PIXEL_SHAPES = ['square', 'circle', 'star', 'triangle', 'diamond', 'hexagon'] as const;
export type PixelShape = (typeof PIXEL_SHAPES)[number];

export function normalizeShape(value: unknown): PixelShape {
  const s = String(value || 'square');
  return (PIXEL_SHAPES as readonly string[]).includes(s) ? (s as PixelShape) : 'square';
}

/**
 * Build a canvas path for the display shape inside a region bounding box.
 * Call beginPath first. Pass the FULL region screen rect (ad/selection × scale) —
 * never call this once per cell with cell-sized w/h.
 */
export function pathPixelShape(
  ctx: CanvasRenderingContext2D,
  shape: PixelShape,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  switch (shape) {
    case 'circle':
      ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;
    case 'hexagon': {
      const pts = 6;
      for (let i = 0; i < pts; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + rx * Math.cos(a);
        const py = cy + ry * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      const spikes = 5;
      const outerX = rx;
      const outerY = ry;
      const innerX = rx * 0.4;
      const innerY = ry * 0.4;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (Math.PI * i) / spikes - Math.PI / 2;
        const ox = i % 2 === 0 ? outerX : innerX;
        const oy = i % 2 === 0 ? outerY : innerY;
        const px = cx + ox * Math.cos(a);
        const py = cy + oy * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'square':
    default:
      ctx.rect(x, y, w, h);
      break;
  }
}

/** Screen-space bounding box for a board region (full block — not one cell). */
export function regionScreenRect(
  region: { x: number; y: number; width: number; height: number },
  scale: number
) {
  return {
    x: region.x * scale,
    y: region.y * scale,
    w: region.width * scale,
    h: region.height * scale,
  };
}
