import { syncServerTime } from './clock.js';
import type { QueuedItem } from './queue.js';

/**
 * The API client.
 *
 * Everything the terminal knows about the server. Two properties matter: it
 * never invents a deadline (the server's absolute timestamps are passed through
 * untouched), and it distinguishes a transient failure from a permanent
 * rejection, because the offline queue has to treat those differently.
 */

const TOKEN_KEY = 'ninety.terminal.session.v1';

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly locale: string;
  readonly rtl: boolean;
  readonly marketCode: string;
  readonly currency: string;
  readonly currencyExponent: number;
  /** This yard's commission rate — their contract, so they are shown it. */
  readonly commissionRate: number;
  readonly timezone: string;
  readonly displayName: string | null;
}

export interface MarketSummary {
  readonly code: string;
  readonly name: string;
  readonly localeDefault: string;
  readonly locales: readonly string[];
  readonly rtl: boolean;
  readonly currency: string;
  readonly currencyMinorUnitExponent: number;
  readonly timezone: string;
}

/**
 * The live markets, before there is a session to read one from.
 *
 * Unauthenticated on purpose: the sign-in screen needs to know what market this
 * terminal is in and what locale to render in, and it has no token yet.
 */
export async function fetchMarkets(): Promise<MarketSummary[]> {
  const body = await apiFetch<{ markets: MarketSummary[] }>('/v1/markets', { method: 'GET' });
  return body.markets;
}

export interface MeResponse {
  readonly id: string;
  readonly role: string;
  readonly locale: string;
  readonly terms?: { readonly commissionRate?: number };
  readonly market: {
    readonly code: string;
    readonly currency: string;
    readonly currencyMinorUnitExponent: number;
    readonly rtl: boolean;
    readonly timezone: string;
  };
}

/** Everything the terminal needs that is market configuration, not a constant. */
export async function fetchMe(token: string, locale: string): Promise<MeResponse> {
  return apiFetch<MeResponse>('/v1/auth/me', { token, locale });
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw === null ? null : (JSON.parse(raw) as Session);
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked; the session lasts this tab only */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do */
  }
}

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** A rejection no retry will fix: the window closed, this yard already quoted. */
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT';
  readonly body?: unknown;
  readonly token?: string | null;
  readonly locale?: string;
  readonly signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  // So a validation error comes back in the operator's language even before
  // they are authenticated.
  if (options.locale) headers['accept-language'] = options.locale;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);

  if (!response.ok) {
    const error = (payload.error ?? {}) as { code?: string; message?: string; messageKey?: string; details?: unknown };
    throw new ApiError(
      response.status,
      error.code ?? 'unknown',
      error.messageKey ?? 'errors.generic',
      error.message ?? `request failed with ${response.status}`,
      error.details,
    );
  }
  return payload as T;
}

/** Media upload goes as multipart, because the image is not JSON. */
export async function uploadPhoto(offerId: string, token: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append('file', blob, 'part.jpg');
  const response = await fetch(`${API_BASE}/v1/supplier/offers/${offerId}/media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new ApiError(response.status, 'upload_failed', 'errors.generic', 'photo upload failed');
}

export interface LiveRequest {
  readonly requestId: string;
  readonly reference: string;
  readonly vehicle: { make: string; model: string; year: number; variant: string | null } | null;
  readonly part: { description: string; categoryCode: string | null; name: string };
  readonly distanceKm: number | null;
  readonly responseDeadline: string | null;
  readonly sentAt: string;
  readonly seen: boolean;
  readonly tier: number;
  readonly alreadyOffered: boolean;
  readonly media: readonly { url: string; kind: string }[];
}

export async function fetchLiveRequests(token: string, locale: string): Promise<LiveRequest[]> {
  const body = await apiFetch<{ serverTime: string; requests: LiveRequest[] }>('/v1/supplier/requests', {
    token,
    locale,
  });
  // Every poll re-syncs the clock, so a tablet with a wrong time still renders
  // an honest countdown.
  syncServerTime(body.serverTime);
  return body.requests;
}

export interface Performance {
  readonly score: number;
  readonly rank: number | null;
  readonly cityTotal: number;
  readonly responseRate30d: number | null;
  readonly medianResponseSeconds: number | null;
  readonly jobsWon: number;
  readonly earnedCents: number;
  readonly currency: string;
}

export async function fetchPerformance(token: string, locale: string): Promise<Performance> {
  return apiFetch<Performance>('/v1/supplier/performance', { token, locale });
}

export interface WonOrder {
  readonly orderId: string;
  readonly reference: string;
  readonly partDescription: string;
  readonly priceCents: number;
  readonly payoutCents: number;
  readonly status: string;
  readonly deliveryStatus: string | null;
  readonly driverExpectedAt: string | null;
}

export async function fetchOrders(token: string, locale: string): Promise<{ currency: string; packagingRule: string; orders: WonOrder[] }> {
  return apiFetch('/v1/supplier/orders', { token, locale });
}

export interface StockProfile {
  makes: string[];
  models: string[];
  yearFrom: number | null;
  yearTo: number | null;
  partCategories: string[];
  maxRadiusKm: number;
}

export async function fetchStockProfile(
  token: string,
  locale: string,
): Promise<{ profile: StockProfile; options: { makes: string[]; categories: { code: string; name: string }[] } }> {
  return apiFetch('/v1/supplier/stock-profile', { token, locale });
}

export async function saveStockProfile(token: string, locale: string, profile: StockProfile): Promise<void> {
  await apiFetch('/v1/supplier/stock-profile', { method: 'PUT', token, locale, body: profile });
}

/** Send one queued item. Used by the outbox flusher. */
export async function sendQueued(
  item: QueuedItem,
  token: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; permanent: boolean; error: string }> {
  try {
    const result = await apiFetch<{ offerId?: string }>(item.path, {
      method: item.method,
      token,
      locale,
      body: { ...item.body, composedAt: item.composedAt },
    });
    // Photos follow the offer, because they need its id.
    if (item.kind === 'offer' && result?.offerId !== undefined) {
      for (const photo of item.photos) await uploadPhoto(result.offerId, token, photo);
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, permanent: err.permanent, error: err.messageKey };
    return { ok: false, permanent: false, error: 'errors.network' };
  }
}

/**
 * The realtime channel.
 *
 * A yard must be alerted the instant a relevant request appears. On reconnect
 * the client re-fetches rather than assuming it is current: a terminal that was
 * offline for ninety seconds has missed a job and needs the list, not a replayed
 * event.
 */
export function openStream(
  token: string,
  handlers: { onEvent: (event: Record<string, unknown>) => void; onOpen: () => void; onClose: () => void },
): { close: () => void } {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const connect = () => {
    if (closed) return;
    const url = new URL(API_BASE.replace(/^http/, 'ws') + '/v1/supplier/stream');
    url.searchParams.set('token', token);
    socket = new WebSocket(url.toString());

    socket.onopen = () => {
      attempt = 0;
      handlers.onOpen();
      heartbeat = setInterval(() => socket?.send(JSON.stringify({ type: 'ping' })), 25_000);
    };
    socket.onmessage = (event) => {
      try {
        handlers.onEvent(JSON.parse(String(event.data)) as Record<string, unknown>);
      } catch {
        /* a malformed frame is not worth dropping the connection over */
      }
    };
    socket.onclose = () => {
      if (heartbeat !== null) clearInterval(heartbeat);
      handlers.onClose();
      if (closed) return;
      // Exponential backoff with a ceiling: a yard's connection comes back, and
      // hammering the server while a whole city reconnects makes it worse.
      attempt += 1;
      const delay = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
      setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  };

  connect();
  return {
    close: () => {
      closed = true;
      if (heartbeat !== null) clearInterval(heartbeat);
      socket?.close();
    },
  };
}
