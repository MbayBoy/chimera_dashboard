import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { authenticate } from '../auth/guards.js';
import { getVehicleDecoder, isPlausibleIdentifier, normaliseIdentifier } from './decoder.js';
import { getDb } from '../db/client.js';
import { partCategories, vehicles } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { languageOf } from '../i18n/index.js';

export async function registerVehicleRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Decode a chassis number or VIN.
   *
   * A miss is a 200 with `match: null`, not a 404. The buyer app treats a scan as
   * a convenience and falls straight through to make/model/year, and turning a
   * normal outcome into an error would make it look like something broke.
   */
  app.get('/v1/vehicles/decode', { preHandler: authenticate }, async (req, reply) => {
    const query = z.object({ identifier: z.string().trim().min(3).max(32) }).parse(req.query);
    const market = req.ctx.market!;
    const identifier = normaliseIdentifier(query.identifier);

    if (!isPlausibleIdentifier(identifier, market)) {
      return reply.send({
        match: null,
        identifierType: market.vehicleIdentifier.type,
        plausible: false,
        messageKey: 'error.invalid_vehicle_identifier',
      });
    }

    const match = await getVehicleDecoder().decode(identifier, market);
    return reply.send({ match, identifierType: market.vehicleIdentifier.type, plausible: true });
  });

  /** The catalogue the buyer app and the terminal both browse. */
  app.get('/v1/vehicles/makes', { preHandler: authenticate }, async (_req, reply) => {
    const rows = await getDb().selectDistinct({ make: vehicles.make }).from(vehicles).orderBy(vehicles.make);
    return reply.send({ makes: rows.map((r) => r.make) });
  });

  app.get('/v1/vehicles/models', { preHandler: authenticate }, async (req, reply) => {
    const query = z.object({ make: z.string().trim().min(1) }).parse(req.query);
    const rows = await getDb()
      .selectDistinct({ model: vehicles.model })
      .from(vehicles)
      .where(sql`lower(${vehicles.make}) = lower(${query.make})`)
      .orderBy(vehicles.model);
    return reply.send({ models: rows.map((r) => r.model) });
  });

  app.get('/v1/part-categories', { preHandler: authenticate }, async (req, reply) => {
    const language = languageOf(req.ctx.locale);
    const rows = await getDb().select().from(partCategories).orderBy(partCategories.sortOrder);
    return reply.send({
      categories: rows.map((row) => ({
        id: row.id,
        code: row.code,
        parentId: row.parentId,
        // Resolved server-side against the caller's language, so a client never
        // has to ship a copy of the catalogue in two languages.
        name: row.nameI18n[language] ?? row.nameI18n.en ?? row.code,
        parcelClass: row.parcelClass,
        highValue: row.highValue,
      })),
    });
  });

  app.get('/v1/part-categories/:id', { preHandler: authenticate }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const language = languageOf(req.ctx.locale);
    const rows = await getDb().select().from(partCategories).where(eq(partCategories.id, params.id)).limit(1);
    const row = rows[0];
    if (!row) throw new AppError('not_found', 'error.not_found');
    return reply.send({
      id: row.id,
      code: row.code,
      name: row.nameI18n[language] ?? row.nameI18n.en ?? row.code,
      parcelClass: row.parcelClass,
      highValue: row.highValue,
    });
  });
}
