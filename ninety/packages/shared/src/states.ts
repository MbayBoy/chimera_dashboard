/**
 * The request state machine.
 *
 * `requests.status` is never assignable from a controller. It changes only
 * through a transition function that validates the current state against the
 * table below. The table lives here so that the API, the terminal, the admin
 * console and the buyer app all describe the same lifecycle.
 */

export const RequestState = {
  DRAFT: 'DRAFT',
  MATCHING: 'MATCHING',
  NO_SUPPLY: 'NO_SUPPLY',
  AWAITING_OFFERS: 'AWAITING_OFFERS',
  WIDENING: 'WIDENING',
  COLLECTING_OFFERS: 'COLLECTING_OFFERS',
  NO_OFFERS: 'NO_OFFERS',
  ACCEPTED: 'ACCEPTED',
  PAYMENT_HELD: 'PAYMENT_HELD',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DISPATCHED: 'DISPATCHED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const;

export type RequestState = (typeof RequestState)[keyof typeof RequestState];

/** Terminal outcome recorded on close. This is the demand dataset. */
export const RequestOutcome = {
  FULFILLED: 'fulfilled',
  NO_OFFERS: 'no_offers',
  NO_SUPPLY: 'no_supply',
  BUYER_DECLINED: 'buyer_declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  DELIVERY_FAILED: 'delivery_failed',
  REFUNDED: 'refunded',
} as const;

export type RequestOutcome = (typeof RequestOutcome)[keyof typeof RequestOutcome];

/**
 * Named transitions. A transition is legal only if the request is currently in
 * one of `from`. Anything else is rejected — including a transition that would
 * be harmless — because "harmless" is how a state machine stops being one.
 */
export const RequestTransition = {
  SUBMIT: 'SUBMIT',
  NO_SUPPLIERS_MATCHED: 'NO_SUPPLIERS_MATCHED',
  FANOUT_SENT: 'FANOUT_SENT',
  RESPONSE_WINDOW_CLOSED_WITH_OFFERS: 'RESPONSE_WINDOW_CLOSED_WITH_OFFERS',
  RESPONSE_WINDOW_CLOSED_WITHOUT_OFFERS: 'RESPONSE_WINDOW_CLOSED_WITHOUT_OFFERS',
  OFFER_ARRIVED_WHILE_WIDENING: 'OFFER_ARRIVED_WHILE_WIDENING',
  WIDENING_EXHAUSTED: 'WIDENING_EXHAUSTED',
  BUYER_ACCEPTS: 'BUYER_ACCEPTS',
  BUYER_DECLINES_ALL: 'BUYER_DECLINES_ALL',
  SELECTION_WINDOW_EXPIRED: 'SELECTION_WINDOW_EXPIRED',
  PAYMENT_AUTHORISED: 'PAYMENT_AUTHORISED',
  PAYMENT_AUTHORISATION_FAILED: 'PAYMENT_AUTHORISATION_FAILED',
  RETURN_TO_SELECTION: 'RETURN_TO_SELECTION',
  COURIER_BOOKED: 'COURIER_BOOKED',
  COURIER_COLLECTED: 'COURIER_COLLECTED',
  COURIER_DELIVERED: 'COURIER_DELIVERED',
  COURIER_FAILED: 'COURIER_FAILED',
  BUYER_CONFIRMS_RECEIPT: 'BUYER_CONFIRMS_RECEIPT',
  AUTO_CONFIRM: 'AUTO_CONFIRM',
  BUYER_DISPUTES: 'BUYER_DISPUTES',
  DISPUTE_RESOLVED_COMPLETE: 'DISPUTE_RESOLVED_COMPLETE',
  DISPUTE_RESOLVED_REFUND: 'DISPUTE_RESOLVED_REFUND',
  REDISPATCH: 'REDISPATCH',
  BUYER_CANCELS: 'BUYER_CANCELS',
  CLOSE: 'CLOSE',
} as const;

export type RequestTransition = (typeof RequestTransition)[keyof typeof RequestTransition];

export interface TransitionRule {
  readonly from: readonly RequestState[];
  readonly to: RequestState;
  /** Outcome to stamp when this transition closes the request. */
  readonly outcome?: RequestOutcome;
}

export const TRANSITIONS: Readonly<Record<RequestTransition, TransitionRule>> = {
  SUBMIT: { from: [RequestState.DRAFT], to: RequestState.MATCHING },
  NO_SUPPLIERS_MATCHED: { from: [RequestState.MATCHING], to: RequestState.NO_SUPPLY, outcome: RequestOutcome.NO_SUPPLY },
  FANOUT_SENT: { from: [RequestState.MATCHING], to: RequestState.AWAITING_OFFERS },
  RESPONSE_WINDOW_CLOSED_WITH_OFFERS: {
    from: [RequestState.AWAITING_OFFERS],
    to: RequestState.COLLECTING_OFFERS,
  },
  RESPONSE_WINDOW_CLOSED_WITHOUT_OFFERS: {
    from: [RequestState.AWAITING_OFFERS],
    to: RequestState.WIDENING,
  },
  OFFER_ARRIVED_WHILE_WIDENING: { from: [RequestState.WIDENING], to: RequestState.COLLECTING_OFFERS },
  WIDENING_EXHAUSTED: { from: [RequestState.WIDENING], to: RequestState.NO_OFFERS, outcome: RequestOutcome.NO_OFFERS },
  BUYER_ACCEPTS: { from: [RequestState.COLLECTING_OFFERS], to: RequestState.ACCEPTED },
  BUYER_DECLINES_ALL: {
    from: [RequestState.COLLECTING_OFFERS],
    to: RequestState.CLOSED,
    outcome: RequestOutcome.BUYER_DECLINED,
  },
  SELECTION_WINDOW_EXPIRED: {
    from: [RequestState.COLLECTING_OFFERS],
    to: RequestState.EXPIRED,
    outcome: RequestOutcome.EXPIRED,
  },
  PAYMENT_AUTHORISED: { from: [RequestState.ACCEPTED], to: RequestState.PAYMENT_HELD },
  PAYMENT_AUTHORISATION_FAILED: { from: [RequestState.ACCEPTED], to: RequestState.PAYMENT_FAILED },
  // An authorisation failure must NOT close the request: the buyer goes back to
  // the offer list and may try another card or another offer.
  RETURN_TO_SELECTION: { from: [RequestState.PAYMENT_FAILED], to: RequestState.COLLECTING_OFFERS },
  COURIER_BOOKED: { from: [RequestState.PAYMENT_HELD], to: RequestState.DISPATCHED },
  COURIER_COLLECTED: { from: [RequestState.DISPATCHED], to: RequestState.IN_TRANSIT },
  COURIER_DELIVERED: { from: [RequestState.IN_TRANSIT], to: RequestState.DELIVERED },
  COURIER_FAILED: { from: [RequestState.DISPATCHED, RequestState.IN_TRANSIT], to: RequestState.DELIVERY_FAILED },
  REDISPATCH: { from: [RequestState.DELIVERY_FAILED], to: RequestState.DISPATCHED },
  BUYER_CONFIRMS_RECEIPT: {
    from: [RequestState.DELIVERED],
    to: RequestState.COMPLETED,
    outcome: RequestOutcome.FULFILLED,
  },
  AUTO_CONFIRM: { from: [RequestState.DELIVERED], to: RequestState.COMPLETED, outcome: RequestOutcome.FULFILLED },
  BUYER_DISPUTES: { from: [RequestState.DELIVERED, RequestState.COMPLETED], to: RequestState.DISPUTED },
  DISPUTE_RESOLVED_COMPLETE: {
    from: [RequestState.DISPUTED],
    to: RequestState.COMPLETED,
    outcome: RequestOutcome.FULFILLED,
  },
  DISPUTE_RESOLVED_REFUND: {
    from: [RequestState.DISPUTED],
    to: RequestState.REFUNDED,
    outcome: RequestOutcome.REFUNDED,
  },
  BUYER_CANCELS: {
    from: [
      RequestState.DRAFT,
      RequestState.MATCHING,
      RequestState.AWAITING_OFFERS,
      RequestState.WIDENING,
      RequestState.COLLECTING_OFFERS,
      RequestState.ACCEPTED,
      RequestState.PAYMENT_FAILED,
      RequestState.PAYMENT_HELD,
    ],
    to: RequestState.CANCELLED,
    outcome: RequestOutcome.CANCELLED,
  },
  CLOSE: {
    from: [
      RequestState.NO_SUPPLY,
      RequestState.NO_OFFERS,
      RequestState.EXPIRED,
      RequestState.CANCELLED,
      RequestState.COMPLETED,
      RequestState.REFUNDED,
      RequestState.DELIVERY_FAILED,
    ],
    to: RequestState.CLOSED,
  },
};

/** States from which nothing further can happen without an admin intervention. */
export const TERMINAL_STATES: readonly RequestState[] = [RequestState.CLOSED];

/** States where the buyer is still waiting on the clock. */
export const LIVE_STATES: readonly RequestState[] = [
  RequestState.MATCHING,
  RequestState.AWAITING_OFFERS,
  RequestState.WIDENING,
  RequestState.COLLECTING_OFFERS,
  RequestState.ACCEPTED,
  RequestState.PAYMENT_HELD,
  RequestState.DISPATCHED,
  RequestState.IN_TRANSIT,
  RequestState.DELIVERED,
];

export function isLegalTransition(from: RequestState, transition: RequestTransition): boolean {
  return TRANSITIONS[transition].from.includes(from);
}

/** Offer lifecycle. */
export const OfferStatus = {
  SUBMITTED: 'submitted',
  SHORTLISTED: 'shortlisted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  WITHDRAWN: 'withdrawn',
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

/** Order lifecycle, tracking the money rather than the request. */
export const OrderStatus = {
  CREATED: 'created',
  AUTHORISED: 'authorised',
  AUTHORISATION_FAILED: 'authorisation_failed',
  CAPTURED: 'captured',
  VOIDED: 'voided',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Delivery lifecycle. */
export const DeliveryStatus = {
  QUOTING: 'quoting',
  DISPATCHED: 'dispatched',
  DRIVER_ASSIGNED: 'driver_assigned',
  COLLECTED: 'collected',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  MANUAL_ESCALATION: 'manual_escalation',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const FanoutOutcome = {
  OFFERED: 'offered',
  DECLINED: 'declined',
  NO_RESPONSE: 'no_response',
  /** Terminal was demonstrably offline for the whole window — not a no-response. */
  UNREACHABLE: 'unreachable',
} as const;
export type FanoutOutcome = (typeof FanoutOutcome)[keyof typeof FanoutOutcome];
