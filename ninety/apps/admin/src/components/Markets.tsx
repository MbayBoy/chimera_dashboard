import { useEffect, useState } from 'react';
import { fetchMarketAudit, fetchMarkets, updateMarket, type MarketRow } from '../lib/api.js';

/**
 * The market editor.
 *
 * Commission rate, buyer fee, SLA minutes, tax rate, live flags — per market, no
 * deploy, full audit trail. If changing any of these needed a code change, the
 * abstraction underneath would have failed.
 *
 * Every edit demands a reason, and the reason is stored. "Who changed the
 * commission rate, when, and why" must always have an answer.
 */
export function Markets({ token }: { token: string }): JSX.Element {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [audit, setAudit] = useState<{ field: string; from: string | null; to: string | null; reason: string | null; at: string }[]>([]);
  const [editing, setEditing] = useState<MarketRow | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const result = await fetchMarkets(token);
    setMarkets(result.markets);
    if (result.markets[0]) setAudit((await fetchMarketAudit(token, result.markets[0].code)).audit);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const startEdit = (market: MarketRow) => {
    setEditing(market);
    setReason('');
    setDraft({
      commissionRate: String(market.fees.commissionRate),
      buyerFeeRate: String(market.fees.buyerFeeRate),
      deliveryMarkupRate: String(market.fees.deliveryMarkupRate),
      taxRate: String(market.tax.rate),
      slaResponseMin: String(market.sla.responseMin),
      slaOffersMin: String(market.sla.offersMin),
      slaDeliveryMin: String(market.sla.deliveryMin),
      isLive: String(market.isLive),
    });
  };

  const save = async () => {
    if (editing === null || reason.trim().length < 3) {
      setMessage('Every change needs a reason. That is the point of the audit trail.');
      return;
    }
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(draft)) {
      changes[key] = key === 'isLive' ? value === 'true' : key.startsWith('sla') ? Number(value) : Number(value);
    }
    try {
      await updateMarket(token, editing.code, changes, reason);
      setMessage(`${editing.code} updated. Live within seconds — no deploy.`);
      setEditing(null);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'update failed');
    }
  };

  return (
    <div className="page">
      <h1>Markets</h1>
      <p className="subtitle">
        Rates, SLAs and live flags are data. Changing one here reaches a running API in seconds and never needs a
        deploy.
      </p>

      {message !== null && <div className="banner">{message}</div>}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Live</th>
            <th>Currency</th>
            <th>Locale</th>
            <th>Commission</th>
            <th>Buyer fee</th>
            <th>Tax</th>
            <th>SLA (resp/offers/delivery)</th>
            <th>Payments</th>
            <th>Couriers</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => (
            <tr key={market.code}>
              <td className="mono">{market.code}</td>
              <td>{market.name}</td>
              <td>
                <span className={`pill ${market.isLive ? 'ok' : ''}`}>{market.isLive ? 'live' : 'not live'}</span>
              </td>
              <td>{market.currency}</td>
              <td>
                {market.localeDefault} {market.rtl && <span className="pill info">RTL</span>}
              </td>
              <td>{(market.fees.commissionRate * 100).toFixed(2)}%</td>
              <td>{(market.fees.buyerFeeRate * 100).toFixed(2)}%</td>
              <td>
                {(market.tax.rate * 100).toFixed(2)}% {market.tax.label}
              </td>
              <td>
                {market.sla.responseMin} / {market.sla.offersMin} / {market.sla.deliveryMin} min
              </td>
              <td>{market.paymentProvider}</td>
              <td className="mono">{market.courierProviders.join(', ')}</td>
              <td>
                <button className="action" onClick={() => startEdit(market)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing !== null && (
        <div style={{ marginTop: 20, maxWidth: 520 }}>
          <h1>Edit {editing.code}</h1>
          {Object.entries(draft).map(([field, value]) => (
            <div className="form-row" key={field}>
              <label htmlFor={field}>{field}</label>
              <input id={field} type="text" value={value} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
            </div>
          ))}
          <div className="form-row">
            <label htmlFor="reason">Reason (required, and recorded)</label>
            <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="action" onClick={() => void save()}>
            Save
          </button>{' '}
          <button className="action" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      )}

      <h1 style={{ marginTop: 28 }}>Change history</h1>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Field</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((row, index) => (
            <tr key={`${row.at}-${row.field}-${index}`}>
              <td>{new Date(row.at).toLocaleString()}</td>
              <td className="mono">{row.field}</td>
              <td className="mono">{row.from ?? '—'}</td>
              <td className="mono">{row.to ?? '—'}</td>
              <td className="wrap">{row.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
