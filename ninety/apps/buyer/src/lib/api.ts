/**
 * The buyer app's API client.
 *
 * Mirrors the terminal's, with one difference that matters: every offer it
 * receives has already been through the server's single anonymisation
 * serialiser. There is no supplier identity in any response this file can see,
 * which is why none of these types carry one.
 */

export interface BuyerSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly locale: string;
  readonly rtl: boolean;
  readonly currency: string;
  readonly currencyExponent: number;
  readonly timezone: string;
  readonly vehicleIdentifierType: 'vin' | 'chassis';
  readonly addressModel: 'street' | 'makani' | 'hybrid';
  readonly sla: { responseMin: number; offersMin: number; deliveryMin: number; deliveryPeakMin: number };
  readonly windows: { selectionWindowMin: number; wideningWindowMin: number; autoConfirmHours: number };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ClientOptions {
  readonly apiBase: string;
  readonly token?: string | null;
  readonly locale: string;
}

export async function request<T>(
  options: ClientOptions,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    // So an error before authentication still arrives in the buyer's language.
    'accept-language': options.locale,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const response = await fetch(`${options.apiBase}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
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

export interface BuyerOffer {
  readonly id: string;
  readonly label: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly condition: 'used' | 'refurbished' | 'new';
  readonly warrantyDays: number;
  /** Distance only. There is no direction in this payload, deliberately. */
  readonly distanceKm: number;
  readonly readyInMin: number;
  readonly notes: string | null;
  readonly media: readonly { url: string; kind: string }[];
  readonly receivedAt: string;
}

export interface OffersResponse {
  readonly requestId: string;
  readonly reference: string;
  readonly status: string;
  readonly sort: string;
  readonly offersDeadline: string | null;
  readonly selectionDeadline: string | null;
  readonly serverTime: string;
  readonly suppliersNotified: number;
  readonly offers: readonly BuyerOffer[];
}

export async function fetchOffers(options: ClientOptions, requestId: string, sort: string): Promise<OffersResponse> {
  return request<OffersResponse>(options, `/v1/requests/${requestId}/offers?sort=${sort}`);
}

export interface TrackingStep {
  readonly key: string;
  readonly label: string;
  readonly at: string | null;
  readonly done: boolean;
}

export interface TrackingResponse {
  readonly reference: string;
  readonly tracking: {
    readonly status: string;
    readonly statusLabel: string;
    readonly steps: readonly TrackingStep[];
    readonly etaAt: string | null;
    readonly deliveredAt: string | null;
    readonly serverTime: string;
  } | null;
}

export async function fetchTracking(options: ClientOptions, requestId: string): Promise<TrackingResponse> {
  return request<TrackingResponse>(options, `/v1/requests/${requestId}/tracking`);
}

export async function acceptOffer(
  options: ClientOptions,
  offerId: string,
  paymentMethodToken: string,
): Promise<{ orderId: string; reference: string; status: string; breakdown: Record<string, number | string> }> {
  return request(options, `/v1/offers/${offerId}/accept`, {
    method: 'POST',
    body: { paymentMethodToken },
  });
}

export async function confirmReceipt(options: ClientOptions, orderId: string): Promise<void> {
  await request(options, `/v1/orders/${orderId}/confirm-receipt`, { method: 'POST' });
}

export async function raiseDispute(
  options: ClientOptions,
  orderId: string,
  reason: string,
  description: string,
): Promise<{ disputeId: string }> {
  return request(options, `/v1/orders/${orderId}/dispute`, { method: 'POST', body: { reason, description } });
}
