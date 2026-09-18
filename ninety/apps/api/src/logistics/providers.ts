import { randomUUID } from 'node:crypto';
import { PARCEL_CLASS_WEIGHT, type CourierTrackingStatus, type DeliveryRef, type Quote } from '@ninety/shared';
import type { CourierProvider, DispatchRequest, QuoteRequest } from './provider.js';
import { log } from '../core/logger.js';

/**
 * Courier implementations.
 *
 * Two on-demand providers plus a manual fallback. The two on-demand ones are
 * written against a common HTTP shape and configured per deployment: the UAE
 * parcel market moves quickly enough that hardcoding today's vendor list would
 * be wrong within a quarter, and the phase document says to confirm current APIs
 * at build time rather than trusting any list written in advance.
 *
 * Until real credentials are configured, each behaves as a deterministic
 * simulator so the dispatch logic — parallel quoting, ETA-first selection,
 * five-minute failover, ops escalation — is exercised end to end. What is NOT
 * simulated is the decision-making: that is the real code path in service.ts.
 */

export interface HttpCourierConfig {
  readonly name: string;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  /** Simulation knobs, used only when no baseUrl is configured. */
  readonly simulate?: {
    readonly baseCents: number;
    readonly perKmCents: number;
    readonly baseEtaMinutes: number;
    readonly perKmMinutes: number;
    /** 0–1. Fraction of dispatches where no driver is ever assigned. */
    readonly noDriverRate?: number;
    /** 0–1. Fraction of quote calls that fail outright. */
    readonly quoteFailureRate?: number;
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deterministic pseudo-randomness, so a simulated run is reproducible. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export class HttpCourierProvider implements CourierProvider {
  readonly automatic = true;
  readonly name: string;
  private readonly config: HttpCourierConfig;
  private readonly dispatched = new Map<string, { at: number; driverAssigned: boolean; etaMinutes: number; costCents: number }>();

  constructor(config: HttpCourierConfig) {
    this.name = config.name;
    this.config = config;
  }

  private get live(): boolean {
    return this.config.baseUrl !== undefined && this.config.baseUrl !== '';
  }

  async quote(request: QuoteRequest): Promise<Quote> {
    const distanceKm = haversineKm(request.pickup, request.dropoff);
    if (this.live) return this.liveQuote(request, distanceKm);

    const sim = this.config.simulate!;
    const roll = seeded(`${this.name}:quote:${request.pickup.lat}:${request.dropoff.lng}:${request.parcel}`);
    if (sim.quoteFailureRate !== undefined && roll < sim.quoteFailureRate) {
      throw new Error(`${this.name} quote unavailable`);
    }

    // Parcel class is applied to the price, not ignored. A tail lamp is a bike
    // delivery; a gearbox is a van, and quoting both as a small parcel is how
    // courier margin goes wrong on exactly the high-value orders.
    const weight = PARCEL_CLASS_WEIGHT[request.parcel];
    const priceCents = Math.round((sim.baseCents + sim.perKmCents * distanceKm) * weight);
    const etaMinutes = Math.round(sim.baseEtaMinutes + sim.perKmMinutes * distanceKm + (weight - 1) * 8);

    return {
      provider: this.name,
      priceCents,
      etaMinutes,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      providerQuoteRef: `${this.name}-q-${randomUUID().slice(0, 8)}`,
    };
  }

  private async liveQuote(request: QuoteRequest, distanceKm: number): Promise<Quote> {
    const res = await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey ?? ''}` },
      body: JSON.stringify({
        pickup: request.pickup,
        dropoff: request.dropoff,
        parcel_class: request.parcel,
        currency: request.currency,
        distance_km: Number(distanceKm.toFixed(2)),
      }),
    });
    if (!res.ok) throw new Error(`${this.name} quote failed: ${res.status}`);
    const body = (await res.json()) as { price_minor: number; eta_minutes: number; quote_id?: string; expires_in_seconds?: number };
    return {
      provider: this.name,
      priceCents: body.price_minor,
      etaMinutes: body.eta_minutes,
      expiresAt: new Date(Date.now() + (body.expires_in_seconds ?? 600) * 1000),
      providerQuoteRef: body.quote_id ?? null,
    };
  }

  async dispatch(request: DispatchRequest): Promise<DeliveryRef> {
    if (this.live) {
      const res = await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey ?? ''}` },
        body: JSON.stringify({
          reference: request.orderReference,
          pickup: { ...request.pickup, instructions: request.pickupInstructions },
          dropoff: { ...request.dropoff, instructions: request.dropoffInstructions },
          parcel_class: request.parcel,
        }),
      });
      if (!res.ok) throw new Error(`${this.name} dispatch failed: ${res.status}`);
      const body = (await res.json()) as { delivery_id: string };
      return { provider: this.name, providerRef: body.delivery_id };
    }

    const sim = this.config.simulate!;
    const ref = `${this.name}-d-${randomUUID().slice(0, 8)}`;
    const roll = seeded(`${this.name}:dispatch:${request.orderId}`);
    const driverAssigned = sim.noDriverRate === undefined || roll >= sim.noDriverRate;
    const distanceKm = haversineKm(request.pickup, request.dropoff);
    this.dispatched.set(ref, {
      at: Date.now(),
      driverAssigned,
      etaMinutes: Math.round(sim.baseEtaMinutes + sim.perKmMinutes * distanceKm),
      costCents: Math.round((sim.baseCents + sim.perKmCents * distanceKm) * PARCEL_CLASS_WEIGHT[request.parcel]),
    });
    log.info('courier dispatch accepted', { provider: this.name, ref, driverWillBeAssigned: driverAssigned });
    return { provider: this.name, providerRef: ref };
  }

  async track(ref: string): Promise<CourierTrackingStatus> {
    if (this.live) {
      const res = await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/deliveries/${ref}`, {
        headers: { authorization: `Bearer ${this.config.apiKey ?? ''}` },
      });
      if (!res.ok) throw new Error(`${this.name} track failed: ${res.status}`);
      const body = (await res.json()) as {
        status: CourierTrackingStatus['status'];
        driver_assigned: boolean;
        eta_minutes: number | null;
        proof_url: string | null;
        failure_reason: string | null;
        actual_minor: number | null;
      };
      return {
        provider: this.name,
        providerRef: ref,
        status: body.status,
        driverAssigned: body.driver_assigned,
        etaMinutes: body.eta_minutes,
        proofUrl: body.proof_url,
        failureReason: body.failure_reason,
        actualCents: body.actual_minor,
      };
    }

    const state = this.dispatched.get(ref);
    if (state === undefined) {
      return { provider: this.name, providerRef: ref, status: 'cancelled', driverAssigned: false, etaMinutes: null, proofUrl: null, failureReason: 'unknown reference', actualCents: null };
    }
    return {
      provider: this.name,
      providerRef: ref,
      status: state.driverAssigned ? 'driver_assigned' : 'pending',
      driverAssigned: state.driverAssigned,
      etaMinutes: state.etaMinutes,
      proofUrl: null,
      failureReason: null,
      actualCents: state.costCents,
    };
  }

  async cancel(ref: string): Promise<void> {
    if (this.live) {
      await fetch(`${this.config.baseUrl!.replace(/\/$/, '')}/deliveries/${ref}/cancel`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.apiKey ?? ''}` },
      });
      return;
    }
    this.dispatched.delete(ref);
  }
}

/**
 * The manual fallback.
 *
 * When every automatic provider has failed, a person picks it up. That is the
 * system working, not the system failing — and the buyer being told honestly is
 * what protects the relationship.
 */
export class ManualCourierProvider implements CourierProvider {
  readonly name = 'manual';
  readonly automatic = false;

  async quote(request: QuoteRequest): Promise<Quote> {
    // A placeholder price so the order still reconciles. Ops replaces it with
    // the real cost when the delivery completes.
    const distanceKm = haversineKm(request.pickup, request.dropoff);
    return {
      provider: this.name,
      priceCents: Math.round(3000 + 120 * distanceKm),
      etaMinutes: 180,
      expiresAt: new Date(Date.now() + 60 * 60_000),
      providerQuoteRef: null,
    };
  }

  async dispatch(request: DispatchRequest): Promise<DeliveryRef> {
    return { provider: this.name, providerRef: `manual-${request.orderId}` };
  }

  async track(ref: string): Promise<CourierTrackingStatus> {
    // A human is driving this. Status changes come from the ops console.
    return {
      provider: this.name,
      providerRef: ref,
      status: 'pending',
      driverAssigned: false,
      etaMinutes: null,
      proofUrl: null,
      failureReason: null,
      actualCents: null,
    };
  }

  async cancel(): Promise<void> {
    /* ops cancels a manual delivery in the console */
  }
}
