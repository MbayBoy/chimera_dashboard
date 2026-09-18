import type { Authorisation, Capture, Cents, Payout, Refund } from '@ninety/shared';

/**
 * The payment provider interface.
 *
 * One interface, one provider per market, resolved from
 * `markets.payment_provider`. Nothing in application code knows it is talking to
 * Stripe.
 *
 * The pattern underneath it is authorise-on-acceptance, capture-on-delivery,
 * void-on-failure. No wallet, no balance, no float, no stored value — because
 * holding money on behalf of two parties can make this a regulated payments
 * intermediary under the UAE Central Bank's stored-value and payment-services
 * regime and under South Africa's National Payment System framework. The design
 * gives the buyer protection and the platform the leverage of the double-blind
 * without the licence.
 *
 * If anything here starts to look like a supplier balance, that is a licensing
 * question and not an engineering one.
 */

export interface PaymentMethod {
  /** A provider-side token. Card data never touches these servers. */
  readonly token: string;
  readonly customerRef?: string | null;
}

export interface AuthoriseInput {
  readonly orderId: string;
  readonly orderReference: string;
  readonly amountCents: Cents;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly description: string;
  readonly idempotencyKey: string;
}

export interface PayoutTarget {
  readonly supplierId: string;
  readonly payoutDetailsId: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  /** Whether this provider supports authorise-now, capture-later. */
  readonly supportsDelayedCapture: boolean;
  /** How long an authorisation remains capturable, in days. */
  readonly authorisationWindowDays: number;

  authorise(input: AuthoriseInput): Promise<Authorisation>;
  capture(authId: string, amountCents: Cents, idempotencyKey: string): Promise<Capture>;
  void(authId: string, idempotencyKey: string): Promise<void>;
  refund(captureId: string, amountCents: Cents, idempotencyKey: string): Promise<Refund>;
  payout(target: PayoutTarget, amountCents: Cents, currency: string, idempotencyKey: string): Promise<Payout>;
  /** Verify a webhook signature. Returns the parsed event, or throws. */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ id: string; type: string; data: unknown }>;
}

const registry = new Map<string, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider): void {
  registry.set(provider.name, provider);
}

export function getPaymentProvider(name: string): PaymentProvider {
  const provider = registry.get(name);
  if (provider === undefined) {
    throw new Error(
      `no payment provider registered for '${name}'. Markets resolve their provider from markets.payment_provider; ` +
        `register an implementation before that market goes live.`,
    );
  }
  return provider;
}

export function knownPaymentProviders(): string[] {
  return [...registry.keys()].sort();
}

export function clearPaymentProviders(): void {
  registry.clear();
}
