import { describe, expect, it } from 'vitest';
import type { AnonymisableOffer } from '@ninety/shared';
import { FORBIDDEN_BUYER_FIELDS, sortOffers, toBuyerView, toBuyerViews } from './to-buyer-view.js';

/**
 * The leak test.
 *
 * It asserts against the WHOLE serialised payload, not against the fields we
 * expected to be absent. `expect(response.supplierName).toBeUndefined()` passes
 * happily while `response.offer.meta.yard` sits right there — and a leak in an
 * unexpected key is exactly what this is for.
 */

/** A yard, with every identifying detail a real row would carry. */
const YARD = {
  supplierId: '9f2a1c44-0000-4000-8000-000000000001',
  businessName: 'Al Sajaa Auto Dismantlers',
  userId: '9f2a1c44-0000-4000-8000-000000000002',
  phone: '+9999000001',
  email: 'counter@alsajaa.example',
  address: { area: 'Al Sajaa', street: 'Industrial Road 4', city: 'Sharjah' },
  location: { lat: 25.3799, lng: 55.5619 },
  score: 4.6,
};

function offer(overrides: Partial<AnonymisableOffer> = {}): AnonymisableOffer {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    requestId: 'bbbbbbbb-0000-4000-8000-000000000001',
    anonLabel: 'A',
    priceCents: 42_000,
    condition: 'used',
    warrantyDays: 90,
    notes: 'Tested working, small scratch on the lens',
    distanceKm: 8.437,
    readyInMin: 10,
    status: 'submitted',
    createdAt: new Date('2026-03-01T09:15:00Z'),
    media: [{ url: 'http://media.test/ab/cd/abcdef.jpg', kind: 'photo' }],
    ...overrides,
  };
}

describe('toBuyerView', () => {
  it('emits exactly the permitted fields and nothing else', () => {
    const view = toBuyerView(offer(), 'XTS');
    expect(Object.keys(view).sort()).toEqual(
      ['condition', 'currency', 'distanceKm', 'id', 'label', 'media', 'notes', 'priceCents', 'readyInMin', 'receivedAt', 'warrantyDays'].sort(),
    );
  });

  it('leaks no supplier identity anywhere in the serialised payload', () => {
    // The whole string, not named fields. This is criterion (a) of the phase gate.
    const payload = JSON.stringify({
      request: { id: 'bbbbbbbb-0000-4000-8000-000000000001', status: 'COLLECTING_OFFERS' },
      offers: toBuyerViews([offer(), offer({ id: 'x', anonLabel: 'B', priceCents: 33_500 })], 'XTS'),
    });

    for (const [field, value] of Object.entries(YARD)) {
      const needle = typeof value === 'object' ? JSON.stringify(value) : String(value);
      expect(payload, `payload contains the supplier's ${field}`).not.toContain(needle);
    }
    // And the individual pieces of the address, not only the whole object.
    for (const fragment of ['Al Sajaa', 'Industrial Road', 'Sharjah', 'alsajaa', '9999000001', '25.3799', '55.5619']) {
      expect(payload, `payload contains "${fragment}"`).not.toContain(fragment);
    }
    // And no key that could carry identity later.
    for (const key of FORBIDDEN_BUYER_FIELDS) {
      expect(payload, `payload contains the key "${key}"`).not.toContain(`"${key}"`);
    }
  });

  it('shows distance and never a direction', () => {
    const view = toBuyerView(offer({ distanceKm: 8.437 }), 'XTS');
    expect(view.distanceKm).toBe(8.4);
    const payload = JSON.stringify(view).toLowerCase();
    for (const word of ['north', 'south', 'east', 'west', 'bearing', 'heading', 'direction']) {
      expect(payload).not.toContain(word);
    }
  });

  it('rounds distance rather than quoting it to the metre', () => {
    // 8.437 km reported exactly, combined with a second offer, narrows a yard's
    // position far more than 8.4 does.
    expect(toBuyerView(offer({ distanceKm: 12.0499 }), 'XTS').distanceKm).toBe(12);
    expect(toBuyerView(offer({ distanceKm: 0.04 }), 'XTS').distanceKm).toBe(0);
  });

  it('cannot be handed a row carrying identity — that is a compile error, and a runtime check too', () => {
    // TypeScript refuses `toBuyerView({...offer(), ...YARD})` because the input
    // type has no such fields. At runtime, excess properties are simply not
    // read: the serialiser only ever copies the fields it names.
    const contaminated = { ...offer(), ...YARD } as unknown as AnonymisableOffer;
    const payload = JSON.stringify(toBuyerView(contaminated, 'XTS'));
    expect(payload).not.toContain('Al Sajaa');
    expect(payload).not.toContain('9999000001');
    expect(payload).not.toContain('4.6');
  });
});

describe('offer ordering', () => {
  const views = toBuyerViews(
    [
      offer({ id: 'a', anonLabel: 'A', priceCents: 42_000, readyInMin: 10, distanceKm: 8.4, warrantyDays: 90 }),
      offer({ id: 'b', anonLabel: 'B', priceCents: 33_500, readyInMin: 25, distanceKm: 14.1, warrantyDays: 30 }),
      offer({ id: 'c', anonLabel: 'C', priceCents: 61_000, readyInMin: 5, distanceKm: 6.2, warrantyDays: 180 }),
    ],
    'XTS',
  );

  it('defaults to price ascending', () => {
    expect(sortOffers(views).map((v) => v.label)).toEqual(['B', 'A', 'C']);
  });

  it('offers soonest, closest and longest warranty as alternatives', () => {
    expect(sortOffers(views, 'soonest').map((v) => v.label)).toEqual(['C', 'A', 'B']);
    expect(sortOffers(views, 'closest').map((v) => v.label)).toEqual(['C', 'A', 'B']);
    expect(sortOffers(views, 'warranty_desc').map((v) => v.label)).toEqual(['C', 'A', 'B']);
  });

  it('hides nothing — the buyer chooses from everything that arrived', () => {
    expect(sortOffers(views)).toHaveLength(views.length);
  });

  it('has no ordering that could rank by supplier score, because score is not in the view', () => {
    // Score governs distribution, never selection. A high-scoring yard charging
    // more and winning on rank is how the price competition dies.
    for (const view of views) {
      expect(view).not.toHaveProperty('score');
      expect(view).not.toHaveProperty('supplierScore');
    }
  });
});
