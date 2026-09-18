import { useState } from 'react';
import { OTP_CODE_LENGTH } from '@ninety/shared';
import { apiFetch, ApiError, fetchMe, saveSession, type MarketSummary, type Session } from '../lib/api.js';
import { localeFor, translate, type Language } from '../lib/i18n.js';

/**
 * Sign-in.
 *
 * Phone OTP, because the person at the counter has a phone and may not have an
 * email address. A yard should never have to know what a market code is, so it
 * is resolved for them: the deployment may pin one with VITE_MARKET_CODE, and
 * otherwise the server's list of live markets decides. Writing "AE" here as a
 * default is how the same application ends up needing a separate build per
 * country.
 */
const PINNED_MARKET_CODE = import.meta.env.VITE_MARKET_CODE as string | undefined;

export function SignIn({
  language,
  market,
  onLanguage,
  onSignedIn,
}: {
  language: Language;
  /** The live market this terminal is in, once the server has said. */
  market: MarketSummary | null;
  onLanguage: (next: Language) => void;
  onSignedIn: (session: Session) => void;
}): JSX.Element {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const locale = localeFor(language);
  const marketCode = PINNED_MARKET_CODE ?? market?.code ?? null;
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ devCode?: string }>('/v1/auth/otp/request', {
        method: 'POST',
        locale,
        body: { marketCode, phone, locale },
      });
      setDevCode(result.devCode ?? null);
      setStage('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { locale: string; rtl: boolean; marketCode: string; displayName: string | null };
      }>('/v1/auth/otp/verify', {
        method: 'POST',
        locale,
        body: { marketCode, phone, code, role: 'supplier', locale },
      });
      // The currency, the minor-unit exponent and this yard's commission rate
      // all come from the server. None of them is a constant in client code.
      const me = await fetchMe(result.accessToken, result.user.locale);
      const session: Session = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        locale: result.user.locale,
        rtl: result.user.rtl,
        marketCode: result.user.marketCode,
        currency: me.market.currency,
        currencyExponent: me.market.currencyMinorUnitExponent,
        commissionRate: me.terms?.commissionRate ?? 0,
        timezone: me.market.timezone,
        displayName: result.user.displayName,
      };
      saveSession(session);
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content">
      <div className="quote" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1>{t('signin.title')}</h1>
        <p style={{ color: 'var(--text-dim)' }}>{t('signin.subtitle')}</p>

        {error !== null && <div className="banner banner-error">{error}</div>}

        {stage === 'phone' ? (
          <>
            <div className="field">
              <label className="field-label" htmlFor="phone">
                {t('signin.phone')}
              </label>
              <input
                id="phone"
                className="price-display"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ fontSize: '1.6rem' }}
              />
            </div>
            {/* Until the server has said which market this terminal is in,
                there is nothing to send a code against. Better a disabled
                button with a reason than a request that fails validation. */}
            <button
              className="btn-primary btn-block btn-huge"
              onClick={requestCode}
              disabled={busy || phone.length < 6 || marketCode === null}
            >
              {t('signin.sendCode')}
            </button>
            {marketCode === null && <div className="banner banner-warn">{t('signin.connecting')}</div>}
          </>
        ) : (
          <>
            <div className="banner banner-info">{t('signin.sent', { phone })}</div>
            {/* Development only: the API echoes the code so nobody waits on an SMS
                provider that is deliberately not integrated yet. */}
            {devCode !== null && <div className="banner banner-warn">dev code: {devCode}</div>}
            <div className="field">
              <label className="field-label" htmlFor="code">
                {t('signin.code', { digits: OTP_CODE_LENGTH })}
              </label>
              <input
                id="code"
                className="price-display"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button className="btn-primary btn-block btn-huge" onClick={verify} disabled={busy || code.length !== 6}>
              {t('signin.verify')}
            </button>
            <button className="btn-block" onClick={() => setStage('phone')} disabled={busy}>
              {t('signin.resend')}
            </button>
          </>
        )}

        <button className="btn-block" onClick={() => onLanguage(language === 'ar' ? 'en' : 'ar')}>
          {t('signin.language')}
        </button>
      </div>
    </div>
  );
}
