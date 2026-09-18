import { useState } from 'react';
import { Board } from './components/Board.js';
import { Metrics } from './components/Metrics.js';
import { Suppliers } from './components/Suppliers.js';
import { Demand } from './components/Demand.js';
import { Markets } from './components/Markets.js';
import { Disputes } from './components/Disputes.js';
import { api, clearSession, loadSession, saveSession, type AdminSession } from './lib/api.js';

type View = 'board' | 'metrics' | 'suppliers' | 'demand' | 'markets' | 'disputes';

const MARKET_CODE = (import.meta.env.VITE_MARKET_CODE as string | undefined) ?? 'AE';

export function App(): JSX.Element {
  const [session, setSession] = useState<AdminSession | null>(() => loadSession());
  const [view, setView] = useState<View>('board');

  if (session === null) return <SignIn onSignedIn={setSession} />;

  return (
    <div className="shell">
      <header className="bar">
        <span className="brand">NINETY OPS</span>
        <nav>
          {(
            [
              ['board', 'Live board'],
              ['metrics', 'Metrics'],
              ['suppliers', 'Supply'],
              ['demand', 'Demand'],
              ['disputes', 'Disputes & ops'],
              ['markets', 'Markets'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <button
          className="action"
          onClick={() => {
            clearSession();
            setSession(null);
          }}
        >
          Sign out
        </button>
      </header>

      {view === 'board' && <Board token={session.accessToken} />}
      {view === 'metrics' && <Metrics token={session.accessToken} />}
      {view === 'suppliers' && <Suppliers token={session.accessToken} />}
      {view === 'demand' && <Demand token={session.accessToken} />}
      {view === 'disputes' && <Disputes token={session.accessToken} />}
      {view === 'markets' && <Markets token={session.accessToken} />}
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (session: AdminSession) => void }): JSX.Element {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const request = async () => {
    setError(null);
    try {
      const result = await api<{ devCode?: string }>('/v1/auth/otp/request', {
        method: 'POST',
        body: { marketCode: MARKET_CODE, phone },
      });
      setDevCode(result.devCode ?? null);
      setStage('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not send a code');
    }
  };

  const verify = async () => {
    setError(null);
    try {
      const result = await api<{ accessToken: string; refreshToken: string; user: { displayName: string | null } }>(
        '/v1/auth/otp/verify',
        { method: 'POST', body: { marketCode: MARKET_CODE, phone, code, role: 'admin' } },
      );
      const session: AdminSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        displayName: result.user.displayName,
      };
      saveSession(session);
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign-in failed');
    }
  };

  return (
    <div className="shell">
      <header className="bar">
        <span className="brand">NINETY OPS</span>
      </header>
      <div className="page" style={{ maxWidth: 380 }}>
        <h1>Sign in</h1>
        <p className="subtitle">Operations access. Every supplier-identity view from here is logged.</p>
        {error !== null && <div className="banner bad">{error}</div>}
        {devCode !== null && <div className="banner warn">dev code: {devCode}</div>}
        {stage === 'phone' ? (
          <>
            <div className="form-row">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button className="action" onClick={() => void request()}>
              Send code
            </button>
          </>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="code">Code</label>
              <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button className="action" onClick={() => void verify()}>
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
