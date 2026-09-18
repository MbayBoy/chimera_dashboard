import { useState } from 'react';
import { apiFetch, ApiError, fetchMe, saveSession, type Session } from '../lib/api.js';
import { translate, type Language } from '../lib/i18n.js';

/**
 * Sign-in.
 *
 * Phone OTP, because the person at the counter has a phone and may not have an
 * email address. The market code is baked into the build per deployment rather
 * than asked for: a yard should not have to know what a market code is.
 */
const MARKET_CODE = (import.meta.env.VITE_MARKET_CODE as string | undefined) ?? 'AE';

export function SignIn({
  language,
  onLanguage,
  onSignedIn,
}: {
  language: Language;
  onLanguage: (next: Language) => void;
  onSignedIn: (session: Session) => void;
}): JSX.Element {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ devCode?: string }>('/v1/auth/otp/request', {
        method: 'POST',
        locale,
        body: { marketCode: MARKET_CODE, phone, locale },
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
        body: { marketCode: MARKET_CODE, phone, code, role: 'supplier', locale },
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
            <button className="btn-primary btn-block btn-huge" onClick={requestCode} disabled={busy || phone.length < 6}>
              {t('signin.sendCode')}
            </button>
          </>
        ) : (
          <>
            <div className="banner banner-info">{t('signin.sent', { phone })}</div>
            {/* Development only: the API echoes the code so nobody waits on an SMS
                provider that is deliberately not integrated yet. */}
            {devCode !== null && <div className="banner banner-warn">dev code: {devCode}</div>}
            <div className="field">
              <label className="field-label" htmlFor="code">
                {t('signin.code')}
              </label>
              <input
                id="code"
                className="price-display"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
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
