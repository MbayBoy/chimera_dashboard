import { registerPaymentProvider, clearPaymentProviders } from '../payments/provider.js';
import { stripeFromEnv } from '../payments/stripe.js';
import { StubPaymentProvider } from '../payments/stub.js';
import { registerCourierProvider, clearCourierProviders } from '../logistics/provider.js';
import { HttpCourierProvider, ManualCourierProvider } from '../logistics/providers.js';
import { env } from '../env.js';
import { log } from '../core/logger.js';

/**
 * Provider registration.
 *
 * Which provider a market uses is data — `markets.payment_provider` and
 * `markets.courier_providers`. This is only the wiring that makes the named
 * implementations available, and it is the one place a new market's provider is
 * added.
 *
 * Where real credentials are absent, a deterministic stub is registered in their
 * place so the whole loop — authorise, dispatch, fail over, capture — runs end to
 * end in development and in tests. The stub is explicit about being one: it
 * refuses to run in production, where a missing credential must be a hard failure
 * rather than a silent simulation of taking someone's money.
 */
export async function registerProviders(): Promise<void> {
  clearPaymentProviders();
  clearCourierProviders();

  const stripe = stripeFromEnv();
  if (stripe !== null) {
    registerPaymentProvider(stripe);
    log.info('payment provider registered', { provider: 'stripe', delayedCapture: stripe.supportsDelayedCapture });
  } else if (env().NODE_ENV === 'production') {
    throw new Error('no payment credentials configured; a production deployment must not fall back to the stub provider');
  } else {
    registerPaymentProvider(new StubPaymentProvider('stripe'));
    log.warn('no Stripe credentials; using the stub payment provider (development only)');
  }

  // South Africa's processor is chosen on delayed-capture support first, and is
  // confirmed before that market launches. Until then the market is seeded not
  // live, and a stub stands in so the abstraction is exercised.
  if (env().NODE_ENV !== 'production') {
    registerPaymentProvider(new StubPaymentProvider('paystack'));
  }

  // Two providers per city, always, plus a manual fallback behind both. The UAE
  // parcel market moves quickly, so the endpoints are configuration rather than
  // a vendor list baked into code.
  registerCourierProvider(
    new HttpCourierProvider({
      name: 'metro_express',
      baseUrl: process.env.COURIER_METRO_EXPRESS_URL,
      apiKey: process.env.COURIER_METRO_EXPRESS_KEY,
      simulate: { baseCents: 1800, perKmCents: 90, baseEtaMinutes: 22, perKmMinutes: 2.1 },
    }),
  );
  registerCourierProvider(
    new HttpCourierProvider({
      name: 'gulf_rapid',
      baseUrl: process.env.COURIER_GULF_RAPID_URL,
      apiKey: process.env.COURIER_GULF_RAPID_KEY,
      // Slightly cheaper and slightly slower, so ETA-first selection is
      // observably different from price-first selection.
      simulate: { baseCents: 1500, perKmCents: 80, baseEtaMinutes: 31, perKmMinutes: 2.6 },
    }),
  );
  registerCourierProvider(new ManualCourierProvider());

  log.info('courier providers registered', { providers: ['metro_express', 'gulf_rapid', 'manual'] });
}
