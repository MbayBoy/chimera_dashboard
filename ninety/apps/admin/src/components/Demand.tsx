import { useEffect, useState } from 'react';
import { API_BASE, fetchUnfilled, type UnfilledRow } from '../lib/api.js';

/**
 * The demand dataset.
 *
 * This is a product surface, not a debug view. Every request, filled and
 * unfilled, records which part, for which vehicle, in which area, at what time,
 * and whether anyone could supply it. Nobody in either market has that, it
 * compounds, and it cannot be copied by launching the same app.
 *
 * The unfilled view is the one that decides what to stock later — and it is the
 * screen that goes in front of investors, which is why it has an export button
 * rather than a promise that the data exists somewhere.
 */
export function Demand({ token }: { token: string }): JSX.Element {
  const [rows, setRows] = useState<UnfilledRow[]>([]);
  const [days, setDays] = useState(90);

  useEffect(() => {
    void fetchUnfilled(token, days).then((result) => setRows(result.unfilled));
  }, [token, days]);

  return (
    <div className="page">
      <h1>Unfilled demand</h1>
      <p className="subtitle">
        What people asked for and nobody could supply, most frequent first. This is the most valuable data the business
        produces: it names the parts worth holding before anyone has to guess.
      </p>

      <div className="toolbar">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
        <a
          className="action"
          style={{ textDecoration: 'none', display: 'inline-block' }}
          href={`${API_BASE}/v1/admin/demand/export?days=${days}`}
          onClick={(event) => {
            // The export is an authenticated GET; fetch it with the token rather
            // than putting a credential in a URL that ends up in a browser history.
            event.preventDefault();
            void downloadCsv(token, days);
          }}
        >
          Export the full dataset (CSV)
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="empty">No unfilled requests in this window — which is either very good news or no traffic.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Misses</th>
              <th>Part</th>
              <th>Category</th>
              <th>Vehicle</th>
              <th>Kind</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.partDescription}-${row.vehicle ?? ''}`}>
                <td>
                  <strong>{row.misses}</strong>
                </td>
                <td className="wrap">{row.partDescription}</td>
                <td className="mono">{row.partCode ?? '—'}</td>
                <td>{row.vehicle ?? '—'}</td>
                <td>
                  {/* `no_supply` means nobody breaks that vehicle at all — a
                      recruiting signal. `no_offers` means we asked and nobody had
                      it — a stocking signal. They are different problems. */}
                  <span className={`pill ${row.missKind === 'no_supply' ? 'bad' : 'warn'}`}>
                    {row.missKind === 'no_supply' ? 'no yard covers it' : 'asked, nobody had it'}
                  </span>
                </td>
                <td>{new Date(row.lastSeen).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function downloadCsv(token: string, days: number): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/admin/demand/export?days=${days}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ninety-demand-${days}d.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
