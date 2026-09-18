import { Countdown } from './Countdown.js';
import { translate, type Language } from '../lib/i18n.js';
import { countdownTo, serverNow } from '../lib/clock.js';
import type { LiveRequest } from '../lib/api.js';

/**
 * The live list — the only screen most operators ever see.
 *
 * Soonest-expiring first, because a job with two minutes left deserves more
 * attention than one with twelve and the operator should not have to work that
 * out. The countdown carries the urgency in colour so the state of the counter
 * reads from across a yard.
 */
export function RequestList({
  jobs,
  language,
  onQuote,
  onDecline,
}: {
  jobs: readonly LiveRequest[];
  language: Language;
  onQuote: (job: LiveRequest) => void;
  onDecline: (job: LiveRequest) => void;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  if (jobs.length === 0) {
    return (
      <div className="empty">
        <h2>{t('requests.empty')}</h2>
        <p>{t('requests.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="jobs">
      {jobs.map((job) => {
        const countdown = countdownTo(job.responseDeadline, serverNow());
        return (
          <article key={job.requestId} className={`job ${countdown.urgency}`}>
            <div className="job-head">
              <span className="job-ref">{job.reference}</span>
              <Countdown deadline={job.responseDeadline} />
            </div>

            {job.vehicle !== null && (
              <div className="job-vehicle">
                {job.vehicle.make} {job.vehicle.model} {job.vehicle.variant ?? ''} {job.vehicle.year}
              </div>
            )}
            <div className="job-part">{job.part.name}</div>

            {job.media.length > 0 && (
              <div className="thumbs">
                {job.media.slice(0, 3).map((m) => (
                  <img key={m.url} className="thumb" src={m.url} alt="" loading="lazy" />
                ))}
              </div>
            )}

            <div className="job-meta">
              {/* Distance, never a direction. The buyer's location is not ours to reveal. */}
              {job.distanceKm !== null && t('requests.away', { km: job.distanceKm })}
              {job.tier === 2 && ` · ${t('requests.tier2')}`}
            </div>

            {countdown.expired ? (
              <div className="banner banner-warn">{t('requests.expired')}</div>
            ) : job.alreadyOffered ? (
              <div className="banner banner-info">{t('requests.quoted')}</div>
            ) : (
              <div className="job-actions">
                <button className="btn-primary btn-huge" onClick={() => onQuote(job)}>
                  {t('requests.quote')}
                </button>
                <button className="btn-danger btn-huge" onClick={() => onDecline(job)}>
                  {t('requests.decline')}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
