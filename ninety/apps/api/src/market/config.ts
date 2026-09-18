import { eq } from 'drizzle-orm';
import type { MarketConfig } from '@ninety/shared';
import { getDb } from '../db/client.js';
import { markets, marketConfigAudit } from '../db/schema.js';
import { getRedis } from '../core/redis.js';
import { log } from '../core/logger.js';
import { key, namespacePrefix } from '../core/keys.js';
import { notFound } from '../core/errors.js';

/**
 * Market configuration.
 *
 * Every rate, SLA, currency, tax rate, locale and flag in this product is read
 * from the `markets` table through this service. Nothing in application code
 * knows what a market's commission rate is; it knows how to ask.
 *
 * Changing a rate is an UPDATE and a cache invalidation. No deploy, no restart,
 * and — because `market_config_audit` records it — always an answer to "who
 * changed the commission rate and when".
 */

const CACHE_TTL_SECONDS = 300;

function cacheKey(suffix: string): string {
  return key('market:config', suffix);
}

/** Editable through the admin market editor. Anything not here needs a migration. */
export const EDITABLE_MARKET_FIELDS = [
  'commissionRate',
  'buyerFeeRate',
  'deliveryMarkupRate',
  'taxRate',
  'taxLabel',
  'taxInclusive',
  'slaResponseMin',
  'slaOffersMin',
  'slaDeliveryMin',
  'selectionWindowMin',
  'wideningWindowMin',
  'autoConfirmHours',
  'isLive',
  'courierProviders',
  'paymentProvider',
  'localesSupported',
  'localeDefault',
] as const;

export type EditableMarketField = (typeof EDITABLE_MARKET_FIELDS)[number];

type MarketRow = typeof markets.$inferSelect;

function toConfig(row: MarketRow, rtl: boolean): MarketConfig {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    currency: row.currency,
    currencyMinorUnitExponent: row.currencyMinorUnitExp,
    locales: row.localesSupported,
    localeDefault: row.localeDefault,
    rtl,
    timezone: row.timezone,
    vehicleIdentifier: { type: row.vehicleIdType as 'vin' | 'chassis', regex: row.vehicleIdRegex },
    paymentProvider: row.paymentProvider,
    courierProviders: row.courierProviders,
    tax: { rate: Number(row.taxRate), label: row.taxLabel, inclusive: row.taxInclusive },
    sla: { responseMin: row.slaResponseMin, offersMin: row.slaOffersMin, deliveryMin: row.slaDeliveryMin },
    fees: {
      commissionRate: Number(row.commissionRate),
      buyerFeeRate: Number(row.buyerFeeRate),
      deliveryMarkupRate: Number(row.deliveryMarkupRate),
    },
    addressModel: row.addressModel as 'street' | 'makani' | 'hybrid',
    businessCalendar: { weekendDays: row.weekendDays, holidays: row.holidays },
    isLive: row.isLive,
  };
}

/** Extra windows that are market configuration but not part of the shared contract. */
export interface MarketWindows {
  readonly selectionWindowMin: number;
  readonly wideningWindowMin: number;
  readonly autoConfirmHours: number;
}

export class MarketConfigService {
  /** Resolve by primary key — the path taken for every authenticated request. */
  async byId(marketId: string): Promise<MarketConfig> {
    const cached = await this.readCache(`id:${marketId}`);
    if (cached) return cached;
    const rows = await getDb().select().from(markets).where(eq(markets.id, marketId)).limit(1);
    const row = rows[0];
    if (!row) throw notFound('error.not_found');
    const config = toConfig(row, await this.isRtl(row));
    await this.writeCache(`id:${marketId}`, config);
    await this.writeCache(`code:${row.code}`, config);
    return config;
  }

  async byCode(code: string): Promise<MarketConfig> {
    const cached = await this.readCache(`code:${code}`);
    if (cached) return cached;
    const rows = await getDb().select().from(markets).where(eq(markets.code, code)).limit(1);
    const row = rows[0];
    if (!row) throw notFound('error.not_found');
    const config = toConfig(row, await this.isRtl(row));
    await this.writeCache(`code:${code}`, config);
    await this.writeCache(`id:${row.id}`, config);
    return config;
  }

  async all(): Promise<MarketConfig[]> {
    const rows = await getDb().select().from(markets);
    const out: MarketConfig[] = [];
    for (const row of rows) out.push(toConfig(row, await this.isRtl(row)));
    return out;
  }

  async windows(marketId: string): Promise<MarketWindows> {
    const rows = await getDb()
      .select({
        selectionWindowMin: markets.selectionWindowMin,
        wideningWindowMin: markets.wideningWindowMin,
        autoConfirmHours: markets.autoConfirmHours,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('error.not_found');
    return row;
  }

  /**
   * Apply an admin edit. Every change is audited and the cache is invalidated
   * explicitly rather than left to expire — an admin who changes a rate and
   * watches nothing happen for five minutes stops trusting the editor.
   */
  async update(
    marketId: string,
    changes: Partial<Record<EditableMarketField, unknown>>,
    context: { adminId: string; reason: string },
  ): Promise<MarketConfig> {
    const db = getDb();
    const before = (await db.select().from(markets).where(eq(markets.id, marketId)).limit(1))[0];
    if (!before) throw notFound('error.not_found');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const auditRows: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    for (const [field, value] of Object.entries(changes)) {
      if (!EDITABLE_MARKET_FIELDS.includes(field as EditableMarketField)) continue;
      const previous = (before as unknown as Record<string, unknown>)[field];
      if (String(previous) === String(value)) continue;
      patch[field] = value;
      auditRows.push({ field, oldValue: previous === null ? null : String(previous), newValue: value === null ? null : String(value) });
    }
    if (auditRows.length === 0) return this.byId(marketId);

    await db.update(markets).set(patch).where(eq(markets.id, marketId));
    await db.insert(marketConfigAudit).values(
      auditRows.map((r) => ({
        marketId,
        changedBy: context.adminId,
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
        reason: context.reason,
      })),
    );
    await this.invalidate(marketId, before.code);
    log.info('market configuration changed', {
      marketId,
      adminId: context.adminId,
      fields: auditRows.map((r) => r.field),
      reason: context.reason,
    });
    return this.byId(marketId);
  }

  async invalidate(marketId: string, code?: string): Promise<void> {
    const redis = getRedis();
    await redis.del(cacheKey(`id:${marketId}`));
    if (code) await redis.del(cacheKey(`code:${code}`));
  }

  async invalidateAll(): Promise<void> {
    const redis = getRedis();
    const keys = await redis.keys(`${namespacePrefix()}market:config:*`);
    if (keys.length > 0) await redis.del(...keys);
  }

  private async isRtl(row: MarketRow): Promise<boolean> {
    const { isRtlLocale } = await import('../i18n/index.js');
    return isRtlLocale(row.localeDefault);
  }

  private async readCache(suffix: string): Promise<MarketConfig | null> {
    try {
      const raw = await getRedis().get(cacheKey(suffix));
      return raw === null ? null : (JSON.parse(raw) as MarketConfig);
    } catch (err) {
      // A cache miss caused by an unreachable Redis must not fail the request.
      log.warn('market config cache read failed', { err: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private async writeCache(suffix: string, config: MarketConfig): Promise<void> {
    try {
      await getRedis().set(cacheKey(suffix), JSON.stringify(config), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      log.warn('market config cache write failed', { err: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const marketConfig = new MarketConfigService();
