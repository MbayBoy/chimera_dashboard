import { createHash } from 'node:crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import {
  addMinutes,
  anonLabelForIndex,
  findContactDetails,
  RequestState,
  randomReference,
  REQUEST_REFERENCE_PREFIX,
  type MarketConfig,
} from '@ninety/shared';
import { getDb, getSql } from '../db/client.js';
import { buyers, partCategories, requests, requestMedia, vehicles } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { transition } from '../state/machine.js';
import { resolveOrCreateVehicle } from '../vehicles/decoder.js';
import { log } from '../core/logger.js';

/**
 * Requests.
 *
 * The core object. A buyer posts one in under sixty seconds on a workshop floor,
 * and everything downstream — the fan-out, the clock, the offers, the delivery —
 * hangs off this row.
 */

export interface CreateRequestInput {
  readonly buyerId: string;
  readonly market: MarketConfig;
  readonly vehicle:
    | { readonly kind: 'catalogue'; readonly vehicleId: string }
    | { readonly kind: 'manual'; readonly make: string; readonly model: string; readonly year: number; readonly variant?: string | null }
    | { readonly kind: 'identifier'; readonly identifier: string; readonly make?: string; readonly model?: string; readonly year?: number };
  readonly partCategoryId: string | null;
  readonly partDescription: string;
  readonly conditionAccepted: readonly ('used' | 'refurbished' | 'new')[];
  readonly quantity: number;
  /**
   * A map pin, always. Street addressing is weak in market #1 and Makani numbers
   * and pins are how people actually navigate, so the data model assumes a pin
   * everywhere rather than a typed address that may not resolve.
   */
  readonly deliveryLocation: { readonly lat: number; readonly lng: number };
  readonly deliveryAddress: Record<string, unknown>;
  readonly submit: boolean;
  /** Set by the buyer after being warned, to post a near-duplicate deliberately. */
  readonly acknowledgeDuplicate?: boolean;
}

export interface CreatedRequest {
  readonly id: string;
  readonly reference: string;
  readonly status: RequestState;
  readonly duplicateWarning: { readonly reference: string; readonly minutesAgo: number } | null;
}

/** How recently an identical request counts as a duplicate. */
const DUPLICATE_WINDOW_MINUTES = 30;

/**
 * Fingerprint for duplicate detection: same buyer, same part, same vehicle.
 *
 * A workshop that taps POST twice on a slow connection must not silently fan the
 * same job out to the same yards a second time — the yards see two alerts for one
 * part, answer both, and conclude the terminal is noise.
 */
export function dedupeHash(input: {
  partCategoryId: string | null;
  partDescription: string;
  vehicleId: string | null;
  quantity: number;
}): string {
  return createHash('sha256')
    .update(
      [
        input.partCategoryId ?? '',
        input.partDescription.trim().toLowerCase().replace(/\s+/g, ' '),
        input.vehicleId ?? '',
        String(input.quantity),
      ].join('|'),
    )
    .digest('hex');
}

export async function createRequest(input: CreateRequestInput): Promise<CreatedRequest> {
  const market = input.market;

  if (!market.isLive) throw new AppError('market_not_live', 'error.market_not_live');

  // Free text reaches a supplier terminal, so it is scrubbed on the way in as
  // well as on the way out. A buyer who writes their number in the part
  // description has undone the double-blind just as effectively as a supplier.
  const contact = findContactDetails(input.partDescription);
  if (!contact.clean) {
    throw new AppError('contact_details_rejected', 'scrub.rejected', {
      details: { violations: contact.violations.map((v) => ({ kind: v.kind, messageKey: v.messageKey })) },
    });
  }

  const vehicleId = await resolveVehicle(input, market);
  const category = await resolveCategory(input.partCategoryId);
  const cityId = await nearestLiveCity(input.deliveryLocation, market.id);

  const hash = dedupeHash({
    partCategoryId: input.partCategoryId,
    partDescription: input.partDescription,
    vehicleId,
    quantity: input.quantity,
  });

  const duplicate = await findRecentDuplicate(input.buyerId, hash);
  if (duplicate !== null && input.submit && input.acknowledgeDuplicate !== true) {
    // Detected and warned, never silently fanned out twice. The buyer can post
    // it again deliberately by acknowledging.
    throw new AppError('conflict', 'error.duplicate_request', {
      details: {
        existingReference: duplicate.reference,
        minutesAgo: duplicate.minutesAgo,
        resubmitWith: { acknowledgeDuplicate: true },
      },
    });
  }

  const reference = await uniqueReference();
  const now = new Date();

  const rows = await getSql()<{ id: string }[]>`
    INSERT INTO requests (
      reference, buyer_id, market_id, city_id, vehicle_id, vehicle_raw,
      part_category_id, part_description, condition_accepted, quantity,
      delivery_location, delivery_address, status, dedupe_hash, created_at
    ) VALUES (
      ${reference}, ${input.buyerId}, ${market.id}, ${cityId}, ${vehicleId},
      ${JSON.stringify(describeVehicleInput(input))}::jsonb,
      ${input.partCategoryId}, ${input.partDescription}, ${input.conditionAccepted as unknown as string[]},
      ${input.quantity},
      ST_SetSRID(ST_MakePoint(${input.deliveryLocation.lng}, ${input.deliveryLocation.lat}), 4326)::geography,
      ${JSON.stringify(input.deliveryAddress)}::jsonb,
      ${RequestState.DRAFT}, ${hash}, ${now}
    )
    RETURNING id
  `;
  const id = rows[0]!.id;

  log.info('request created', { requestId: id, reference, buyerId: input.buyerId, category: category?.code ?? null });

  let status: RequestState = RequestState.DRAFT;
  if (input.submit) {
    await transition(id, 'SUBMIT', {
      actorType: 'buyer',
      actorId: input.buyerId,
      patch: { submittedAt: now },
    });
    status = RequestState.MATCHING;
    // Matching runs on the queue rather than inline: a workshop tapping POST on
    // a shop floor should get their reference back immediately, and the geo
    // query plus fan-out should not sit inside that request. If the queue is
    // unreachable, run it inline rather than leave the request in MATCHING —
    // the reconciliation sweep would find it within a minute, but a minute is a
    // fifteenth of the promise.
    const { enqueueMatching } = await import('../timers/worker.js');
    try {
      await enqueueMatching(id);
    } catch (err) {
      log.warn('matching queue unavailable; matching inline', {
        requestId: id,
        err: err instanceof Error ? err.message : String(err),
      });
      const { runMatching } = await import('../matching/hooks.js');
      await runMatching(id);
    }
  }

  return {
    id,
    reference,
    status,
    duplicateWarning: duplicate === null ? null : { reference: duplicate.reference, minutesAgo: duplicate.minutesAgo },
  };
}

async function resolveVehicle(input: CreateRequestInput, market: MarketConfig): Promise<string | null> {
  const v = input.vehicle;
  if (v.kind === 'catalogue') {
    const rows = await getDb().select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, v.vehicleId)).limit(1);
    if (!rows[0]) throw new AppError('validation_failed', 'error.not_found');
    return rows[0].id;
  }
  if (v.kind === 'manual') {
    return resolveOrCreateVehicle({ make: v.make, model: v.model, year: v.year, variant: v.variant ?? null }, market.id);
  }
  // An identifier the buyer scanned. A decode that fails is not an error: the
  // scan is a convenience and make/model/year plus the photograph carry the job.
  if (v.make !== undefined && v.model !== undefined && v.year !== undefined) {
    return resolveOrCreateVehicle({ make: v.make, model: v.model, year: v.year }, market.id);
  }
  return null;
}

function describeVehicleInput(input: CreateRequestInput): Record<string, unknown> {
  // What the buyer actually typed or scanned, kept verbatim before enrichment —
  // so a mis-decode is diagnosable rather than invisible.
  return { ...input.vehicle };
}

async function resolveCategory(id: string | null) {
  if (id === null) return null;
  const rows = await getDb().select().from(partCategories).where(eq(partCategories.id, id)).limit(1);
  if (!rows[0]) throw new AppError('validation_failed', 'error.not_found');
  return rows[0];
}

/** The live city whose centroid is nearest the delivery pin. */
async function nearestLiveCity(location: { lat: number; lng: number }, marketId: string): Promise<string | null> {
  const rows = await getSql()<{ id: string }[]>`
    SELECT id FROM cities
    WHERE market_id = ${marketId} AND is_live = true
    ORDER BY centroid <-> ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function findRecentDuplicate(
  buyerId: string,
  hash: string,
): Promise<{ reference: string; minutesAgo: number } | null> {
  const since = addMinutes(new Date(), -DUPLICATE_WINDOW_MINUTES);
  const rows = await getDb()
    .select({ reference: requests.reference, createdAt: requests.createdAt, status: requests.status })
    .from(requests)
    .where(and(eq(requests.buyerId, buyerId), eq(requests.dedupeHash, hash), gte(requests.createdAt, since)))
    .orderBy(desc(requests.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status === RequestState.CLOSED || row.status === RequestState.CANCELLED) return null;
  return { reference: row.reference, minutesAgo: Math.max(0, Math.round((Date.now() - row.createdAt.getTime()) / 60_000)) };
}

async function uniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomReference(REQUEST_REFERENCE_PREFIX);
    const clash = await getDb().select({ id: requests.id }).from(requests).where(eq(requests.reference, candidate)).limit(1);
    if (clash.length === 0) return candidate;
  }
  throw new AppError('internal_error', 'error.internal');
}

/** Attach an already-ingested media object to a request. */
export async function attachRequestMedia(
  requestId: string,
  media: { url: string; key: string; kind: 'photo' | 'video'; width: number | null; height: number | null; bytes: number },
): Promise<string> {
  const inserted = await getDb()
    .insert(requestMedia)
    .values({
      requestId,
      url: media.url,
      storageKey: media.key,
      kind: media.kind,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
    })
    .returning({ id: requestMedia.id });
  return inserted[0]!.id;
}

export async function requestOwnedBy(requestId: string, buyerId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.buyerId, buyerId)))
    .limit(1);
  return rows.length > 0;
}

export async function buyerIdForUser(userId: string): Promise<string | null> {
  const rows = await getDb().select({ id: buyers.id }).from(buyers).where(eq(buyers.userId, userId)).limit(1);
  return rows[0]?.id ?? null;
}

/** Anonymous labels are assigned in arrival order, per request. */
export async function nextAnonLabel(requestId: string): Promise<string> {
  const rows = await getSql()<{ n: string }[]>`
    SELECT count(*)::text AS n FROM offers WHERE request_id = ${requestId}
  `;
  return anonLabelForIndex(Number(rows[0]?.n ?? '0'));
}

/** Freshly computed counts used by the buyer-facing status payload. */
export async function requestCounts(requestId: string): Promise<{ fanoutCount: number; offerCount: number }> {
  const rows = await getSql()<{ fanouts: string; offers: string }[]>`
    SELECT
      (SELECT count(*) FROM request_fanouts WHERE request_id = ${requestId})::text AS fanouts,
      (SELECT count(*) FROM offers WHERE request_id = ${requestId} AND status <> 'withdrawn')::text AS offers
  `;
  return { fanoutCount: Number(rows[0]?.fanouts ?? '0'), offerCount: Number(rows[0]?.offers ?? '0') };
}

