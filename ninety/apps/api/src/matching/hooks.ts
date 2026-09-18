import { eq } from 'drizzle-orm';
import { RequestState, toIsoUtc } from '@ninety/shared';
import { getDb, getSql } from '../db/client.js';
import { requests } from '../db/schema.js';
import { marketConfig } from '../market/config.js';
import { transition, transitionIfStillIn } from '../state/machine.js';
import { selectSuppliers, sendFanout } from './engine.js';
import { getMatchingQueue, scheduleTimer, cancelTimer } from '../timers/queue.js';
import { notify, userIdForBuyer } from '../notifications/service.js';
import { buyerConnections } from '../realtime/hub.js';
import { log } from '../core/logger.js';
import { slaDeadline } from '../core/clock.js';

/**
 * Orchestration.
 *
 * The seam between the state machine, the matching engine and the clock. Each
 * function here is safe to call twice: the transitions are compare-and-set and
 * the timers are idempotent, because in a product built on a fifteen-minute
 * window every one of these will race something eventually.
 */

/** DRAFT → MATCHING → fan-out, or honestly nowhere. */
export async function runMatching(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) return;
  if (request.status !== RequestState.MATCHING) {
    log.debug('matching skipped: request has moved on', { requestId, status: request.status });
    return;
  }

  const market = await marketConfig.byId(request.marketId);
  const result = await selectSuppliers(requestId, { tier: 1, market });

  if (result.selected.length === 0) {
    // No yard in this area breaks this vehicle. A normal outcome, told plainly,
    // and logged — an unfilled request is the most valuable data this business
    // produces, and a miss with no supply is a different signal from a miss with
    // supply that had nothing on the shelf.
    await transition(requestId, 'NO_SUPPLIERS_MATCHED', { actorType: 'system', reason: 'no suppliers matched' });
    await logDemandMiss(requestId, 'no_supply', 0, false);
    await notifyBuyer(requestId, 'notify.buyer.no_supply');
    return;
  }

  const now = new Date();
  const responseDeadline = slaDeadline(now, market.sla.responseMin);
  const offersDeadline = slaDeadline(now, market.sla.offersMin);

  const summary = await fanoutSummary(requestId, market.sla.responseMin);
  await sendFanout(requestId, result.selected, {
    tier: 1,
    reference: request.reference,
    responseDeadline,
    summary,
  });

  await transition(requestId, 'FANOUT_SENT', {
    actorType: 'system',
    reason: `tier-1 fan-out to ${result.selected.length} suppliers`,
    patch: { responseDeadline, offersDeadline, fanoutAt: now },
    metadata: { selected: result.selected.length, considered: result.considered },
  });

  // Both deadlines armed at the moment the state is entered, as absolute times.
  await scheduleTimer(
    { kind: 'response-deadline', requestId, expectedStates: [RequestState.AWAITING_OFFERS], dueAt: toIsoUtc(responseDeadline) },
    responseDeadline,
  );
  await scheduleTimer(
    {
      kind: 'offers-deadline',
      requestId,
      expectedStates: [RequestState.COLLECTING_OFFERS, RequestState.AWAITING_OFFERS],
      dueAt: toIsoUtc(offersDeadline),
    },
    offersDeadline,
  );

  await notifyBuyer(requestId, 'notify.buyer.request_submitted', {
    reference: request.reference,
    count: result.selected.length,
    deadline: toIsoUtc(offersDeadline),
  });
}

/** T+15. Either offers arrived, or the search widens. */
export async function onResponseDeadline(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request || request.status !== RequestState.AWAITING_OFFERS) return;

  const offerCount = await liveOfferCount(requestId);
  const market = await marketConfig.byId(request.marketId);

  if (offerCount > 0) {
    await transitionIfStillIn(requestId, [RequestState.AWAITING_OFFERS], 'RESPONSE_WINDOW_CLOSED_WITH_OFFERS', {
      actorType: 'timer',
      reason: `${offerCount} offers at the response deadline`,
    });
    // Scoring after the transition, deliberately. A deadline's first duty is the
    // state change the buyer is watching for; writing a score event per
    // non-responding yard first put several hundred milliseconds of bookkeeping
    // in front of it, and every other deadline due in the same second waited.
    await markNonResponders(requestId);
    return;
  }

  const windows = await marketConfig.windows(request.marketId);
  const wideningDeadline = slaDeadline(new Date(), windows.wideningWindowMin - market.sla.responseMin);

  await transitionIfStillIn(requestId, [RequestState.AWAITING_OFFERS], 'RESPONSE_WINDOW_CLOSED_WITHOUT_OFFERS', {
    actorType: 'timer',
    reason: 'no offers at the response deadline; widening',
    patch: { wideningDeadline },
  });

  // Yards that never answered. Those whose terminal was offline the whole time
  // are marked unreachable instead: they did not miss the job, they never got it.
  await markNonResponders(requestId);

  await scheduleTimer(
    { kind: 'widening-deadline', requestId, expectedStates: [RequestState.WIDENING], dueAt: toIsoUtc(wideningDeadline) },
    wideningDeadline,
  );

  // Told honestly, and told at all. A buyer who gets silence never comes back.
  await notifyBuyer(requestId, 'notify.buyer.search_widened', {
    reference: request.reference,
    deadline: toIsoUtc(wideningDeadline),
  });
  buyerConnections.send(await buyerIdOf(requestId), {
    type: 'search_widened',
    requestId,
    wideningDeadline: toIsoUtc(wideningDeadline),
  });

  // The fan-out itself goes on the matching queue. The buyer has already been
  // told and the next deadline is already armed, so nothing the buyer can see
  // waits for the geo query — and no other request's deadline waits behind it.
  await enqueueWidening(requestId);
}

/**
 * The tier-2 fan-out, off the timer worker.
 *
 * Safe to run twice: the request must still be in WIDENING, yards already sent
 * the job in tier 1 are excluded by the engine, and the fan-out rows are
 * inserted with ON CONFLICT DO NOTHING.
 */
export async function runWidening(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request || request.status !== RequestState.WIDENING) {
    log.debug('widening skipped: request has moved on', { requestId, status: request?.status });
    return;
  }

  const market = await marketConfig.byId(request.marketId);
  const windows = await marketConfig.windows(request.marketId);
  const result = await selectSuppliers(requestId, { tier: 2, market });
  const summary = await fanoutSummary(requestId, windows.wideningWindowMin - market.sla.responseMin);
  const sent = await sendFanout(requestId, result.selected, {
    tier: 2,
    reference: request.reference,
    responseDeadline: request.wideningDeadline ?? slaDeadline(new Date(), windows.wideningWindowMin - market.sla.responseMin),
    summary,
  });

  log.info('tier-2 widening fired', { requestId, additionalSuppliers: sent });
}

/** T+45 with still nothing. Close honestly, and log the miss. */
export async function onWideningDeadline(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request || request.status !== RequestState.WIDENING) return;

  const offerCount = await liveOfferCount(requestId);
  if (offerCount > 0) {
    await transitionIfStillIn(requestId, [RequestState.WIDENING], 'OFFER_ARRIVED_WHILE_WIDENING', {
      actorType: 'timer',
      reason: 'offers arrived during widening',
    });
    return;
  }

  await transitionIfStillIn(requestId, [RequestState.WIDENING], 'WIDENING_EXHAUSTED', {
    actorType: 'timer',
    reason: 'no offers after widening',
  });
  await transitionIfStillIn(requestId, [RequestState.NO_OFFERS], 'CLOSE', { actorType: 'timer' });
  await markNonResponders(requestId);

  const fanouts = await getSql()<{ n: string }[]>`
    SELECT count(*)::text AS n FROM request_fanouts WHERE request_id = ${requestId}
  `;
  await logDemandMiss(requestId, 'no_offers', Number(fanouts[0]?.n ?? '0'), true);

  const facts = await missFacts(requestId);
  await notifyBuyer(requestId, 'notify.buyer.no_offers', { part: facts.part, vehicle: facts.vehicle });
  buyerConnections.send(await buyerIdOf(requestId), { type: 'no_offers', requestId });
}

/** T+30. Offers are final; the buyer chooses from what arrived. */
export async function onOffersDeadline(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) return;
  if (request.status !== RequestState.COLLECTING_OFFERS) return;

  const windows = await marketConfig.windows(request.marketId);
  const selectionDeadline = slaDeadline(new Date(), windows.selectionWindowMin);
  await getDb().update(requests).set({ selectionDeadline }).where(eq(requests.id, requestId));

  await scheduleTimer(
    {
      kind: 'selection-deadline',
      requestId,
      expectedStates: [RequestState.COLLECTING_OFFERS],
      dueAt: toIsoUtc(selectionDeadline),
    },
    selectionDeadline,
  );

  const offerCount = await liveOfferCount(requestId);
  await notifyBuyer(requestId, 'notify.buyer.offers_final', { reference: request.reference, count: offerCount });
  buyerConnections.send(await buyerIdOf(requestId), { type: 'offers_final', requestId, offerCount });
}

/** The buyer never chose. Nothing was charged; say so and let them repost. */
export async function onSelectionDeadline(requestId: string): Promise<void> {
  const result = await transitionIfStillIn(requestId, [RequestState.COLLECTING_OFFERS], 'SELECTION_WINDOW_EXPIRED', {
    actorType: 'timer',
    reason: 'no offer selected within the selection window',
  });
  if (result === null) return;
  await transitionIfStillIn(requestId, [RequestState.EXPIRED], 'CLOSE', { actorType: 'timer' });
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  await notifyBuyer(requestId, 'notify.buyer.request_expired', { reference: request?.reference ?? '' });
}

/** An offer arrived. Moves a widening request forward and wakes the buyer's screen. */
export async function onOfferSubmitted(requestId: string): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) return;

  if (request.status === RequestState.WIDENING) {
    await transitionIfStillIn(requestId, [RequestState.WIDENING], 'OFFER_ARRIVED_WHILE_WIDENING', {
      actorType: 'system',
      reason: 'first offer arrived during widening',
    });
    await cancelTimer({ kind: 'widening-deadline', requestId });
  }

  const offerCount = await liveOfferCount(requestId);
  buyerConnections.send(await buyerIdOf(requestId), { type: 'offer_received', requestId, offerCount });
  await notifyBuyer(requestId, 'notify.buyer.offer_received', {
    reference: request.reference,
    count: offerCount,
    price: '',
  });
}

export async function onOfferWithdrawn(requestId: string, offerId: string, wasAccepted: boolean): Promise<void> {
  const request = (await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1))[0];
  if (!request) return;
  const offerCount = await liveOfferCount(requestId);
  buyerConnections.send(await buyerIdOf(requestId), { type: 'offer_received', requestId, offerCount });

  if (!wasAccepted) {
    await notifyBuyer(requestId, 'notify.buyer.offer_withdrawn', { reference: request.reference });
    return;
  }

  // The yard withdrew a job the buyer had already accepted. The authorisation is
  // voided and the request goes back to selection, because the buyer's other
  // offers are still perfectly good and closing the request would waste them.
  const { voidAuthorisationForRequest } = await import('../payments/service.js');
  await voidAuthorisationForRequest(requestId, 'supplier withdrew an accepted offer');
  await notifyBuyer(requestId, 'notify.buyer.accepted_offer_withdrawn', { reference: request.reference });
  log.warn('accepted offer withdrawn by supplier', { requestId, offerId });
}

async function liveOfferCount(requestId: string): Promise<number> {
  const rows = await getSql()<{ n: string }[]>`
    SELECT count(*)::text AS n FROM offers WHERE request_id = ${requestId} AND status <> 'withdrawn'
  `;
  return Number(rows[0]?.n ?? '0');
}

/**
 * Close out fan-outs that were never answered.
 *
 * A yard whose terminal was offline when the job went out is recorded as
 * unreachable rather than as a no-response, and unreachable costs no score.
 */
async function markNonResponders(requestId: string): Promise<void> {
  const rows = await getSql()<{ id: string; supplier_id: string; was_online: boolean }[]>`
    UPDATE request_fanouts
       SET outcome = CASE WHEN was_online_at_send THEN 'no_response' ELSE 'unreachable' END
     WHERE request_id = ${requestId} AND outcome IS NULL
    RETURNING id, supplier_id, was_online_at_send AS was_online
  `;
  const { recordScoreEvent } = await import('./scoring.js');
  for (const row of rows) {
    await recordScoreEvent(row.supplier_id, row.was_online ? 'no_response' : 'unreachable', {
      requestId,
      note: row.was_online ? 'no response within the window' : 'terminal offline at fan-out; not counted against response rate',
    });
    if (!row.was_online) {
      const userId = await userIdForSupplier(row.supplier_id);
      if (userId !== null) {
        await notify({
          userId,
          channel: 'in_app',
          messageKey: 'notify.supplier.offline_not_penalised',
          params: { reference: requestId },
          requestId,
        });
      }
    }
  }
}

/**
 * Record an unfilled request.
 *
 * This is a product surface, not a debug line. It decides the inventory strategy
 * and it goes in front of investors — so it captures the part, the vehicle, the
 * place and the time, whether or not anyone ever reads it.
 */
async function logDemandMiss(
  requestId: string,
  kind: 'no_supply' | 'no_offers',
  suppliersPinged: number,
  tier2Attempted: boolean,
): Promise<void> {
  await getSql()`
    INSERT INTO demand_misses (
      request_id, market_id, city_id, part_category_id, part_description,
      vehicle_make, vehicle_model, vehicle_year, location, miss_kind,
      suppliers_pinged, tier2_attempted
    )
    SELECT r.id, r.market_id, r.city_id, r.part_category_id, r.part_description,
           v.make, v.model, v.year, r.delivery_location, ${kind},
           ${suppliersPinged}, ${tier2Attempted}
      FROM requests r LEFT JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.id = ${requestId}
    ON CONFLICT (request_id) DO NOTHING
  `;
  log.info('demand miss recorded', { requestId, kind, suppliersPinged, tier2Attempted });
}

async function missFacts(requestId: string): Promise<{ part: string; vehicle: string }> {
  const rows = await getSql()<{ part: string; make: string | null; model: string | null; year: number | null }[]>`
    SELECT r.part_description AS part, v.make, v.model, v.year
      FROM requests r LEFT JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.id = ${requestId}
  `;
  const row = rows[0];
  const vehicle = row?.make === null || row === undefined ? '' : `${row.make} ${row.model ?? ''} ${row.year ?? ''}`.trim();
  return { part: row?.part ?? '', vehicle };
}

async function fanoutSummary(requestId: string, minutes: number): Promise<Record<string, unknown>> {
  const rows = await getSql()<
    { part: string; name_i18n: Record<string, string> | null; make: string | null; model: string | null; year: number | null }[]
  >`
    SELECT r.part_description AS part, pc.name_i18n, v.make, v.model, v.year
      FROM requests r
      LEFT JOIN part_categories pc ON pc.id = r.part_category_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.id = ${requestId}
  `;
  const row = rows[0];
  return {
    part: row?.name_i18n?.en ?? row?.part ?? '',
    partI18n: row?.name_i18n ?? null,
    vehicle: row?.make === null || row === undefined ? '' : `${row.make} ${row.model ?? ''} ${row.year ?? ''}`.trim(),
    minutes,
  };
}

async function buyerIdOf(requestId: string): Promise<string> {
  const rows = await getDb().select({ buyerId: requests.buyerId }).from(requests).where(eq(requests.id, requestId)).limit(1);
  return rows[0]?.buyerId ?? '';
}

async function notifyBuyer(requestId: string, messageKey: string, params: Record<string, string | number> = {}): Promise<void> {
  const buyerId = await buyerIdOf(requestId);
  if (buyerId === '') return;
  const userId = await userIdForBuyer(buyerId);
  if (userId === null) return;
  await notify({ userId, channel: 'push', messageKey, params, requestId });
}

async function userIdForSupplier(supplierId: string): Promise<string | null> {
  const { userIdForSupplier: resolve } = await import('../notifications/service.js');
  return resolve(supplierId);
}


/** Enqueue the tier-2 fan-out. Idempotent by job id, like every other enqueue. */
async function enqueueWidening(requestId: string): Promise<void> {
  await getMatchingQueue().add('widen', { requestId, tier: 2 }, { jobId: `widen:${requestId}` });
}
