import { useEffect, useState } from 'react';
import { fetchDisputes, fetchOpsQueue, resolveDispute, type DisputeRow, type OpsItem } from '../lib/api.js';

/**
 * Disputes and the ops queue.
 *
 * A dispute can never be resolved by the counterparty. It is enforced on the
 * server twice — the route is admin-only, and the resolver is checked against
 * the order's two parties — and this screen is the only place it happens.
 *
 * The ops queue above it is where a courier failure lands when every provider
 * has failed. That is the system working: a human picks it up, and the buyer has
 * already been told honestly with a revised time.
 */
export function Disputes({ token }: { token: string }): JSX.Element {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [ops, setOps] = useState<OpsItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setDisputes((await fetchDisputes(token)).disputes);
    setOps((await fetchOpsQueue(token)).items);
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resolve = async (dispute: DisputeRow, outcome: 'upheld_refund' | 'upheld_partial_refund' | 'rejected') => {
    const resolution = window.prompt(`Resolution for ${dispute.orderReference}?`);
    if (resolution === null || resolution.trim().length < 3) return;
    let refundCents = 0;
    if (outcome === 'upheld_partial_refund') {
      const entered = window.prompt('Partial refund, in minor units:', String(Math.round(dispute.orderTotalCents / 2)));
      if (entered === null) return;
      refundCents = Number(entered);
    }
    try {
      await resolveDispute(token, dispute.id, { outcome, resolution, refundCents });
      setMessage(`${dispute.orderReference} resolved`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'resolution failed');
    }
  };

  return (
    <div className="page">
      <h1>Ops queue</h1>
      <p className="subtitle">
        Where a job lands when every courier has failed, or an authorisation has been open too long. A human picking
        this up is the system working, not the system failing.
      </p>
      {ops.length === 0 ? (
        <div className="empty">Nothing waiting.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Kind</th>
              <th>Summary</th>
              <th>Raised</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((item) => (
              <tr key={item.id} className={item.severity === 'critical' ? 'at-risk' : ''}>
                <td>
                  <span className={`pill ${item.severity === 'critical' ? 'bad' : item.severity === 'high' ? 'warn' : ''}`}>
                    {item.severity}
                  </span>
                </td>
                <td className="mono">{item.kind}</td>
                <td className="wrap">{item.summary}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h1 style={{ marginTop: 28 }}>Disputes</h1>
      <p className="subtitle">
        Only an admin resolves one. Neither side of an order can decide its own case.
      </p>
      {message !== null && <div className="banner">{message}</div>}
      {disputes.length === 0 ? (
        <div className="empty">No disputes.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Raised by</th>
              <th>Reason</th>
              <th>Detail</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((dispute) => (
              <tr key={dispute.id}>
                <td className="mono">{dispute.orderReference}</td>
                <td>{dispute.raisedBy}</td>
                <td>{dispute.reason.replace(/_/g, ' ')}</td>
                <td className="wrap">{dispute.description ?? '—'}</td>
                <td>
                  <span className={`pill ${dispute.status === 'open' ? 'warn' : 'ok'}`}>{dispute.status}</span>
                </td>
                <td>
                  {(dispute.orderTotalCents / 100).toFixed(2)} {dispute.currency}
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {dispute.status === 'open' && (
                    <>
                      <button className="action" onClick={() => void resolve(dispute, 'upheld_refund')}>
                        Refund in full
                      </button>
                      <button className="action" onClick={() => void resolve(dispute, 'upheld_partial_refund')}>
                        Partial
                      </button>
                      <button className="action danger" onClick={() => void resolve(dispute, 'rejected')}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
