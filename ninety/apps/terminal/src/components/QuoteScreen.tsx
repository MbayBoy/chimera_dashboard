import { useEffect, useMemo, useRef, useState } from 'react';
import { findContactDetails } from '@ninety/shared';
import { Countdown } from './Countdown.js';
import { Keypad } from './Keypad.js';
import { Toggles } from './Toggles.js';
import { translate, formatMoney, type Language } from '../lib/i18n.js';
import { clearDraft, loadDraft, saveDraft, type QuoteDraft } from '../lib/draft.js';
import { enqueue } from '../lib/queue.js';
import type { LiveRequest } from '../lib/api.js';

/**
 * The 90-second screen.
 *
 * Everything on one screen; no wizard, no steps. Photograph first, price second
 * — that is the physical order at a shelf. Every other field is a preset toggle.
 *
 * The whole submission is queued locally first and flushed by the outbox, so a
 * connection that drops between the tap and the server never loses a quote. The
 * operator is told which state it is in rather than being left to guess.
 */

export interface QuoteScreenProps {
  readonly job: LiveRequest;
  readonly language: Language;
  readonly currency: string;
  readonly commissionRate: number;
  readonly onDone: () => void;
  readonly onCancel: () => void;
  readonly online: boolean;
}

export function QuoteScreen({
  job,
  language,
  currency,
  commissionRate,
  onDone,
  onCancel,
  online,
}: QuoteScreenProps): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [draft, setDraft] = useState<QuoteDraft>(() => loadDraft(job.requestId));
  const [error, setError] = useState<string | null>(null);
  const [scrubIssues, setScrubIssues] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  // Persisted on every change: the tablet locking mid-quote must not lose it.
  useEffect(() => {
    saveDraft(job.requestId, draft);
  }, [job.requestId, draft]);

  const patch = (next: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...next }));

  const priceMinor = useMemo(() => {
    const parsed = Number.parseFloat(draft.price);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [draft.price]);

  const payoutMinor = Math.max(0, priceMinor - Math.round(priceMinor * commissionRate));

  const capturePhoto = async (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    const file = files[0]!;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    patch({ photos: [...draft.photos, dataUrl].slice(0, 4) });
  };

  const submit = () => {
    setError(null);
    setScrubIssues([]);

    if (priceMinor <= 0) {
      setError(t('errors.priceRequired'));
      return;
    }
    if (draft.photos.length === 0) {
      setError(t('errors.photoRequired'));
      return;
    }

    /*
     * Contact details are checked here as well as on the server.
     *
     * Not as a security measure — the server is the authority — but because a
     * rejection that arrives after the submission has been queued and flushed is
     * confusing, and the supplier needs to understand WHY it was rejected rather
     * than watch their note vanish. Rejected, never silently mangled.
     */
    const scrub = findContactDetails(draft.notes);
    if (!scrub.clean) {
      setError(t('errors.contactDetails'));
      setScrubIssues(scrub.violations.map((v) => v.fragment));
      return;
    }

    setSubmitting(true);
    enqueue({
      id: `${job.requestId}:offer`,
      kind: 'offer',
      requestId: job.requestId,
      path: `/v1/supplier/requests/${job.requestId}/offer`,
      method: 'POST',
      body: {
        price: draft.price,
        condition: draft.condition,
        warrantyDays: draft.warrantyDays,
        readyInMin: draft.readyInMin,
        notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
      },
      photos: draft.photos,
      // Response time is measured from here, not from whenever the network
      // recovered. A yard that answered in forty seconds during an outage
      // deserves to be credited with forty seconds.
      composedAt: new Date().toISOString(),
    });
    clearDraft(job.requestId);
    setSubmitting(false);
    onDone();
  };

  return (
    <div className="content">
      <div className="quote">
        <div className="job-head">
          <button className="btn" onClick={onCancel} aria-label={t('quote.back')}>
            <span className="icon-back">←</span> {t('quote.back')}
          </button>
          <Countdown deadline={job.responseDeadline} />
        </div>

        <div>
          {job.vehicle !== null && (
            <div className="job-vehicle">
              {job.vehicle.make} {job.vehicle.model} {job.vehicle.variant ?? ''} — {job.vehicle.year}
            </div>
          )}
          <div className="job-part">{job.part.name}</div>
          {job.distanceKm !== null && <div className="job-meta">{t('requests.away', { km: job.distanceKm })}</div>}
        </div>

        {job.media.length > 0 && (
          <div className="thumbs">
            {job.media.map((m) => (
              <img key={m.url} className="thumb" src={m.url} alt="" />
            ))}
          </div>
        )}

        {error !== null && (
          <div className="banner banner-error">
            {error}
            {scrubIssues.length > 0 && (
              <ul>
                {scrubIssues.map((fragment) => (
                  <li key={fragment}>{fragment}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Photograph first: that is the order the hands do it in at a shelf. */}
        <div className="field">
          <button className="camera-button" onClick={() => cameraRef.current?.click()}>
            <span>📷 {t('quote.takePhoto')}</span>
            <span className="camera-hint">{t('quote.photoHint')}</span>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            // `capture` opens the rear camera directly rather than a file picker:
            // one tap from the list to a viewfinder.
            capture="environment"
            hidden
            onChange={(e) => void capturePhoto(e.target.files)}
          />
          {draft.photos.length > 0 && (
            <div className="thumbs">
              {draft.photos.map((photo, index) => (
                <img
                  key={photo.slice(-24)}
                  className="thumb"
                  src={photo}
                  alt=""
                  onClick={() => patch({ photos: draft.photos.filter((_, i) => i !== index) })}
                />
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <span className="field-label">{t('quote.price', { currency })}</span>
          <div className="price-display">{draft.price}</div>
          <Keypad value={draft.price} onChange={(price) => patch({ price })} language={language} />
          {priceMinor > 0 && (
            <div className="payout">
              {t('quote.yourPayout', { amount: formatMoney(language, payoutMinor, currency) })}
            </div>
          )}
        </div>

        <Toggles
          label={t('quote.condition')}
          selected={draft.conditionGrade === 'excellent' ? 'excellent' : draft.condition === 'refurbished' ? 'refurbished' : 'good'}
          onSelect={(value) => {
            if (value === 'refurbished') patch({ condition: 'refurbished', conditionGrade: 'good' });
            else patch({ condition: 'used', conditionGrade: value === 'excellent' ? 'excellent' : 'good' });
          }}
          options={[
            { value: 'good', label: t('quote.good') },
            { value: 'excellent', label: t('quote.excellent') },
            { value: 'refurbished', label: t('quote.refurbished') },
          ]}
        />

        <Toggles
          label={t('quote.warranty')}
          selected={draft.warrantyDays}
          onSelect={(warrantyDays) => patch({ warrantyDays })}
          options={[
            { value: 0, label: t('quote.none') },
            { value: 30, label: t('quote.days30') },
            { value: 90, label: t('quote.days90') },
            { value: 180, label: t('quote.days180') },
          ]}
        />

        <Toggles
          label={t('quote.readyIn')}
          selected={draft.readyInMin}
          onSelect={(readyInMin) => patch({ readyInMin })}
          options={[
            { value: 0, label: t('quote.now') },
            { value: 15, label: t('quote.min15') },
            { value: 60, label: t('quote.hour1') },
            { value: 480, label: t('quote.today') },
          ]}
        />

        <div className="field">
          <label className="field-label" htmlFor="notes">
            {t('quote.note')}
          </label>
          <textarea
            id="notes"
            value={draft.notes}
            placeholder={t('quote.notePlaceholder')}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>

        {!online && <div className="banner banner-warn">{t('quote.queued')}</div>}

        <button className="btn-primary btn-block btn-huge" onClick={submit} disabled={submitting}>
          {submitting ? t('quote.submitting') : t('quote.submit')}
        </button>
      </div>
    </div>
  );
}
