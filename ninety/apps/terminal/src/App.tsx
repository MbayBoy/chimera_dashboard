import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignIn } from './components/SignIn.js';
import { RequestList } from './components/RequestList.js';
import { QuoteScreen } from './components/QuoteScreen.js';
import { Orders } from './components/Orders.js';
import { StockProfile } from './components/StockProfile.js';
import { Performance } from './components/Performance.js';
import { isRtl, translate, type Language } from './lib/i18n.js';
import { alertNewRequest, unlockAudio } from './lib/alert.js';
import { clockIsSuspect, clockOffsetMs } from './lib/clock.js';
import { dismissRejected, enqueue, flush, all as queuedItems, type QueuedItem } from './lib/queue.js';
import {
  clearSession,
  fetchLiveRequests,
  fetchOrders,
  fetchPerformance,
  loadSession,
  openStream,
  saveSession,
  sendQueued,
  type LiveRequest,
  type Performance as PerformanceData,
  type Session,
  type WonOrder,
} from './lib/api.js';

type Tab = 'requests' | 'orders' | 'stock' | 'performance';

const LANGUAGE_KEY = 'ninety.terminal.language';

/**
 * The terminal.
 *
 * A web page, deliberately — scrapyards will not install an app, and a yard that
 * prefers its own phone or tablet can use this immediately with no install and
 * no store account. The free hardware removes friction; it is not a dependency.
 */
export function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    return stored === 'ar' || stored === 'en' ? stored : 'ar';
  });
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>('requests');
  const [jobs, setJobs] = useState<LiveRequest[]>([]);
  const [quoting, setQuoting] = useState<LiveRequest | null>(null);
  const [orders, setOrders] = useState<{ currency: string; packagingRule: string; orders: WonOrder[] }>({
    currency: 'XXX',
    packagingRule: '',
    orders: [],
  });
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [connected, setConnected] = useState(false);
  const [networkUp, setNetworkUp] = useState(() => navigator.onLine);
  const [outbox, setOutbox] = useState<QueuedItem[]>(() => queuedItems());

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const seenRequestIds = useRef<Set<string>>(new Set());
  /*
   * The locale sent with every call follows the DEVICE's language switch, not
   * the account's stored preference. A terminal is shared hardware, and the
   * person at the counter chooses what they can read.
   */
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';

  // RTL is layout. The whole document direction changes, not just the strings.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const refresh = useCallback(async () => {
    if (session === null) return;
    try {
      const live = await fetchLiveRequests(session.accessToken, locale);
      setJobs(live);

      // A job this terminal has not seen before is what makes the noise. The
      // check is on arrival rather than on the socket event, so a job that
      // arrived while the tablet was asleep still announces itself on wake.
      const fresh = live.filter((job) => !seenRequestIds.current.has(job.requestId) && !job.alreadyOffered);
      for (const job of fresh) seenRequestIds.current.add(job.requestId);
      if (fresh.length > 0 && seenRequestIds.current.size > fresh.length) {
        const first = fresh[0]!;
        await alertNewRequest(
          t('requests.newJob'),
          `${first.reference} — ${first.part.name}${first.vehicle === null ? '' : ` (${first.vehicle.make} ${first.vehicle.model})`}`,
        );
      } else {
        // First load after sign-in: populate without a burst of alerts.
        for (const job of live) seenRequestIds.current.add(job.requestId);
      }
    } catch {
      /* the poll failing is normal on a yard connection; the next one retries */
    }
  }, [session, locale, t]);

  /** Send anything the outbox is holding. */
  const flushOutbox = useCallback(async () => {
    if (session === null || !navigator.onLine) return;
    const result = await flush({ send: (item) => sendQueued(item, session.accessToken, locale) });
    setOutbox(queuedItems());
    if (result.sent > 0) await refresh();
  }, [session, locale, refresh]);

  // Poll as a floor under the WebSocket. The socket is the fast path; the poll
  // is what makes a missed event a 15-second problem rather than a lost job.
  useEffect(() => {
    if (session === null) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
  }, [session, refresh]);

  useEffect(() => {
    if (session === null) return;
    const stream = openStream(session.accessToken, {
      onEvent: (event) => {
        if (event.type === 'new_request' || event.type === 'request_withdrawn' || event.type === 'window_closed') {
          // Re-fetch rather than trusting the event's payload: a terminal that
          // was offline has missed things the event does not know about.
          void refresh();
        }
        if (event.type === 'offer_accepted') {
          void loadOrders();
          void loadPerformance();
        }
      },
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    });
    return () => stream.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const online = () => {
      setNetworkUp(true);
      void flushOutbox();
    };
    const offline = () => setNetworkUp(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const timer = setInterval(() => void flushOutbox(), 10_000);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      clearInterval(timer);
    };
  }, [flushOutbox]);

  const loadOrders = useCallback(async () => {
    if (session === null) return;
    try {
      setOrders(await fetchOrders(session.accessToken, locale));
    } catch {
      /* retried on the next tab switch */
    }
  }, [session, locale]);

  const loadPerformance = useCallback(async () => {
    if (session === null) return;
    try {
      setPerformance(await fetchPerformance(session.accessToken, locale));
    } catch {
      /* retried on the next tab switch */
    }
  }, [session, locale]);

  useEffect(() => {
    if (tab === 'orders') void loadOrders();
    if (tab === 'performance') void loadPerformance();
  }, [tab, loadOrders, loadPerformance]);

  const decline = (job: LiveRequest) => {
    // Two taps, and as cheap as ignoring it. Declining costs no score: a yard
    // that declines honestly is more useful than one that lets the clock run.
    enqueue({
      id: `${job.requestId}:decline`,
      kind: 'decline',
      requestId: job.requestId,
      path: `/v1/supplier/requests/${job.requestId}/decline`,
      method: 'POST',
      body: { reason: 'no_stock' },
      photos: [],
      composedAt: new Date().toISOString(),
    });
    setJobs((current) => current.filter((j) => j.requestId !== job.requestId));
    setOutbox(queuedItems());
    void flushOutbox();
  };

  const pending = outbox.filter((i) => i.status !== 'rejected');
  const rejected = outbox.filter((i) => i.status === 'rejected');
  const online = connected && networkUp;
  const liveJobs = useMemo(() => jobs.filter((j) => !j.alreadyOffered), [jobs]);

  if (session === null) {
    return (
      <div className="app" onPointerDown={() => void unlockAudio()}>
        <SignIn
          language={language}
          onLanguage={setLanguage}
          onSignedIn={(next) => {
            saveSession(next);
            setSession(next);
            setLanguage(next.rtl ? 'ar' : 'en');
          }}
        />
      </div>
    );
  }

  const currency = session.currency;

  return (
    <div className="app" onPointerDown={() => void unlockAudio()}>
      <header className="topbar">
        <span className="brand">{t('app.name')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {performance !== null && <span className="score-chip">★ {performance.score.toFixed(1)}</span>}
          {/* Always visible: a yard must know its terminal is live. */}
          <span className={`status ${online ? 'online' : ''}`}>
            <span className="dot" />
            {online ? t('app.online') : networkUp ? t('app.reconnecting') : t('app.offline')}
          </span>
        </div>
      </header>

      <main className="content">
        {clockIsSuspect() && (
          <div className="banner banner-warn" style={{ marginBottom: 16 }}>
            {t('app.clockDrift', { minutes: Math.round(Math.abs(clockOffsetMs()) / 60_000) })}
          </div>
        )}

        {pending.length > 0 && (
          <div className="banner banner-info" style={{ marginBottom: 16 }}>
            {t('quote.queued')} ({pending.length})
          </div>
        )}

        {rejected.length > 0 && (
          <div className="banner banner-error" style={{ marginBottom: 16 }}>
            <ul>
              {rejected.map((item) => (
                <li key={item.id}>{t(item.lastError ?? 'errors.generic')}</li>
              ))}
            </ul>
            <button
              className="btn-block"
              onClick={() => {
                dismissRejected();
                setOutbox(queuedItems());
              }}
            >
              OK
            </button>
          </div>
        )}

        {quoting !== null ? (
          <QuoteScreen
            job={quoting}
            language={language}
            currency={currency}
            // The commission rate comes from the server with the session; it is
            // never a constant in client code.
            commissionRate={session.commissionRate}
            online={online}
            onDone={() => {
              setQuoting(null);
              setOutbox(queuedItems());
              void flushOutbox();
            }}
            onCancel={() => setQuoting(null)}
          />
        ) : tab === 'requests' ? (
          <RequestList jobs={liveJobs} language={language} onQuote={setQuoting} onDecline={decline} />
        ) : tab === 'orders' ? (
          <Orders
            orders={orders.orders}
            currency={currency}
            packagingRule={orders.packagingRule}
            language={language}
            timezone={session.timezone}
          />
        ) : tab === 'stock' ? (
          <StockProfile token={session.accessToken} locale={locale} language={language} />
        ) : (
          <>
            <Performance data={performance} language={language} />
            <button
              className="btn-block"
              style={{ marginTop: 16 }}
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            >
              {t('signin.language')}
            </button>
            <button
              className="btn-danger btn-block"
              style={{ marginTop: 12 }}
              onClick={() => {
                clearSession();
                setSession(null);
              }}
            >
              {t('nav.signOut')}
            </button>
          </>
        )}
      </main>

      {quoting === null && (
        <nav className="tabs">
          {(['requests', 'orders', 'stock', 'performance'] as const).map((key) => (
            <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
              <span>{t(`nav.${key}`)}</span>
              {key === 'requests' && liveJobs.length > 0 && <span className="badge">{liveJobs.length}</span>}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
