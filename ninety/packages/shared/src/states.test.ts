import { describe, expect, it } from 'vitest';
import { isLegalTransition, RequestState, RequestTransition, TRANSITIONS } from './states.js';

describe('the request state machine', () => {
  it('permits the happy path end to end', () => {
    const path: [RequestState, RequestTransition][] = [
      [RequestState.DRAFT, 'SUBMIT'],
      [RequestState.MATCHING, 'FANOUT_SENT'],
      [RequestState.AWAITING_OFFERS, 'RESPONSE_WINDOW_CLOSED_WITH_OFFERS'],
      [RequestState.COLLECTING_OFFERS, 'BUYER_ACCEPTS'],
      [RequestState.ACCEPTED, 'PAYMENT_AUTHORISED'],
      [RequestState.PAYMENT_HELD, 'COURIER_BOOKED'],
      [RequestState.DISPATCHED, 'COURIER_COLLECTED'],
      [RequestState.IN_TRANSIT, 'COURIER_DELIVERED'],
      [RequestState.DELIVERED, 'BUYER_CONFIRMS_RECEIPT'],
      [RequestState.COMPLETED, 'CLOSE'],
    ];
    for (const [from, transition] of path) {
      expect(isLegalTransition(from, transition), `${from} -> ${transition}`).toBe(true);
    }
  });

  it('permits the empty-result path, which is a normal outcome and not an error', () => {
    expect(isLegalTransition(RequestState.AWAITING_OFFERS, 'RESPONSE_WINDOW_CLOSED_WITHOUT_OFFERS')).toBe(true);
    expect(isLegalTransition(RequestState.WIDENING, 'OFFER_ARRIVED_WHILE_WIDENING')).toBe(true);
    expect(isLegalTransition(RequestState.WIDENING, 'WIDENING_EXHAUSTED')).toBe(true);
    expect(TRANSITIONS.WIDENING_EXHAUSTED.outcome).toBe('no_offers');
  });

  it('returns the buyer to the offer list when an authorisation fails, never closing the request', () => {
    // The buyer losing all four offers because their card was declined wastes
    // fifteen minutes of supplier effort and loses the buyer.
    expect(TRANSITIONS.PAYMENT_AUTHORISATION_FAILED.to).toBe(RequestState.PAYMENT_FAILED);
    expect(isLegalTransition(RequestState.PAYMENT_FAILED, 'RETURN_TO_SELECTION')).toBe(true);
    expect(TRANSITIONS.RETURN_TO_SELECTION.to).toBe(RequestState.COLLECTING_OFFERS);
    expect(TRANSITIONS.PAYMENT_AUTHORISATION_FAILED.outcome).toBeUndefined();
  });

  it('refuses the transitions that would let a controller invent a state', () => {
    const illegal: [RequestState, RequestTransition][] = [
      [RequestState.DRAFT, 'BUYER_ACCEPTS'],
      [RequestState.CLOSED, 'SUBMIT'],
      [RequestState.COMPLETED, 'PAYMENT_AUTHORISED'],
      [RequestState.AWAITING_OFFERS, 'COURIER_DELIVERED'],
      [RequestState.NO_OFFERS, 'BUYER_ACCEPTS'],
      [RequestState.DELIVERED, 'COURIER_COLLECTED'],
    ];
    for (const [from, transition] of illegal) {
      expect(isLegalTransition(from, transition), `${from} -> ${transition} should be refused`).toBe(false);
    }
  });

  it('lets a buyer cancel from every pre-dispatch state', () => {
    for (const state of [
      RequestState.DRAFT,
      RequestState.MATCHING,
      RequestState.AWAITING_OFFERS,
      RequestState.WIDENING,
      RequestState.COLLECTING_OFFERS,
      RequestState.ACCEPTED,
      RequestState.PAYMENT_HELD,
    ]) {
      expect(isLegalTransition(state, 'BUYER_CANCELS'), `cancel from ${state}`).toBe(true);
    }
  });

  it('stamps an outcome on every transition that closes a request', () => {
    // Outcomes are the demand dataset. A request that closes without one is a
    // row missing from the most valuable data the business produces.
    const closing: RequestTransition[] = [
      'NO_SUPPLIERS_MATCHED',
      'WIDENING_EXHAUSTED',
      'BUYER_DECLINES_ALL',
      'SELECTION_WINDOW_EXPIRED',
      'BUYER_CONFIRMS_RECEIPT',
      'AUTO_CONFIRM',
      'BUYER_CANCELS',
      'DISPUTE_RESOLVED_COMPLETE',
      'DISPUTE_RESOLVED_REFUND',
    ];
    for (const transition of closing) {
      expect(TRANSITIONS[transition].outcome, `${transition} must record an outcome`).toBeTruthy();
    }
  });

  it('every transition names at least one legal origin', () => {
    for (const [name, rule] of Object.entries(TRANSITIONS)) {
      expect(rule.from.length, `${name} is unreachable`).toBeGreaterThan(0);
    }
  });
});
