import type { Cents, CourierTrackingStatus, DeliveryRef, ParcelClass, Quote } from '@ninety/shared';

/**
 * The courier interface.
 *
 * The ninety-minute promise is the product, and it is executed by a third party.
 * So provider failure is a routine, expected, handled event — not an exception
 * bolted on at the end. Two providers per city, always, plus a manual fallback
 * behind both.
 *
 * Providers are ordered per market in configuration (`markets.courier_providers`),
 * never in code, because the UAE's on-demand parcel market moves quickly and the
 * South African set is entirely different.
 */

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface QuoteRequest {
  readonly pickup: GeoPoint;
  readonly dropoff: GeoPoint;
  readonly parcel: ParcelClass;
  readonly currency: string;
}

export interface DispatchRequest {
  readonly orderId: string;
  readonly orderReference: string;
  readonly pickup: GeoPoint;
  readonly dropoff: GeoPoint;
  readonly parcel: ParcelClass;
  /**
   * The driver gets the yard's address. The buyer never does — this is the
   * physical extension of the anonymisation rule, and the courier is the only
   * link between the two sides.
   */
  readonly pickupInstructions: string;
  readonly dropoffInstructions: string;
}

export interface CourierProvider {
  readonly name: string;
  /** False when the provider needs a human, e.g. the manual ops fallback. */
  readonly automatic: boolean;
  quote(request: QuoteRequest): Promise<Quote>;
  dispatch(request: DispatchRequest): Promise<DeliveryRef>;
  track(ref: string): Promise<CourierTrackingStatus>;
  cancel(ref: string): Promise<void>;
}

const registry = new Map<string, CourierProvider>();

export function registerCourierProvider(provider: CourierProvider): void {
  registry.set(provider.name, provider);
}

export function getCourierProvider(name: string): CourierProvider | null {
  return registry.get(name) ?? null;
}

/** The ordered provider list for a market, filtered to those actually registered. */
export function couriersForMarket(names: readonly string[]): CourierProvider[] {
  return names.map((n) => registry.get(n)).filter((p): p is CourierProvider => p !== undefined);
}

export function clearCourierProviders(): void {
  registry.clear();
}

export type { Cents };
