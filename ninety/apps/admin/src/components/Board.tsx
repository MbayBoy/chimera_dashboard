import { useCallback, useEffect, useState } from 'react';
import { fetchBoard, fetchMatchDecisions, intervene, type BoardRequest, type MatchDecision } from '../lib/api.js';

/**
 * The live request board.
 *
 * In launch week this is used constantly. Fill rate in the first fortnight sets
 * the market's opinion of us permanently, and rescuing a stalled request by hand
 * is a legitimate way to buy that — so the board sorts by what is closest to a
 * deadline and marks anything inside two minutes.
 *
 * Every intervention goes through the state machine, never a database write, and
 * every one records who did it and why. A rescue that leaves no trace is
 * indistinguishable from a bug.
 */
export function Board({ token }: { token: string }): JSX.Element {
  const [rows, setRows] = useState<BoardRequest[]>([]);
  const [liveOnly, setLiveOnly] = useState(true);
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [selected, setSelected] = useState<BoardRequest | null>(null);
  const [decisions, setDecisions] = useState<MatchDecision[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const board = await fetchBoard(token, { live: liveOnly, atRisk: atRiskOnly });
      setRows(board.requests);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'could not load the board');
    }
  }, [token, liveOnly, atRiskOnly]);

  useEffect(() => {
    void load();
    // Five seconds: fast enough to watch a launch-week fan-out land, slow enough
    // not to be a load test of our own API.
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const openDecisions = async (request: BoardRequest) => {
    setSelected(request);
    setDecisions(null);
    const result = await fetchMatchDecisions(token, request.id);
    setDecisions(result.decisions);
  };

  const act = async (request: BoardRequest, action: string) => {
    const reason = window.prompt(`Why are you doing this to ${request.reference}?`);
    if (reason === null || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await intervene(token, request.id, { action, reason });
      setMessage(`${action} applied to ${request.reference}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'intervention failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Live requests</h1>
      <p className="subtitle">
        Sorted by the nearest deadline. Anything inside two minutes is highlighted — those are the ones worth a phone
        call.
      </p>

      {message !== null && <div className="banner">{message}</div>}

      <div className="toolbar">
        <label>
          <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} /> Live only
        </label>
        <label>
          <input type="checkbox" checked={atRiskOnly} onChange={(e) => setAtRiskOnly(e.target.checked)} /> At risk only
        </label>
        <span className="subtitle" style={{ margin: 0 }}>
          {rows.length} shown
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nothing live right now.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>State</th>
              <th>Deadline</th>
              <th>Part</th>
              <th>Buyer</th>
              <th>City</th>
              <th>Sent</th>
              <th>Offers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.atRisk ? 'at-risk' : ''}>
                <td className="mono">{row.reference}</td>
                <td>
                  <span className="pill">{row.statusLabel}</span>
                </td>
                <td className={`countdown ${deadlineClass(row.secondsToDeadline)}`}>
                  {formatDeadline(row.secondsToDeadline)}
                </td>
                <td className="wrap">{row.partDescription}</td>
                <td>{row.buyerBusiness ?? '—'}</td>
                <td>{row.city ?? '—'}</td>
                <td>{row.suppliersNotified}</td>
                <td>{row.offers}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="action" onClick={() => void openDecisions(row)}>
                    Why
                  </button>
                  <button className="action" disabled={busy} onClick={() => void act(row, 'refan')}>
                    Re-fan
                  </button>
                  <button className="action" disabled={busy} onClick={() => void act(row, 'widen')}>
                    Widen
                  </button>
                  <button className="action" disabled={busy} onClick={() => void act(row, 'extend_deadline')}>
                    +10m
                  </button>
                  <button className="action danger" disabled={busy} onClick={() => void act(row, 'cancel')}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected !== null && (
        <div style={{ marginTop: 24 }}>
          <h1>Why these yards — {selected.reference}</h1>
          <p className="subtitle">
            Every candidate considered, selected or not. This is the answer to &ldquo;why did my yard not see that
            job&rdquo;, which is a question that arrives weekly and forever.
          </p>
          {decisions === null ? (
            <div className="empty">Loading…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Yard</th>
                  <th>Tier</th>
                  <th>Stock</th>
                  <th>Proximity</th>
                  <th>Score</th>
                  <th>Availability</th>
                  <th>Total</th>
                  <th>Threshold</th>
                  <th>Distance</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={`${d.supplierId}-${d.tier}`}>
                    <td>{d.businessName}</td>
                    <td>{d.tier}</td>
                    <td>{d.components.stockProfileMatch.toFixed(2)}</td>
                    <td>{d.components.proximity.toFixed(2)}</td>
                    <td>{d.components.supplierScore.toFixed(2)}</td>
                    <td>{d.components.availability.toFixed(2)}</td>
                    <td>
                      <strong>{d.total.toFixed(3)}</strong>
                    </td>
                    <td>{d.threshold.toFixed(2)}</td>
                    <td>{d.distanceKm.toFixed(1)} km</td>
                    <td className="wrap">
                      <span className={`pill ${d.selected ? 'ok' : ''}`}>{d.selected ? 'sent' : 'excluded'}</span>{' '}
                      <span className="subtitle">{d.reason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="action" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function formatDeadline(seconds: number | null): string {
  if (seconds === null) return '—';
  const sign = seconds < 0 ? '-' : '';
  const absolute = Math.abs(seconds);
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

function deadlineClass(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds < 0) return 'bad';
  if (seconds < 120) return 'bad';
  if (seconds < 300) return 'warn';
  return 'ok';
}
