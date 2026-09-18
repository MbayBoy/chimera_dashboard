import type { AnonymisableOffer, BuyerOfferView, OfferSort } from '@ninety/shared';
import { toIsoUtc } from '@ninety/shared';

/**
 * THE anonymisation serialiser.
 *
 * One function, one file. Every buyer-facing response containing offer data goes
 * through it — no exceptions, not even for an admin-ish endpoint, because the
 * second serialisation path is always the one that leaks.
 *
 * It cannot see supplier identity. Its input type, `AnonymisableOffer`, has no
 * `supplierId`, `businessName`, `address`, `location`, `userId` or `phone` on
 * it, so handing it a database row is a compile error rather than a runtime
 * discovery. That is deliberate: anonymity protected by policy is not protected.
 *
 * `distanceKm` is permitted and a bearing is NOT. Distance alone from a single
 * point does not locate a yard. Distance plus direction locates it on a map in
 * about four seconds, which is why no direction, compass point or heading
 * appears anywhere in this file or in anything it returns.
 *
 * Why this matters commercially: if the buyer learns which yard supplied the
 * part, the second deal happens on WhatsApp and the platform earns nothing. This
 * function is the business model.
 */
export function toBuyerView(offer: AnonymisableOffer, currency: string): BuyerOfferView {
  return {
    id: offer.id,
    label: offer.anonLabel,
    priceCents: offer.priceCents,
    currency,
    condition: offer.condition,
    warrantyDays: offer.warrantyDays,
    // Rounded to one decimal: a distance quoted to the metre is a coordinate.
    distanceKm: Math.round(offer.distanceKm * 10) / 10,
    readyInMin: offer.readyInMin,
    notes: offer.notes,
    media: offer.media.map((m) => ({ url: m.url, kind: m.kind })),
    receivedAt: toIsoUtc(offer.createdAt),
  };
}

export function toBuyerViews(offers: readonly AnonymisableOffer[], currency: string): BuyerOfferView[] {
  return offers.map((o) => toBuyerView(o, currency));
}

/**
 * Ordering shown to the buyer.
 *
 * Default is price ascending. Alternatives are soonest ready, closest and
 * longest warranty.
 *
 * Supplier score is deliberately NOT an option, and is not a tiebreak either.
 * The score governs who RECEIVES a request, never which offer wins. Mixing the
 * two lets a high-scoring yard charge more, which destroys the price competition
 * that makes the double-blind worth anything to a buyer — and buyers eventually
 * notice.
 */
export function sortOffers(views: readonly BuyerOfferView[], sort: OfferSort = 'price_asc'): BuyerOfferView[] {
  const sorted = [...views];
  switch (sort) {
    case 'soonest':
      sorted.sort((a, b) => a.readyInMin - b.readyInMin || a.priceCents - b.priceCents);
      break;
    case 'closest':
      sorted.sort((a, b) => a.distanceKm - b.distanceKm || a.priceCents - b.priceCents);
      break;
    case 'warranty_desc':
      sorted.sort((a, b) => b.warrantyDays - a.warrantyDays || a.priceCents - b.priceCents);
      break;
    case 'price_asc':
    default:
      sorted.sort((a, b) => a.priceCents - b.priceCents || a.readyInMin - b.readyInMin);
      break;
  }
  return sorted;
}

/**
 * The fields an offer row carries that must never reach a buyer.
 *
 * Exported so the leak tests can assert against the list rather than against a
 * hand-written set that drifts as the schema grows.
 */
export const FORBIDDEN_BUYER_FIELDS = [
  'supplierId',
  'supplier_id',
  'businessName',
  'business_name',
  'address',
  'location',
  'userId',
  'user_id',
  'phone',
  'email',
  'bearing',
  'heading',
  'direction',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'pickup',
  'pickupLocation',
  'pickup_location',
  'score',
  'supplierScore',
] as const;
