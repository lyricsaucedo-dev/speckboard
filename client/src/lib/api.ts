/** Outbound destination links require ≥ $5 (≥ 20 px at $0.25). */
export const LINK_MIN_PIXELS = 20;
export const LINK_MIN_CENTS = 500;

export type Region = { x: number; y: number; width: number; height: number };

export type BoardAd = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  linkUrl: string;
  imageUrl: string;
  shape?: string;
  locked: boolean;
  userId: string | null;
};

export type User = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AppConfig = {
  gridWidth: number;
  gridHeight: number;
  totalPixels: number;
  pixelPriceCents: number;
  stripePublishableKey: string;
  demoCheckout: boolean;
  clientUrl: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

export const api = {
  config: () => request<AppConfig>('/api/config'),
  board: () =>
    request<{
      ads: BoardAd[];
      soldPixels: number;
      availablePixels: number;
      capacityCents: number;
    }>('/api/board'),
  me: () => request<{ user: User | null }>('/api/auth/me'),
  register: (body: { email: string; password: string; displayName?: string }) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  checkout: (body: {
    regions: Region[];
    title: string;
    linkUrl: string;
    imageUrl: string;
    shape: string;
    acceptedTos: boolean;
  }) =>
    request<{
      demo: boolean;
      url: string;
      locked: boolean;
      amountCents: number;
      pixels: number;
    }>('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
  confirmCheckout: (checkoutId: string, sessionId: string) =>
    request<{ ok: boolean }>('/api/checkout/confirm', {
      method: 'POST',
      body: JSON.stringify({ checkoutId, sessionId }),
    }),
  checkoutStatus: (id: string) =>
    request<{
      id: string;
      status: string;
      locked: boolean;
      amountCents: number;
      hadAccount: boolean;
    }>(`/api/checkout/${id}/status`),
  myAds: () =>
    request<{
      ads: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        title: string;
        linkUrl: string;
        imageUrl: string;
        shape: string;
        locked: boolean;
        amountCents: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/api/my-ads'),
  updateAd: (
    id: string,
    body: { title: string; linkUrl: string; imageUrl: string; shape: string }
  ) =>
    request<{ ok: boolean }>(`/api/ads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  seedDemo: () => request<{ ok: boolean }>('/api/demo/seed', { method: 'POST' }),
  listDrafts: () =>
    request<{
      drafts: Array<{
        id: string;
        title: string;
        regions: Region[];
        shape: string;
        imageDataUrl: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/api/drafts'),
  /** @deprecated use listDrafts */
  drafts: () =>
    request<{
      drafts: Array<{
        id: string;
        title: string;
        regions: Region[];
        shape: string;
        imageDataUrl: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/api/drafts'),
  getDraft: (id: string) =>
    request<{
      draft: {
        id: string;
        title: string;
        regions: Region[];
        shape: string;
        imageDataUrl: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/api/drafts/${id}`),
  saveDraft: (body: {
    id?: string;
    regions: Region[];
    title?: string;
    imageDataUrl: string;
    shape: string;
  }) =>
    request<{
      draft: {
        id: string;
        title: string;
        regions: Region[];
        shape: string;
        imageDataUrl: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      };
    }>('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteDraft: (id: string) =>
    request<{ ok: boolean }>(`/api/drafts/${id}`, { method: 'DELETE' }),
};

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function regionPixels(regions: Region[]): number {
  return regions.reduce((sum, r) => sum + r.width * r.height, 0);
}
