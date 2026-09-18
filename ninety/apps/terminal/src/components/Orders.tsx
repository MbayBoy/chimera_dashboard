import { useState } from 'react';
import { translate, formatMoney, formatTime, type Language } from '../lib/i18n.js';
import { enqueue } from '../lib/queue.js';
import type { WonOrder } from '../lib/api.js';

/**
 * Won orders.
 *
 * The payout is stated in money rather than as a commission percentage the yard
 * has to work out, and the packaging rule sits on the card itself.
 *
 * That rule is not decorative. The parcel is the last place anonymity can leak,
 * and it leaks through habit — a business card dropped in, an invoice taped to
 * the box — rather than through malice. So it is on the screen the packer is
 * looking at while they pack.
 */
export function Orders({
  orders,
  currency,
  packagingRule,
  language,
  timezone,
}: {
  orders: readonly WonOrder[];
  currency: string;
  packagingRule: string;
  language: Language;
  timezone: string;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [marked, setMarked] = useState<readonly string[]>([]);

  if (orders.length === 0) {
    return (
      <div className="empty">
        <h2>{t('orders.empty')}</h2>
      </div>
    );
  }

  const markReady = (order: WonOrder) => {
    enqueue({
      id: `${order.orderId}:ready`,
      kind: 'ready',
      requestId: order.orderId,
      path: `/v1/supplier/orders/${order.orderId}/ready`,
      method: 'POST',
      body: {},
      photos: [],
      composedAt: new Date().toISOString(),
    });
    setMarked((m) => [...m, order.orderId]);
  };

  return (
    <div className="jobs">
      {orders.map((order) => (
        <article key={order.orderId} className="job">
          <div className="job-head">
            <span className="job-ref">{order.reference}</span>
            <span className="score-chip">{t('orders.youWon')}</span>
          </div>
          <div className="job-part">{order.partDescription}</div>

          <div className="stat">
            <div className="stat-label">{t('orders.payout')}</div>
            <div className="stat-value">{formatMoney(language, order.payoutCents, currency)}</div>
          </div>

          <div className="job-meta">
            {order.driverExpectedAt === null
              ? t('orders.driverPending')
              : t('orders.driverArriving', { time: formatTime(language, new Date(order.driverExpectedAt), timezone) })}
          </div>

          {marked.includes(order.orderId) ? (
            <div className="banner banner-info">{t('orders.packedDone')}</div>
          ) : (
            <button className="btn-primary btn-block btn-huge" onClick={() => markReady(order)}>
              {t('orders.packed')}
            </button>
          )}

          <div className="banner banner-warn">
            <strong>{t('orders.packagingTitle')}</strong>
            <div>{packagingRule || t('orders.packagingRule')}</div>
          </div>
        </article>
      ))}
    </div>
  );
}
