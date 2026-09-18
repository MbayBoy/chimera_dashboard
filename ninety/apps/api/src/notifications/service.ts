import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { notifications, users } from '../db/schema.js';
import { resolveLocale, t, type MessageParams } from '../i18n/index.js';
import { marketConfig } from '../market/config.js';
import { log } from '../core/logger.js';

/**
 * Notifications.
 *
 * Every system-generated message is a locale key plus parameters, rendered at
 * send time against the recipient's own locale. No English string is ever
 * written into the notifications table, and none appears in a caller's code.
 *
 * Delivery is behind an interface. FCM handles web push for the terminal and
 * native push for the buyer app; an SMS provider is market-specific and arrives
 * with the market. Until a transport is wired in, messages are persisted and
 * marked queued — which is also exactly what an outage should do.
 */

export type Channel = 'push' | 'sms' | 'email' | 'in_app' | 'web_push';

export interface NotificationTransport {
  readonly name: string;
  supports(channel: Channel): boolean;
  send(input: { userId: string; channel: Channel; rendered: string; locale: string }): Promise<void>;
}

const transports: NotificationTransport[] = [];

export function registerTransport(transport: NotificationTransport): void {
  transports.push(transport);
}

export function clearTransports(): void {
  transports.length = 0;
}

export interface NotifyInput {
  readonly userId: string;
  readonly channel: Channel;
  readonly messageKey: string;
  readonly params?: MessageParams;
  readonly requestId?: string | null;
  readonly orderId?: string | null;
}

/**
 * Queue and attempt one notification.
 *
 * Never throws into the caller. A failed push must not roll back the state
 * transition that caused it — a buyer whose offer notification failed still has
 * offers, and the request must not be stuck because a device token was stale.
 */
export async function notify(input: NotifyInput): Promise<string | null> {
  try {
    const user = (await getDb().select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
    if (!user || !user.isActive || user.deletedAt !== null) return null;

    const market = await marketConfig.byId(user.marketId);
    const locale = resolveLocale(user.locale, market.localeDefault);
    const rendered = t(input.messageKey, locale, input.params ?? {});

    const inserted = await getDb()
      .insert(notifications)
      .values({
        userId: input.userId,
        channel: input.channel,
        messageKey: input.messageKey,
        params: (input.params ?? {}) as MessageParams,
        locale,
        rendered,
        requestId: input.requestId ?? null,
        orderId: input.orderId ?? null,
        status: 'queued',
      })
      .returning({ id: notifications.id });
    const id = inserted[0]!.id;

    const transport = transports.find((tr) => tr.supports(input.channel));
    if (transport === undefined) {
      // No transport configured for this channel. Persisted and visible in the
      // ops console rather than silently dropped.
      return id;
    }

    try {
      await transport.send({ userId: input.userId, channel: input.channel, rendered, locale });
      await getDb().update(notifications).set({ status: 'sent', sentAt: new Date() }).where(eq(notifications.id, id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await getDb().update(notifications).set({ status: 'failed', error: message }).where(eq(notifications.id, id));
      log.warn('notification delivery failed', { notificationId: id, channel: input.channel, err: message });
    }
    return id;
  } catch (err) {
    log.error('notification could not be queued', {
      userId: input.userId,
      messageKey: input.messageKey,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Resolve the user behind a buyer profile, for addressing a notification. */
export async function userIdForBuyer(buyerId: string): Promise<string | null> {
  const { buyers } = await import('../db/schema.js');
  const rows = await getDb().select({ userId: buyers.userId }).from(buyers).where(eq(buyers.id, buyerId)).limit(1);
  return rows[0]?.userId ?? null;
}

export async function userIdForSupplier(supplierId: string): Promise<string | null> {
  const { suppliers } = await import('../db/schema.js');
  const rows = await getDb().select({ userId: suppliers.userId }).from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  return rows[0]?.userId ?? null;
}

/** Render a message without sending it — used by the ops console to preview copy. */
export async function renderFor(userId: string, messageKey: string, params: MessageParams = {}): Promise<string> {
  const user = (await getDb().select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return t(messageKey, 'en', params);
  const market = await marketConfig.byId(user.marketId);
  return t(messageKey, resolveLocale(user.locale, market.localeDefault), params);
}
