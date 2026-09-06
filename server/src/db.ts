import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'speckboard.json');

export const GRID_WIDTH = 500;
export const GRID_HEIGHT = 200;
export const PIXEL_PRICE_CENTS = 25; // $0.25
export const TOTAL_PIXELS = GRID_WIDTH * GRID_HEIGHT;
/** Outbound links require ≥ $5 (≥ 20 pixels at $0.25). */
export const LINK_MIN_PIXELS = 20;
export const LINK_MIN_CENTS = LINK_MIN_PIXELS * PIXEL_PRICE_CENTS;

export type Region = { x: number; y: number; width: number; height: number };

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
};

export type AdRow = {
  id: string;
  user_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  link_url: string;
  image_url: string;
  /** Visual mask: square | circle | star | triangle | diamond | hexagon */
  shape: string;
  locked: number;
  stripe_session_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PendingCheckout = {
  id: string;
  user_id: string | null;
  regions_json: string;
  title: string;
  link_url: string;
  image_url: string;
  shape: string;
  locked: number;
  amount_cents: number;
  stripe_session_id: string | null;
  status: string;
  created_at: string;
};

/** Personal drafts — never reserve board cells until checkout. */
export type DraftRow = {
  id: string;
  user_id: string;
  title: string;
  regions_json: string;
  shape: string;
  image_data_url: string;
  status: 'draft';
  created_at: string;
  updated_at: string;
};

type Store = {
  users: UserRow[];
  ads: AdRow[];
  pending_checkouts: PendingCheckout[];
  drafts: DraftRow[];
};

function emptyStore(): Store {
  return { users: [], ads: [], pending_checkouts: [], drafts: [] };
}

function load(): Store {
  if (!fs.existsSync(dbPath)) {
    const s = emptyStore();
    save(s);
    return s;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Partial<Store>;
    return {
      users: raw.users ?? [],
      ads: raw.ads ?? [],
      pending_checkouts: raw.pending_checkouts ?? [],
      drafts: raw.drafts ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function save(store: Store) {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8');
}

export const db = {
  path: dbPath,
  read: load,
  write: save,
  update(mutator: (store: Store) => void) {
    const store = load();
    mutator(store);
    save(store);
    return store;
  },
};

export function regionPixelCount(r: Region): number {
  return r.width * r.height;
}

export function regionsOverlap(a: Region, b: Region): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function validateRegion(r: Region): string | null {
  if (
    !Number.isInteger(r.x) ||
    !Number.isInteger(r.y) ||
    !Number.isInteger(r.width) ||
    !Number.isInteger(r.height)
  ) {
    return 'Region coordinates must be integers';
  }
  if (r.width < 1 || r.height < 1) return 'Region must be at least 1×1';
  if (r.x < 0 || r.y < 0 || r.x + r.width > GRID_WIDTH || r.y + r.height > GRID_HEIGHT) {
    return 'Region is outside the board';
  }
  return null;
}

export function getActiveAds(): AdRow[] {
  return db.read().ads.filter((a) => a.status === 'active');
}

export function regionsConflictWithSold(regions: Region[]): boolean {
  const sold = getActiveAds();
  for (const region of regions) {
    for (const ad of sold) {
      if (regionsOverlap(region, ad)) return true;
    }
  }
  return false;
}

export function nowIso() {
  return new Date().toISOString();
}
