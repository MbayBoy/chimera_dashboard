import { useEffect, useState } from 'react';
import { translate, formatNumber, type Language } from '../lib/i18n.js';
import { fetchStockProfile, saveStockProfile, type StockProfile as Profile } from '../lib/api.js';

/**
 * The stock profile.
 *
 * This decides which jobs reach this terminal, so it is framed in those terms
 * rather than as settings: a badly configured profile produces irrelevant
 * alerts, and irrelevant alerts are how a terminal stops being watched.
 *
 * Nothing here is a dropdown. Makes and categories are chips, the radius is a
 * slider, and an empty selection means "everything" rather than "nothing" —
 * because a half-configured profile is the common case on a busy counter and it
 * should not silently exclude the yard from all work.
 */
export function StockProfile({
  token,
  locale,
  language,
}: {
  token: string;
  locale: string;
  language: Language;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [options, setOptions] = useState<{ makes: string[]; categories: { code: string; name: string }[] }>({
    makes: [],
    categories: [],
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchStockProfile(token, locale).then((result) => {
      setProfile(result.profile);
      setOptions(result.options);
    });
  }, [token, locale]);

  if (profile === null) return <div className="empty">…</div>;

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const save = async () => {
    setBusy(true);
    await saveStockProfile(token, locale, profile);
    setSaved(true);
    setBusy(false);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="quote">
      <h1>{t('stock.title')}</h1>
      <p style={{ color: 'var(--text-dim)' }}>{t('stock.subtitle')}</p>

      <div className="field">
        <span className="field-label">{t('stock.makes')}</span>
        <div className="toggles">
          {options.makes.map((make) => (
            <button
              key={make}
              type="button"
              className="toggle"
              aria-pressed={profile.makes.includes(make)}
              onClick={() => setProfile({ ...profile, makes: toggle(profile.makes, make) })}
            >
              {make}
            </button>
          ))}
        </div>
        {profile.makes.length === 0 && <div className="job-meta">{t('stock.allMakes')}</div>}
      </div>

      <div className="field">
        <span className="field-label">{t('stock.categories')}</span>
        <div className="toggles">
          {options.categories.map((category) => (
            <button
              key={category.code}
              type="button"
              className="toggle"
              aria-pressed={profile.partCategories.includes(category.code)}
              onClick={() => setProfile({ ...profile, partCategories: toggle(profile.partCategories, category.code) })}
            >
              {category.name}
            </button>
          ))}
        </div>
        {profile.partCategories.length === 0 && <div className="job-meta">{t('stock.allCategories')}</div>}
      </div>

      <div className="field">
        <span className="field-label">{t('stock.years')}</span>
        <div className="toggles">
          <input
            className="price-display"
            style={{ fontSize: '1.4rem' }}
            type="number"
            inputMode="numeric"
            placeholder={t('stock.from')}
            value={profile.yearFrom ?? ''}
            onChange={(e) => setProfile({ ...profile, yearFrom: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <input
            className="price-display"
            style={{ fontSize: '1.4rem' }}
            type="number"
            inputMode="numeric"
            placeholder={t('stock.to')}
            value={profile.yearTo ?? ''}
            onChange={(e) => setProfile({ ...profile, yearTo: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="field">
        <span className="field-label">{t('stock.radius')}</span>
        <div className="stat-value">{t('stock.radiusValue', { km: formatNumber(language, profile.maxRadiusKm) })}</div>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={profile.maxRadiusKm}
          onChange={(e) => setProfile({ ...profile, maxRadiusKm: Number(e.target.value) })}
          style={{ minHeight: 'var(--tap)', width: '100%' }}
        />
      </div>

      <button className="btn-primary btn-block btn-huge" onClick={() => void save()} disabled={busy}>
        {saved ? t('stock.saved') : t('stock.save')}
      </button>
    </div>
  );
}
