/**
 * The ops console's API client.
 *
 * Admin-only, and every call that touches supplier identity is audited on the
 * server. This is the one surface where a yard's name is legitimately visible,
 * which is exactly why the access is recorded rather than assumed to be fine.
 */

const TOKEN_KEY = 'ninety.admin.session.v1';

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

export interface AdminSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly displayName: string | null;
}

export function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw === null ? null : (JSON.parse(raw) as AdminSession);
  } catch {
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const payload = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
  if (!res.ok) {
    const error = (payload.error ?? {}) as { message?: string };
    throw new ApiError(res.status, error.message ?? `request failed with ${res.status}`);
  }
  return payload as T;
}

export interface BoardRequest {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly outcome: string | null;
  readonly partDescription: string;
  readonly city: string | null;
  readonly buyerBusiness: string | null;
  readonly suppliersNotified: number;
  readonly offers: number;
  readonly createdAt: string;
  readonly secondsToDeadline: number | null;
  readonly atRisk: boolean;
}

export async function fetchBoard(
  token: string,
  filters: { marketCode?: string; status?: string; live?: boolean; atRisk?: boolean },
): Promise<{ requests: BoardRequest[]; serverTime: string }> {
  const query = new URLSearchParams();
  if (filters.marketCode) query.set('marketCode', filters.marketCode);
  if (filters.status) query.set('status', filters.status);
  if (filters.live) query.set('live', 'true');
  if (filters.atRisk) query.set('atRisk', 'true');
  return api(`/v1/admin/requests?${query.toString()}`, { token });
}

export interface MatchDecision {
  readonly supplierId: string;
  readonly businessName: string;
  readonly tier: number;
  readonly components: { stockProfileMatch: number; proximity: number; supplierScore: number; availability: number };
  readonly total: number;
  readonly threshold: number;
  readonly distanceKm: number;
  readonly selected: boolean;
  readonly reason: string;
}

export async function fetchMatchDecisions(token: string, requestId: string): Promise<{ decisions: MatchDecision[] }> {
  return api(`/v1/admin/requests/${requestId}/match-decisions`, { token });
}

export async function intervene(
  token: string,
  requestId: string,
  body: { action: string; reason: string; extendMinutes?: number; transitionName?: string },
): Promise<Record<string, unknown>> {
  return api(`/v1/admin/requests/${requestId}/intervene`, { method: 'POST', token, body });
}

export interface Metrics {
  readonly marketplace: {
    requests: number;
    requestsWithOffers: number;
    fillRate: number | null;
    offersPerRequest: number | null;
    medianSupplierResponseSeconds: number | null;
    filledWithinSlaRate: number | null;
    noSupplyCount: number;
    noOffersCount: number;
  };
  readonly speed: {
    requestToFirstOfferSeconds: number | null;
    requestToAcceptSeconds: number | null;
    acceptToCollectedSeconds: number | null;
    collectedToDeliveredSeconds: number | null;
    deliveredWithinSlaRate: number | null;
    deliveredWithinSlaPeak: number | null;
    deliveredWithinSlaOffPeak: number | null;
    deliveries: number;
  };
  readonly commercial: {
    gmvCents: number;
    revenueCents: number;
    realisedTakeRate: number | null;
    contributionPerOrderCents: number | null;
    courierCostCents: number;
    courierChargeCents: number;
    orders: number;
    repeatBuyerRate: number | null;
  };
  readonly supply: {
    activeSuppliers: number;
    respondingWeekly: number;
    respondingWeeklyRate: number | null;
    scoreDistribution: { band: string; count: number }[];
    pipeline: { stage: string; count: number }[];
    tablets: { deployed: number; activeLast7Days: number; lost: number; broken: number };
  };
}

export async function fetchMetrics(token: string, marketCode: string | undefined, days: number): Promise<Metrics> {
  const query = new URLSearchParams({ days: String(days) });
  if (marketCode) query.set('marketCode', marketCode);
  return api(`/v1/admin/metrics?${query.toString()}`, { token });
}

export interface SupplierRow {
  readonly id: string;
  readonly businessName: string;
  readonly city: string;
  readonly status: string;
  readonly onboardingStage: string;
  readonly daysAtStage: number;
  readonly score: number;
  readonly responseRate: number;
  readonly verified: boolean;
  readonly terminalOnline: boolean;
  readonly lastSeenAt: string | null;
  readonly tablet: { serial: string; status: string } | null;
}

export async function fetchSuppliers(
  token: string,
  stage?: string,
): Promise<{ pipeline: Record<string, number>; suppliers: SupplierRow[] }> {
  const query = new URLSearchParams();
  if (stage) query.set('stage', stage);
  return api(`/v1/admin/suppliers?${query.toString()}`, { token });
}

export interface UnfilledRow {
  readonly partDescription: string;
  readonly partCode: string | null;
  readonly vehicle: string | null;
  readonly misses: number;
  readonly lastSeen: string;
  readonly missKind: string;
}

export async function fetchUnfilled(token: string, days: number): Promise<{ unfilled: UnfilledRow[] }> {
  return api(`/v1/admin/demand/unfilled?days=${days}`, { token });
}

export interface MarketRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly localeDefault: string;
  readonly rtl: boolean;
  readonly timezone: string;
  readonly paymentProvider: string;
  readonly courierProviders: string[];
  readonly tax: { rate: number; label: string; inclusive: boolean };
  readonly sla: { responseMin: number; offersMin: number; deliveryMin: number };
  readonly fees: { commissionRate: number; buyerFeeRate: number; deliveryMarkupRate: number };
  readonly isLive: boolean;
}

export async function fetchMarkets(token: string): Promise<{ markets: MarketRow[]; editableFields: string[] }> {
  return api('/v1/admin/markets', { token });
}

export async function updateMarket(
  token: string,
  code: string,
  changes: Record<string, unknown>,
  reason: string,
): Promise<unknown> {
  return api(`/v1/admin/markets/${code}`, { method: 'PUT', token, body: { changes, reason } });
}

export async function fetchMarketAudit(
  token: string,
  code: string,
): Promise<{ audit: { field: string; from: string | null; to: string | null; reason: string | null; at: string }[] }> {
  return api(`/v1/admin/markets/${code}/audit`, { token });
}

export interface OpsItem {
  readonly id: string;
  readonly kind: string;
  readonly severity: string;
  readonly summary: string;
  readonly requestId: string | null;
  readonly orderId: string | null;
  readonly createdAt: string;
}

export async function fetchOpsQueue(token: string): Promise<{ items: OpsItem[] }> {
  return api('/v1/admin/ops-queue', { token });
}

export interface DisputeRow {
  readonly id: string;
  readonly orderReference: string;
  readonly orderTotalCents: number;
  readonly currency: string;
  readonly reason: string;
  readonly description: string | null;
  readonly raisedBy: string;
  readonly status: string;
  readonly resolution: string | null;
  readonly createdAt: string;
}

export async function fetchDisputes(token: string): Promise<{ disputes: DisputeRow[] }> {
  return api('/v1/admin/disputes', { token });
}

export async function resolveDispute(
  token: string,
  id: string,
  body: { outcome: string; resolution: string; refundCents?: number },
): Promise<unknown> {
  return api(`/v1/disputes/${id}/resolve`, { method: 'POST', token, body });
}

/** CSV export is on every view, per the specification. */
export function demandExportUrl(token: string, days: number): string {
  return `${API_BASE}/v1/admin/demand/export?days=${days}&access_token=${encodeURIComponent(token)}`;
}
