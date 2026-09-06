import './env.js';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import Stripe from 'stripe';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  LINK_MIN_CENTS,
  LINK_MIN_PIXELS,
  PIXEL_PRICE_CENTS,
  TOTAL_PIXELS,
  db,
  getActiveAds,
  nowIso,
  regionPixelCount,
  regionsConflictWithSold,
  validateRegion,
  type DraftRow,
  type Region,
} from './db.js';
import { requireAuth } from './auth.js';
import { ensureDefaultSpeck } from './seed.js';

const ALLOWED_SHAPES = ['square', 'circle', 'star', 'triangle', 'diamond', 'hexagon'];

function normalizeShape(raw: unknown, fallback = 'square'): string {
  const s = String(raw ?? fallback).trim().toLowerCase();
  return ALLOWED_SHAPES.includes(s) ? s : fallback;
}

function draftPublic(d: DraftRow) {
  return {
    id: d.id,
    title: d.title,
    regions: JSON.parse(d.regions_json) as Region[],
    shape: d.shape || 'square',
    imageDataUrl: d.image_data_url,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe =
  stripeSecret && !stripeSecret.includes('...')
    ? new Stripe(stripeSecret)
    : null;

const demoCheckout = process.env.DEMO_CHECKOUT === 'true' || !stripe;

export const apiRouter = Router();

apiRouter.get('/config', (_req, res) => {
  res.json({
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    totalPixels: TOTAL_PIXELS,
    pixelPriceCents: PIXEL_PRICE_CENTS,
    linkMinPixels: LINK_MIN_PIXELS,
    linkMinCents: LINK_MIN_CENTS,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    demoCheckout,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  });
});

apiRouter.get('/board', (_req, res) => {
  const ads = getActiveAds().map((ad) => ({
    id: ad.id,
    x: ad.x,
    y: ad.y,
    width: ad.width,
    height: ad.height,
    title: ad.title,
    linkUrl: ad.link_url,
    imageUrl: ad.image_url,
    shape: ad.shape || 'square',
    locked: Boolean(ad.locked),
    userId: ad.user_id,
  }));

  const soldPixels = ads.reduce((sum, a) => sum + a.width * a.height, 0);
  res.json({
    ads,
    soldPixels,
    availablePixels: TOTAL_PIXELS - soldPixels,
    capacityCents: TOTAL_PIXELS * PIXEL_PRICE_CENTS,
  });
});

apiRouter.get('/my-ads', requireAuth, (req, res) => {
  const ads = db
    .read()
    .ads.filter((a) => a.user_id === req.session.userId && a.status === 'active')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  res.json({
    ads: ads.map((ad) => ({
      id: ad.id,
      x: ad.x,
      y: ad.y,
      width: ad.width,
      height: ad.height,
      title: ad.title,
      linkUrl: ad.link_url,
      imageUrl: ad.image_url,
      shape: ad.shape || 'square',
      locked: Boolean(ad.locked),
      amountCents: ad.amount_cents,
      createdAt: ad.created_at,
      updatedAt: ad.updated_at,
    })),
  });
});

apiRouter.patch('/ads/:id', requireAuth, (req, res) => {
  const store = db.read();
  const ad = store.ads.find((a) => a.id === req.params.id && a.status === 'active');
  if (!ad) {
    return res.status(404).json({ error: 'Ad not found' });
  }
  if (ad.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Not your ad' });
  }
  if (ad.locked) {
    return res.status(403).json({
      error:
        'This purchase was made as a guest and is locked forever. Sign in before buying to keep edit access.',
    });
  }

  const title = String(req.body.title ?? ad.title).trim();
  let linkUrl = String(req.body.linkUrl ?? ad.link_url).trim();
  const imageUrl = String(req.body.imageUrl ?? ad.image_url).trim();
  const shape = normalizeShape(req.body.shape ?? ad.shape ?? 'square');

  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'Title and image URL are required' });
  }

  const linkAllowed = ad.amount_cents >= LINK_MIN_CENTS;
  if (!linkAllowed) {
    if (linkUrl && linkUrl !== ad.link_url) {
      return res.status(400).json({
        error: 'Links unlock at $5 (20 pixels). This purchase is below that threshold.',
      });
    }
    linkUrl = '';
  } else {
    if (!linkUrl) {
      return res.status(400).json({ error: 'Destination link is required for purchases ≥ $5' });
    }
    try {
      new URL(linkUrl);
    } catch {
      return res.status(400).json({ error: 'Link must be a valid URL' });
    }
  }

  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'Image must be a valid URL' });
  }

  db.update((s) => {
    const target = s.ads.find((a) => a.id === ad.id);
    if (!target) return;
    target.title = title;
    target.link_url = linkUrl;
    target.image_url = imageUrl;
    target.shape = shape;
    target.updated_at = nowIso();
  });

  res.json({ ok: true });
});

function parseRegions(body: unknown): Region[] | null {
  if (!body || typeof body !== 'object') return null;
  const regions = (body as { regions?: unknown }).regions;
  if (!Array.isArray(regions) || regions.length === 0) return null;
  return regions.map((r) => ({
    x: Number((r as Region).x),
    y: Number((r as Region).y),
    width: Number((r as Region).width),
    height: Number((r as Region).height),
  }));
}

apiRouter.post('/checkout', async (req, res) => {
  const regions = parseRegions(req.body);
  if (!regions) {
    return res.status(400).json({ error: 'At least one region required' });
  }

  for (const r of regions) {
    const err = validateRegion(r);
    if (err) return res.status(400).json({ error: err });
  }

  if (regionsConflictWithSold(regions)) {
    return res.status(409).json({ error: 'Selection overlaps sold pixels' });
  }

  const title = String(req.body.title || '').trim();
  let linkUrl = String(req.body.linkUrl || '').trim();
  const imageUrl = String(req.body.imageUrl || '').trim();
  const acceptedTos = Boolean(req.body.acceptedTos);
  const shape = normalizeShape(req.body.shape || 'square');

  if (!title || !imageUrl) {
    return res.status(400).json({
      error: 'Title and image URL are required before payment',
    });
  }
  if (!acceptedTos) {
    return res.status(400).json({ error: 'You must accept the Terms of Service' });
  }

  const userId = req.session.userId || null;
  const locked = !userId;
  const pixels = regions.reduce((sum, r) => sum + regionPixelCount(r), 0);
  const amountCents = pixels * PIXEL_PRICE_CENTS;

  if (pixels < LINK_MIN_PIXELS) {
    linkUrl = '';
  } else {
    if (!linkUrl) {
      return res.status(400).json({
        error: 'Destination link is required for purchases of $5 or more (20+ pixels)',
      });
    }
    try {
      new URL(linkUrl);
    } catch {
      return res.status(400).json({ error: 'Link must be a valid URL' });
    }
  }

  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'Image must be a valid URL' });
  }

  const checkoutId = uuid();

  db.update((s) => {
    s.pending_checkouts.push({
      id: checkoutId,
      user_id: userId,
      regions_json: JSON.stringify(regions),
      title,
      link_url: linkUrl,
      image_url: imageUrl,
      shape,
      locked: locked ? 1 : 0,
      amount_cents: amountCents,
      stripe_session_id: null,
      status: 'pending',
      created_at: nowIso(),
    });
  });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (demoCheckout) {
    finalizeCheckout(checkoutId, `demo_${checkoutId}`);
    return res.json({
      demo: true,
      url: `${clientUrl}/success?session_id=demo_${checkoutId}&checkout=${checkoutId}`,
      locked,
      amountCents,
      pixels,
    });
  }

  try {
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Speckboard — ${pixels} pixel${pixels === 1 ? '' : 's'}`,
              description: `${regions.length} region(s) · ${title}${
                locked ? ' · Guest (locked after purchase)' : ' · Editable account purchase'
              }${!linkUrl ? ' · No outbound link (< $5)' : ''}`,
            },
          },
        },
      ],
      success_url: `${clientUrl}/success?session_id={CHECKOUT_SESSION_ID}&checkout=${checkoutId}`,
      cancel_url: `${clientUrl}/buy?canceled=1`,
      metadata: {
        checkoutId,
        locked: locked ? '1' : '0',
        pixels: String(pixels),
      },
    });

    db.update((s) => {
      const p = s.pending_checkouts.find((c) => c.id === checkoutId);
      if (p) p.stripe_session_id = session.id;
    });

    return res.json({
      demo: false,
      url: session.url,
      sessionId: session.id,
      locked,
      amountCents,
      pixels,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create Stripe Checkout session' });
  }
});

export function finalizeCheckout(checkoutId: string, stripeSessionId: string) {
  const store = db.read();
  const pending = store.pending_checkouts.find((c) => c.id === checkoutId);
  if (!pending || pending.status !== 'pending') return false;

  const regions = JSON.parse(pending.regions_json) as Region[];
  if (regionsConflictWithSold(regions)) {
    db.update((s) => {
      const p = s.pending_checkouts.find((c) => c.id === checkoutId);
      if (p) p.status = 'conflict';
    });
    return false;
  }

  const totalPixels = regions.reduce((s, r) => s + r.width * r.height, 0);
  const stamp = nowIso();

  db.update((s) => {
    for (const r of regions) {
      s.ads.push({
        id: uuid(),
        user_id: pending.user_id,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        title: pending.title,
        link_url: pending.link_url,
        image_url: pending.image_url,
        shape: pending.shape || 'square',
        locked: pending.locked,
        stripe_session_id: stripeSessionId,
        amount_cents: Math.round(
          (pending.amount_cents * (r.width * r.height)) / totalPixels
        ),
        status: 'active',
        created_at: stamp,
        updated_at: stamp,
      });
    }
    const p = s.pending_checkouts.find((c) => c.id === checkoutId);
    if (p) {
      p.status = 'completed';
      p.stripe_session_id = stripeSessionId;
    }
  });

  return true;
}

apiRouter.get('/checkout/:id/status', (req, res) => {
  const row = db.read().pending_checkouts.find((c) => c.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: row.id,
    status: row.status,
    locked: Boolean(row.locked),
    amountCents: row.amount_cents,
    hadAccount: Boolean(row.user_id),
  });
});

apiRouter.post('/demo/seed', (_req, res) => {
  const result = ensureDefaultSpeck();
  res.json({ ok: true, ...result });
});

apiRouter.get('/drafts', requireAuth, (req, res) => {
  const drafts = db
    .read()
    .drafts.filter((d) => d.user_id === req.session.userId && d.status === 'draft')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  res.json({ drafts: drafts.map(draftPublic) });
});

apiRouter.get('/drafts/:id', requireAuth, (req, res) => {
  const draft = db
    .read()
    .drafts.find(
      (d) => d.id === req.params.id && d.user_id === req.session.userId && d.status === 'draft'
    );
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json({ draft: draftPublic(draft) });
});

apiRouter.post('/drafts', requireAuth, (req, res) => {
  const regions = parseRegions(req.body);
  if (!regions) {
    return res.status(400).json({ error: 'At least one region required' });
  }
  for (const r of regions) {
    const err = validateRegion(r);
    if (err) return res.status(400).json({ error: err });
  }

  const title = String(req.body.title || '').trim() || 'Untitled draft';
  const imageDataUrl = String(req.body.imageDataUrl || req.body.imageUrl || '').trim();
  const shape = normalizeShape(req.body.shape || 'square');
  const existingId = String(req.body.id || '').trim();

  if (
    imageDataUrl &&
    !imageDataUrl.startsWith('data:image/') &&
    !imageDataUrl.startsWith('https://')
  ) {
    return res.status(400).json({ error: 'imageDataUrl must be a data URL or https image' });
  }
  if (imageDataUrl.length > 3_500_000) {
    return res.status(400).json({ error: 'Draft image is too large' });
  }

  const stamp = nowIso();
  const userId = req.session.userId!;

  if (existingId) {
    const existing = db.read().drafts.find((d) => d.id === existingId && d.user_id === userId);
    if (!existing) return res.status(404).json({ error: 'Draft not found' });
    db.update((s) => {
      const d = s.drafts.find((x) => x.id === existingId);
      if (!d) return;
      d.title = title;
      d.regions_json = JSON.stringify(regions);
      d.shape = shape;
      d.image_data_url = imageDataUrl;
      d.status = 'draft';
      d.updated_at = stamp;
    });
    const updated = db.read().drafts.find((d) => d.id === existingId)!;
    return res.json({ draft: draftPublic(updated) });
  }

  const id = uuid();
  const row: DraftRow = {
    id,
    user_id: userId,
    title,
    regions_json: JSON.stringify(regions),
    shape,
    image_data_url: imageDataUrl,
    status: 'draft',
    created_at: stamp,
    updated_at: stamp,
  };
  db.update((s) => {
    // Cap drafts per user (soft saves only)
    const mine = s.drafts.filter((d) => d.user_id === userId);
    if (mine.length >= 20) {
      const oldest = [...mine].sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0];
      s.drafts = s.drafts.filter((d) => d.id !== oldest.id);
    }
    s.drafts.push(row);
  });
  res.status(201).json({ draft: draftPublic(row) });
});

apiRouter.delete('/drafts/:id', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const found = db.read().drafts.find((d) => d.id === req.params.id && d.user_id === userId);
  if (!found) return res.status(404).json({ error: 'Draft not found' });
  db.update((s) => {
    s.drafts = s.drafts.filter((d) => !(d.id === req.params.id && d.user_id === userId));
  });
  res.json({ ok: true });
});

export { stripe, demoCheckout };
