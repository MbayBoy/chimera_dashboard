import Stripe from 'stripe';
import type { Authorisation, Capture, Cents, Payout, Refund } from '@ninety/shared';
import type { AuthoriseInput, PaymentProvider, PayoutTarget } from './provider.js';
import { env } from '../env.js';
import { log } from '../core/logger.js';

/**
 * Stripe — market #1.
 *
 * Delayed capture is `capture_method: 'manual'` on a PaymentIntent: the funds are
 * authorised and held on the card, and `capture()` takes them. Stripe documents
 * the uncaptured window as seven days for card payments, which is comfortable
 * for a ninety-minute product — but capture happens on delivery confirmation,
 * and anything still authorised after forty-eight hours raises an alert, because
 * it means something is stuck.
 *
 * Card data never reaches these servers: the client collects it with Stripe's
 * own hosted fields and sends a payment-method token.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly supportsDelayedCapture = true;
  readonly authorisationWindowDays = 7;

  private readonly client: Stripe;
  private readonly webhookSecret: string | undefined;

  constructor(secretKey: string, webhookSecret?: string) {
    this.client = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });
    this.webhookSecret = webhookSecret;
  }

  async authorise(input: AuthoriseInput): Promise<Authorisation> {
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          // The whole legal design in one field: authorise now, capture later.
          capture_method: 'manual',
          confirm: true,
          payment_method: input.method.token,
          ...(input.method.customerRef ? { customer: input.method.customerRef } : {}),
          description: input.description,
          metadata: { orderId: input.orderId, orderReference: input.orderReference },
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        },
        { idempotencyKey: input.idempotencyKey },
      );

      if (intent.status === 'requires_capture') {
        return {
          provider: this.name,
          providerRef: intent.id,
          amountCents: intent.amount,
          status: 'authorised',
          failureCode: null,
          raw: intent,
        };
      }
      if (intent.status === 'requires_action') {
        return { provider: this.name, providerRef: intent.id, amountCents: intent.amount, status: 'requires_action', failureCode: null, raw: intent };
      }
      return {
        provider: this.name,
        providerRef: intent.id,
        amountCents: intent.amount,
        status: 'failed',
        failureCode: intent.last_payment_error?.code ?? intent.status,
        raw: intent,
      };
    } catch (err) {
      const stripeError = err as Stripe.errors.StripeError;
      log.warn('stripe authorisation failed', { code: stripeError.code, message: stripeError.message });
      return {
        provider: this.name,
        providerRef: stripeError.payment_intent?.id ?? '',
        amountCents: input.amountCents,
        status: 'failed',
        failureCode: stripeError.code ?? 'authorisation_error',
        raw: { message: stripeError.message, code: stripeError.code },
      };
    }
  }

  async capture(authId: string, amountCents: Cents, idempotencyKey: string): Promise<Capture> {
    const intent = await this.client.paymentIntents.capture(
      authId,
      { amount_to_capture: amountCents },
      { idempotencyKey },
    );
    return { provider: this.name, providerRef: intent.id, amountCents: intent.amount_received, raw: intent };
  }

  async void(authId: string, idempotencyKey: string): Promise<void> {
    await this.client.paymentIntents.cancel(authId, {}, { idempotencyKey });
  }

  async refund(captureId: string, amountCents: Cents, idempotencyKey: string): Promise<Refund> {
    const refund = await this.client.refunds.create(
      { payment_intent: captureId, amount: amountCents },
      { idempotencyKey },
    );
    return { provider: this.name, providerRef: refund.id, amountCents: refund.amount, raw: refund };
  }

  async payout(target: PayoutTarget, amountCents: Cents, currency: string, idempotencyKey: string): Promise<Payout> {
    // Payouts run from the operating account on a schedule, net of commission.
    // Deliberately a transfer to a connected account rather than a balance the
    // platform holds on the supplier's behalf — the latter is stored value.
    if (target.payoutDetailsId === null) {
      throw new Error('supplier has no payout destination configured');
    }
    const transfer = await this.client.transfers.create(
      { amount: amountCents, currency: currency.toLowerCase(), destination: target.payoutDetailsId },
      { idempotencyKey },
    );
    return { provider: this.name, providerRef: transfer.id, amountCents: transfer.amount, raw: transfer };
  }

  async verifyWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ id: string; type: string; data: unknown }> {
    if (this.webhookSecret === undefined) throw new Error('no webhook secret configured');
    if (signature === undefined) throw new Error('missing signature header');
    const event = this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    return { id: event.id, type: event.type, data: event.data.object };
  }
}

export function stripeFromEnv(): StripePaymentProvider | null {
  const secret = env().STRIPE_SECRET_KEY;
  if (secret === undefined || secret === '') return null;
  return new StripePaymentProvider(secret, env().STRIPE_WEBHOOK_SECRET);
}
