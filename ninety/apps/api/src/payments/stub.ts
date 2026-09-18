import { randomUUID } from 'node:crypto';
import type { Authorisation, Capture, Cents, Payout, Refund } from '@ninety/shared';
import type { AuthoriseInput, PaymentProvider, PayoutTarget } from './provider.js';
import { env } from '../env.js';

/**
 * A deterministic stand-in for a real processor.
 *
 * It exists so the full money lifecycle — authorise, capture, void, refund — can
 * be exercised end to end without provider credentials, including the failure
 * paths that matter most: a declined card must return the buyer to the offer
 * list rather than closing their request, and that is hard to rehearse against a
 * sandbox that always succeeds.
 *
 * It refuses to run in production. A missing credential there must be a hard
 * failure, not a silent simulation of taking someone's money.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly supportsDelayedCapture = true;
  readonly authorisationWindowDays = 7;
  readonly name: string;

  private readonly authorisations = new Map<string, { amountCents: Cents; captured: boolean; voided: boolean }>();

  constructor(name: string) {
    this.name = name;
    if (env().NODE_ENV === 'production') {
      throw new Error('the stub payment provider must never be registered in production');
    }
  }

  /** Tokens starting `tok_decline` fail, so the failure path is testable. */
  async authorise(input: AuthoriseInput): Promise<Authorisation> {
    if (input.method.token.startsWith('tok_decline')) {
      return {
        provider: this.name,
        providerRef: `stub_failed_${randomUUID().slice(0, 8)}`,
        amountCents: input.amountCents,
        status: 'failed',
        failureCode: 'card_declined',
        raw: { simulated: true, reason: 'card_declined' },
      };
    }
    if (input.method.token.startsWith('tok_action')) {
      return {
        provider: this.name,
        providerRef: `stub_action_${randomUUID().slice(0, 8)}`,
        amountCents: input.amountCents,
        status: 'requires_action',
        failureCode: null,
        raw: { simulated: true },
      };
    }
    const ref = `stub_auth_${randomUUID().slice(0, 12)}`;
    this.authorisations.set(ref, { amountCents: input.amountCents, captured: false, voided: false });
    return { provider: this.name, providerRef: ref, amountCents: input.amountCents, status: 'authorised', failureCode: null, raw: { simulated: true } };
  }

  async capture(authId: string, amountCents: Cents): Promise<Capture> {
    const auth = this.authorisations.get(authId);
    if (auth === undefined) throw new Error(`unknown authorisation ${authId}`);
    if (auth.voided) throw new Error('cannot capture a voided authorisation');
    auth.captured = true;
    return { provider: this.name, providerRef: authId, amountCents, raw: { simulated: true } };
  }

  async void(authId: string): Promise<void> {
    const auth = this.authorisations.get(authId);
    if (auth === undefined) return;
    if (auth.captured) throw new Error('cannot void a captured authorisation');
    auth.voided = true;
  }

  async refund(captureId: string, amountCents: Cents): Promise<Refund> {
    return { provider: this.name, providerRef: `stub_refund_${randomUUID().slice(0, 8)}`, amountCents, raw: { simulated: true, captureId } };
  }

  async payout(target: PayoutTarget, amountCents: Cents): Promise<Payout> {
    return { provider: this.name, providerRef: `stub_payout_${randomUUID().slice(0, 8)}`, amountCents, raw: { simulated: true, supplierId: target.supplierId } };
  }

  /**
   * Signature verification, simulated but real in shape.
   *
   * A payload without a valid signature is rejected, because a webhook endpoint
   * that trusts its body is a way to mark any order paid — and that property has
   * to hold in the tests too, not only against the live provider.
   */
  async verifyWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ id: string; type: string; data: unknown }> {
    if (signature === undefined || signature === '') throw new Error('missing signature');
    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', 'stub-webhook-secret').update(rawBody).digest('hex');
    if (signature !== expected) throw new Error('signature mismatch');
    const parsed = JSON.parse(rawBody.toString('utf8')) as { id?: string; type?: string; data?: { object?: unknown } };
    if (parsed.id === undefined || parsed.type === undefined) throw new Error('malformed event');
    return { id: parsed.id, type: parsed.type, data: parsed.data?.object ?? parsed.data ?? {} };
  }

  /** Test helper: sign a payload the way the stub expects. */
  static async sign(rawBody: Buffer): Promise<string> {
    const { createHmac } = await import('node:crypto');
    return createHmac('sha256', 'stub-webhook-secret').update(rawBody).digest('hex');
  }
}
