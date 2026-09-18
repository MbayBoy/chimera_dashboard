import { useEffect, useState } from 'react';
import { fetchMetrics, type Metrics as MetricsData } from '../lib/api.js';

/**
 * The metrics dashboard.
 *
 * Fill rate first, and alone at the top, because if it is wrong nothing else on
 * this page matters. A workshop that posts a request and gets silence does not
 * post a second one, and they tell the other workshops.
 *
 * SLA attainment is split by peak and off-peak, because the public promise is
 * "typically 90 minutes, up to 3 hours in peak traffic" and a single blended
 * number cannot tell you whether that promise was kept.
 */
export function Metrics({ token }: { token: string }): JSX.Element {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMetrics(token, undefined, days)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'could not load metrics'));
  }, [token, days]);

  if (error !== null) return <div className="page"><div className="banner bad">{error}</div></div>;
  if (data === null) return <div className="page"><div className="empty">Loading…</div></div>;

  const { marketplace, speed, commercial, supply } = data;

  return (
    <div className="page">
      <h1>Marketplace health</h1>
      <p className="subtitle">
        Miss the fill rate and nothing else matters. Everything below it is diagnosis.
      </p>

      <div className="toolbar">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="cards">
        <div className="card headline">
          <div className="label">Fill rate</div>
          <div className="value">{percent(marketplace.fillRate)}</div>
          <div className="note">
            {marketplace.requestsWithOffers} of {marketplace.requests} requests got an offer
          </div>
        </div>
        <div className="card">
          <div className="label">Offers per request</div>
          <div className="value">{marketplace.offersPerRequest?.toFixed(1) ?? '—'}</div>
        </div>
        <div className="card">
          <div className="label">Median supplier response</div>
          <div className="value">{duration(marketplace.medianSupplierResponseSeconds)}</div>
        </div>
        <div className="card">
          <div className="label">Offered within SLA</div>
          <div className="value">{percent(marketplace.filledWithinSlaRate)}</div>
        </div>
        <div className="card">
          <div className="label">No supply</div>
          <div className="value">{marketplace.noSupplyCount}</div>
          <div className="note">nobody breaks that vehicle</div>
        </div>
        <div className="card">
          <div className="label">No offers</div>
          <div className="value">{marketplace.noOffersCount}</div>
          <div className="note">asked, nobody had it</div>
        </div>
      </div>

      <h1>Speed</h1>
      <p className="subtitle">
        The headline is the share delivered inside the market&rsquo;s own SLA — split by peak, because that is the
        promise we actually made.
      </p>
      <div className="cards">
        <div className="card headline">
          <div className="label">Delivered within SLA</div>
          <div className="value">{percent(speed.deliveredWithinSlaRate)}</div>
          <div className="note">{speed.deliveries} deliveries</div>
        </div>
        <div className="card">
          <div className="label">Off-peak</div>
          <div className="value">{percent(speed.deliveredWithinSlaOffPeak)}</div>
        </div>
        <div className="card">
          <div className="label">Peak</div>
          <div className="value">{percent(speed.deliveredWithinSlaPeak)}</div>
          <div className="note">up to 3 hours is the honest promise</div>
        </div>
        <div className="card">
          <div className="label">Request → first offer</div>
          <div className="value">{duration(speed.requestToFirstOfferSeconds)}</div>
        </div>
        <div className="card">
          <div className="label">Request → accept</div>
          <div className="value">{duration(speed.requestToAcceptSeconds)}</div>
        </div>
        <div className="card">
          <div className="label">Accept → collected</div>
          <div className="value">{duration(speed.acceptToCollectedSeconds)}</div>
        </div>
        <div className="card">
          <div className="label">Collected → delivered</div>
          <div className="value">{duration(speed.collectedToDeliveredSeconds)}</div>
        </div>
      </div>

      <h1>Commercial</h1>
      <div className="cards">
        <div className="card">
          <div className="label">GMV</div>
          <div className="value">{money(commercial.gmvCents)}</div>
        </div>
        <div className="card">
          <div className="label">Revenue</div>
          <div className="value">{money(commercial.revenueCents)}</div>
        </div>
        <div className="card">
          <div className="label">Realised take rate</div>
          <div className="value">{percent(commercial.realisedTakeRate)}</div>
        </div>
        <div className="card">
          <div className="label">Contribution per order</div>
          <div className="value">{money(commercial.contributionPerOrderCents)}</div>
        </div>
        <div className="card">
          <div className="label">Courier cost vs charge</div>
          <div className="value" style={{ fontSize: 20 }}>
            {money(commercial.courierCostCents)} / {money(commercial.courierChargeCents)}
          </div>
          <div className="note">the gap IS the delivery margin</div>
        </div>
        <div className="card">
          <div className="label">Repeat buyer rate</div>
          <div className="value">{percent(commercial.repeatBuyerRate)}</div>
        </div>
      </div>

      <h1>Supply</h1>
      <p className="subtitle">
        The pipeline has four stages and only the last one counts. A signed yard with an unconfigured tablet is a dead
        terminal: it inflates the supply number and contributes nothing to fill rate.
      </p>
      <div className="pipeline" style={{ marginBottom: 20 }}>
        {supply.pipeline.map((stage, index) => {
          const max = Math.max(1, ...supply.pipeline.map((s) => s.count));
          const counts = index === supply.pipeline.length - 1;
          return (
            <div key={stage.stage} className={`stage ${counts ? 'counts' : ''}`}>
              <span>{stageLabel(stage.stage)}</span>
              <span className="track">
                <span className="fill" style={{ width: `${(stage.count / max) * 100}%` }} />
              </span>
              <span className="n">{stage.count}</span>
            </div>
          );
        })}
      </div>

      <div className="cards">
        <div className="card">
          <div className="label">Active suppliers</div>
          <div className="value">{supply.activeSuppliers}</div>
        </div>
        <div className="card">
          <div className="label">Responding weekly</div>
          <div className="value">{percent(supply.respondingWeeklyRate)}</div>
          <div className="note">{supply.respondingWeekly} yards</div>
        </div>
        <div className="card">
          <div className="label">Tablets deployed</div>
          <div className="value">{supply.tablets.deployed}</div>
          <div className="note">
            {supply.tablets.activeLast7Days} seen this week · {supply.tablets.lost} lost · {supply.tablets.broken} broken
          </div>
        </div>
      </div>

      <h1>Score distribution</h1>
      <table>
        <thead>
          <tr>
            <th>Band</th>
            <th>Yards</th>
          </tr>
        </thead>
        <tbody>
          {supply.scoreDistribution.map((band) => (
            <tr key={band.band}>
              <td>{band.band}</td>
              <td>{band.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function duration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * Money is shown in major units without a currency symbol.
 *
 * The console spans markets, and a single blended figure cannot carry one
 * currency honestly. Per-market breakdowns carry their own.
 */
function money(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'signed':
      return 'Signed';
    case 'tablet_installed':
      return 'Tablet installed';
    case 'profile_configured':
      return 'Profile configured';
    case 'test_request_passed':
      return 'Passed a test request';
    default:
      return stage;
  }
}
