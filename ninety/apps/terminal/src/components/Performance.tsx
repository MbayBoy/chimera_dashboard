import { translate, formatMoney, formatNumber, type Language } from '../lib/i18n.js';
import type { Performance as PerformanceData } from '../lib/api.js';

/**
 * Performance — a commercial instrument, not a report.
 *
 * The whole supply-side incentive rests on a yard understanding that answering
 * faster earns more. So the score, the rank and the money sit on one screen, and
 * the link between them is stated in words rather than left to be inferred.
 */
export function Performance({
  data,
  language,
}: {
  data: PerformanceData | null;
  language: Language;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  if (data === null) return <div className="empty">…</div>;

  const median = data.medianResponseSeconds;
  const medianLabel =
    median === null
      ? '—'
      : median < 60
        ? `${formatNumber(language, median)}s`
        : `${formatNumber(language, Math.floor(median / 60))}m ${formatNumber(language, median % 60)}s`;

  return (
    <div className="quote">
      <div className="stat" style={{ textAlign: 'center' }}>
        <div className="stat-label">{t('performance.score')}</div>
        <div className="stat-value score-big">{formatNumber(language, data.score, { minimumFractionDigits: 1 })}</div>
        {data.rank !== null && (
          <div className="job-meta">{t('performance.rank', { rank: data.rank, total: data.cityTotal })}</div>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">{t('performance.responseRate')}</div>
          <div className="stat-value">
            {data.responseRate30d === null ? '—' : formatNumber(language, data.responseRate30d, { style: 'percent' })}
          </div>
          <div className="job-meta">{t('performance.last30')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('performance.medianResponse')}</div>
          <div className="stat-value">{medianLabel}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('performance.jobsWon')}</div>
          <div className="stat-value">{formatNumber(language, data.jobsWon)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('performance.earned')}</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {formatMoney(language, data.earnedCents, data.currency)}
          </div>
        </div>
      </div>

      {/* Said out loud, on the screen that shows the number. A score nobody
          connects to money changes nobody's behaviour. */}
      <div className="banner banner-info">{t('performance.incentive')}</div>
    </div>
  );
}
