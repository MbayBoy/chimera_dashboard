import type { Cents } from './money.js';

/**
 * Market configuration.
 *
 * The one rule that outlives every other decision: no market-specific value may
 * appear as a literal in application code. Every currency, rate, SLA, locale and
 * calendar below is read from the `markets` table through MarketConfigService
 * and reaches application code only as this object.
 */
export interface MarketConfig {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly currencyMinorUnitExponent: number;
  readonly locales: readonly string[];
  readonly localeDefault: string;
  readonly rtl: boolean;
  readonly timezone: string;
  readonly vehicleIdentifier: { readonly type: 'vin' | 'chassis'; readonly regex: string | null };
  readonly paymentProvider: string;
  readonly courierProviders: readonly string[];
  readonly tax: { readonly rate: number; readonly label: string; readonly inclusive: boolean };
  readonly sla: { readonly responseMin: number; readonly offersMin: number; readonly deliveryMin: number };
  readonly fees: {
    readonly commissionRate: number;
    readonly buyerFeeRate: number;
    readonly deliveryMarkupRate: number;
  };
  readonly addressModel: 'street' | 'makani' | 'hybrid';
  readonly businessCalendar: { readonly weekendDays: readonly number[]; readonly holidays: readonly string[] };
  readonly isLive: boolean;
}

export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export type PartCondition = 'used' | 'refurbished' | 'new';

export type ParcelClass = 'bike' | 'car' | 'van';

/**
 * The narrowed offer type the buyer serialiser is allowed to see.
 *
 * It structurally cannot carry supplier identity: there is no `supplierId`,
 * `businessName`, `address`, `location`, `userId` or `phone` on it, and no
 * bearing either. Passing a full offer row where this is expected is a compile
 * error, which is the point — a leak should not be a runtime discovery.
 */
export interface AnonymisableOffer {
  readonly id: string;
  readonly requestId: string;
  readonly anonLabel: string;
  readonly priceCents: Cents;
  readonly condition: PartCondition;
  readonly warrantyDays: number;
  readonly notes: string | null;
  readonly distanceKm: number;
  readonly readyInMin: number;
  readonly status: string;
  readonly createdAt: Date;
  readonly media: readonly { readonly url: string; readonly kind: string }[];
}

/** Exactly what a buyer receives for an offer. Nothing else, ever. */
export interface BuyerOfferView {
  readonly id: string;
  readonly label: string;
  readonly priceCents: Cents;
  readonly currency: string;
  readonly condition: PartCondition;
  readonly warrantyDays: number;
  readonly distanceKm: number;
  readonly readyInMin: number;
  readonly notes: string | null;
  readonly media: readonly { readonly url: string; readonly kind: string }[];
  readonly receivedAt: string;
}

/** Sorts a buyer may apply. Supplier score is deliberately absent. */
export type OfferSort = 'price_asc' | 'soonest' | 'closest' | 'warranty_desc';

export interface SupplierScoreComponents {
  readonly responseRate30d: number;
  readonly normalisedMedianResponseTime: number;
  readonly fulfilmentRate30d: number;
  readonly disputeRate30d: number;
}

export interface MatchComponents {
  readonly supplierId: string;
  readonly stockProfileMatch: number;
  readonly proximity: number;
  readonly supplierScoreNorm: number;
  readonly availability: number;
  readonly total: number;
  readonly distanceKm: number;
  readonly selected: boolean;
  readonly reason: string;
}

export interface Quote {
  readonly provider: string;
  readonly priceCents: Cents;
  readonly etaMinutes: number;
  readonly expiresAt: Date;
  readonly providerQuoteRef: string | null;
}

export interface DeliveryRef {
  readonly provider: string;
  readonly providerRef: string;
}

export interface CourierTrackingStatus {
  readonly provider: string;
  readonly providerRef: string;
  readonly status: 'pending' | 'driver_assigned' | 'collected' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  readonly driverAssigned: boolean;
  readonly etaMinutes: number | null;
  readonly proofUrl: string | null;
  readonly failureReason: string | null;
  readonly actualCents: Cents | null;
}

export interface Authorisation {
  readonly provider: string;
  readonly providerRef: string;
  readonly amountCents: Cents;
  readonly status: 'authorised' | 'failed' | 'requires_action';
  readonly failureCode: string | null;
  readonly raw: unknown;
}

export interface Capture {
  readonly provider: string;
  readonly providerRef: string;
  readonly amountCents: Cents;
  readonly raw: unknown;
}

export interface Refund {
  readonly provider: string;
  readonly providerRef: string;
  readonly amountCents: Cents;
  readonly raw: unknown;
}

export interface Payout {
  readonly provider: string;
  readonly providerRef: string;
  readonly amountCents: Cents;
  readonly raw: unknown;
}
