import { useEffect, useState } from 'react';
import { fetchSuppliers, type SupplierRow } from '../lib/api.js';

/**
 * The supplier pipeline.
 *
 * Also the answer to the question the field team asks every morning: which yards
 * are stuck, and for how long. A yard sitting at "tablet installed" for three
 * weeks is a visit somebody needs to make.
 */
export function Suppliers({ token }: { token: string }): JSX.Element {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<string>('');

  useEffect(() => {
    void fetchSuppliers(token, stage === '' ? undefined : stage).then((result) => {
      setRows(result.suppliers);
      setPipeline(result.pipeline);
    });
  }, [token, stage]);

  return (
    <div className="page">
      <h1>Supply</h1>
      <p className="subtitle">
        Only &ldquo;passed a test request&rdquo; counts as supply. Everything above it is a yard that has agreed to
        something and is not yet answering anything.
      </p>

      <div className="cards">
        {(
          [
            ['Signed', 'signed'],
            ['Tablet installed', 'tabletInstalled'],
            ['Profile configured', 'profileConfigured'],
            ['Passed a test request', 'testRequestPassed'],
          ] as const
        ).map(([label, key], index) => (
          <div key={key} className={`card ${index === 3 ? 'headline' : ''}`}>
            <div className="label">{label}</div>
            <div className="value">{pipeline[key] ?? 0}</div>
            {index === 3 && <div className="note">the only number that counts</div>}
          </div>
        ))}
      </div>

      <div className="toolbar">
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          <option value="signed">Signed</option>
          <option value="tablet_installed">Tablet installed</option>
          <option value="profile_configured">Profile configured</option>
          <option value="test_request_passed">Passed a test request</option>
        </select>
        <span className="subtitle" style={{ margin: 0 }}>{rows.length} yards</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Yard</th>
            <th>City</th>
            <th>Stage</th>
            <th>Days at stage</th>
            <th>Status</th>
            <th>Verified</th>
            <th>Terminal</th>
            <th>Score</th>
            <th>Response rate</th>
            <th>Tablet</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {/* The one place a yard's name legitimately appears. Every read of
                  this screen is written to the identity access log. */}
              <td>{row.businessName}</td>
              <td>{row.city}</td>
              <td>
                <span className={`pill ${row.onboardingStage === 'test_request_passed' ? 'ok' : 'warn'}`}>
                  {row.onboardingStage.replace(/_/g, ' ')}
                </span>
              </td>
              <td className={row.daysAtStage > 14 && row.onboardingStage !== 'test_request_passed' ? 'countdown bad' : ''}>
                {row.daysAtStage}
              </td>
              <td>{row.status}</td>
              <td>{row.verified ? <span className="pill ok">yes</span> : <span className="pill bad">no</span>}</td>
              <td>
                {row.terminalOnline ? (
                  <span className="pill ok">online</span>
                ) : (
                  <span className="pill">{row.lastSeenAt === null ? 'never seen' : 'offline'}</span>
                )}
              </td>
              <td>{row.score.toFixed(2)}</td>
              <td>{(row.responseRate * 100).toFixed(0)}%</td>
              <td className="mono">{row.tablet === null ? '—' : `${row.tablet.serial} (${row.tablet.status})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
