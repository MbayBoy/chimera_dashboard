/**
 * Draft persistence.
 *
 * A tablet locks, a call comes in, someone walks away mid-quote. Any
 * half-finished response survives the app being backgrounded or the device
 * sleeping — losing a half-typed price is how ninety seconds becomes three
 * minutes and then becomes a lost job.
 */

const PREFIX = 'ninety.terminal.draft.';

export interface QuoteDraft {
  price: string;
  condition: 'used' | 'refurbished' | 'new';
  conditionGrade: 'good' | 'excellent';
  warrantyDays: number;
  readyInMin: number;
  notes: string;
  photos: string[];
  updatedAt: string;
}

export function emptyDraft(): QuoteDraft {
  return {
    price: '',
    condition: 'used',
    conditionGrade: 'good',
    warrantyDays: 30,
    readyInMin: 15,
    notes: '',
    photos: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadDraft(requestId: string): QuoteDraft {
  try {
    const raw = localStorage.getItem(PREFIX + requestId);
    return raw === null ? emptyDraft() : { ...emptyDraft(), ...(JSON.parse(raw) as QuoteDraft) };
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(requestId: string, draft: QuoteDraft): void {
  try {
    localStorage.setItem(PREFIX + requestId, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    /* storage unavailable; the in-memory draft still works for this session */
  }
}

export function clearDraft(requestId: string): void {
  try {
    localStorage.removeItem(PREFIX + requestId);
  } catch {
    /* nothing to do */
  }
}

export function hasDraft(requestId: string): boolean {
  try {
    const raw = localStorage.getItem(PREFIX + requestId);
    if (raw === null) return false;
    const draft = JSON.parse(raw) as QuoteDraft;
    return draft.price.trim() !== '' || draft.photos.length > 0 || draft.notes.trim() !== '';
  } catch {
    return false;
  }
}
