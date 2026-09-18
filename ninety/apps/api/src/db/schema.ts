import {
  boolean,
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { geographyPoint } from './geography.js';

/**
 * The schema, mirroring src/db/migrations/0001_init.up.sql exactly.
 *
 * The SQL file is the source of truth for DDL — it owns the PostGIS types, the
 * CHECK constraints and the reconciliation constraints on `orders`. This file is
 * the typed view the application queries through. A drift test asserts the two
 * agree on table and column names.
 */

const cents = (name: string) => bigint(name, { mode: 'number' });

export const markets = pgTable('markets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  currencyMinorUnitExp: integer('currency_minor_unit_exp').notNull().default(2),
  localeDefault: text('locale_default').notNull(),
  localesSupported: text('locales_supported').array().notNull(),
  timezone: text('timezone').notNull(),
  vehicleIdType: text('vehicle_id_type').notNull(),
  vehicleIdRegex: text('vehicle_id_regex'),
  paymentProvider: text('payment_provider').notNull(),
  courierProviders: text('courier_providers').array().notNull(),
  taxRate: numeric('tax_rate').notNull(),
  taxLabel: text('tax_label').notNull(),
  taxInclusive: boolean('tax_inclusive').notNull().default(false),
  commissionRate: numeric('commission_rate').notNull(),
  buyerFeeRate: numeric('buyer_fee_rate').notNull(),
  deliveryMarkupRate: numeric('delivery_markup_rate').notNull(),
  slaResponseMin: integer('sla_response_min').notNull(),
  slaOffersMin: integer('sla_offers_min').notNull(),
  slaDeliveryMin: integer('sla_delivery_min').notNull(),
  selectionWindowMin: integer('selection_window_min').notNull(),
  wideningWindowMin: integer('widening_window_min').notNull(),
  autoConfirmHours: integer('auto_confirm_hours').notNull(),
  /** Years a completed sale's financial record is kept, whatever else is erased. */
  financialRetentionYears: integer('financial_retention_years').notNull(),
  addressModel: text('address_model').notNull(),
  weekendDays: integer('weekend_days').array().notNull(),
  holidays: date('holidays').array().notNull(),
  isLive: boolean('is_live').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const marketConfigAudit = pgTable('market_config_audit', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid('market_id').notNull(),
  changedBy: uuid('changed_by'),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid('market_id').notNull(),
  name: text('name').notNull(),
  centroid: geographyPoint('centroid').notNull(),
  radiusKm: integer('radius_km').notNull().default(50),
  isLive: boolean('is_live').notNull().default(false),
  launchDate: date('launch_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    marketId: uuid('market_id').notNull(),
    role: text('role').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    displayName: text('display_name'),
    locale: text('locale'),
    kycStatus: text('kyc_status').notNull().default('pending'),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ marketPhone: uniqueIndex('users_market_id_phone_key').on(t.marketId, t.phone) }),
);

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid('market_id').notNull(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const buyers = pgTable('buyers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().unique(),
  type: text('type').notNull(),
  businessName: text('business_name'),
  taxNumber: text('tax_number'),
  defaultAddress: jsonb('default_address'),
  defaultLocation: geographyPoint('default_location'),
  creditTerms: boolean('credit_terms').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull().unique(),
    cityId: uuid('city_id').notNull(),
    /** INTERNAL ONLY — never reaches a buyer. */
    businessName: text('business_name').notNull(),
    location: geographyPoint('location').notNull(),
    address: jsonb('address').notNull(),
    operatingHours: jsonb('operating_hours').notNull(),
    verified: boolean('verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    payoutDetailsId: uuid('payout_details_id'),
    status: text('status').notNull().default('onboarding'),
    onboardingStage: text('onboarding_stage').notNull().default('signed'),
    onboardingStageAt: timestamp('onboarding_stage_at', { withTimezone: true }).notNull().defaultNow(),
    score: numeric('score').notNull(),
    responseRate: numeric('response_rate').notNull(),
    medianResponseS: integer('median_response_s'),
    fulfilmentRate: numeric('fulfilment_rate').notNull(),
    disputeRate: numeric('dispute_rate').notNull(),
    declineRate: numeric('decline_rate').notNull(),
    stockMatchThreshold: numeric('stock_match_threshold').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ cityStatus: index('suppliers_city_status_idx').on(t.cityId, t.status) }),
);

export const supplierStockProfiles = pgTable('supplier_stock_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  supplierId: uuid('supplier_id').notNull().unique(),
  makes: text('makes').array().notNull(),
  models: text('models').array().notNull(),
  yearFrom: integer('year_from'),
  yearTo: integer('year_to'),
  partCategories: text('part_categories').array().notNull(),
  maxRadiusKm: integer('max_radius_km').notNull().default(50),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplierTablets = pgTable('supplier_tablets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  supplierId: uuid('supplier_id').notNull(),
  serialNumber: text('serial_number').notNull().unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  issuedTo: text('issued_to'),
  status: text('status').notNull().default('deployed'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  notes: text('notes'),
});

export const supplierPresence = pgTable('supplier_presence', {
  supplierId: uuid('supplier_id').primaryKey(),
  online: boolean('online').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastOnlineAt: timestamp('last_online_at', { withTimezone: true }),
  lastOfflineAt: timestamp('last_offline_at', { withTimezone: true }),
  connectionCount: integer('connection_count').notNull().default(0),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  vin: text('vin'),
  make: text('make').notNull(),
  model: text('model').notNull(),
  variant: text('variant'),
  year: integer('year').notNull(),
  bodyType: text('body_type'),
  engineCode: text('engine_code'),
  marketId: uuid('market_id'),
});

export const partCategories = pgTable('part_categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  parentId: uuid('parent_id'),
  nameI18n: jsonb('name_i18n').$type<Record<string, string>>().notNull(),
  parcelClass: text('parcel_class').notNull().default('car'),
  highValue: boolean('high_value').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    reference: text('reference').notNull().unique(),
    buyerId: uuid('buyer_id').notNull(),
    marketId: uuid('market_id').notNull(),
    cityId: uuid('city_id'),
    vehicleId: uuid('vehicle_id'),
    vehicleRaw: jsonb('vehicle_raw').$type<Record<string, unknown>>().notNull(),
    partCategoryId: uuid('part_category_id'),
    partDescription: text('part_description').notNull(),
    conditionAccepted: text('condition_accepted').array().notNull(),
    quantity: integer('quantity').notNull().default(1),
    deliveryLocation: geographyPoint('delivery_location').notNull(),
    deliveryAddress: jsonb('delivery_address').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull(),
    dedupeHash: text('dedupe_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    fanoutAt: timestamp('fanout_at', { withTimezone: true }),
    responseDeadline: timestamp('response_deadline', { withTimezone: true }),
    offersDeadline: timestamp('offers_deadline', { withTimezone: true }),
    wideningDeadline: timestamp('widening_deadline', { withTimezone: true }),
    selectionDeadline: timestamp('selection_deadline', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    deliveryDeadline: timestamp('delivery_deadline', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    outcome: text('outcome'),
    fanoutCount: integer('fanout_count').notNull().default(0),
    offerCount: integer('offer_count').notNull().default(0),
  },
  (t) => ({ statusDeadline: index('requests_status_deadline_idx').on(t.status, t.responseDeadline) }),
);

export const requestStateTransitions = pgTable('request_state_transitions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid('request_id').notNull(),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  transition: text('transition').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: uuid('actor_id'),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requestMedia = pgTable('request_media', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid('request_id').notNull(),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  kind: text('kind').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: bigint('bytes', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requestFanouts = pgTable(
  'request_fanouts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    requestId: uuid('request_id').notNull(),
    supplierId: uuid('supplier_id').notNull(),
    tier: integer('tier').notNull().default(1),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    outcome: text('outcome'),
    wasOnlineAtSend: boolean('was_online_at_send').notNull().default(false),
    distanceKm: numeric('distance_km'),
  },
  (t) => ({ uniq: uniqueIndex('request_fanouts_request_id_supplier_id_key').on(t.requestId, t.supplierId) }),
);

export const matchDecisions = pgTable('match_decisions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid('request_id').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  tier: integer('tier').notNull(),
  stockProfileMatch: numeric('stock_profile_match').notNull(),
  proximity: numeric('proximity').notNull(),
  supplierScoreNorm: numeric('supplier_score_norm').notNull(),
  availability: numeric('availability').notNull(),
  total: numeric('total').notNull(),
  distanceKm: numeric('distance_km').notNull(),
  threshold: numeric('threshold').notNull(),
  selected: boolean('selected').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    requestId: uuid('request_id').notNull(),
    supplierId: uuid('supplier_id').notNull(),
    anonLabel: text('anon_label').notNull(),
    priceCents: cents('price_cents').notNull(),
    condition: text('condition').notNull(),
    warrantyDays: integer('warranty_days').notNull().default(0),
    notes: text('notes'),
    distanceKm: numeric('distance_km').notNull(),
    readyInMin: integer('ready_in_min').notNull().default(0),
    status: text('status').notNull(),
    responseSeconds: integer('response_seconds').notNull(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnReason: text('withdrawn_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex('offers_request_id_supplier_id_key').on(t.requestId, t.supplierId) }),
);

export const offerMedia = pgTable('offer_media', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  offerId: uuid('offer_id').notNull(),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  kind: text('kind').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: bigint('bytes', { mode: 'number' }),
  leakReviewStatus: text('leak_review_status').notNull().default('not_required'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  reference: text('reference').notNull().unique(),
  requestId: uuid('request_id').notNull(),
  offerId: uuid('offer_id').notNull(),
  buyerId: uuid('buyer_id').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  currency: text('currency').notNull(),
  partCents: cents('part_cents').notNull(),
  deliveryCents: cents('delivery_cents').notNull(),
  buyerFeeCents: cents('buyer_fee_cents').notNull(),
  taxCents: cents('tax_cents').notNull(),
  totalCents: cents('total_cents').notNull(),
  commissionCents: cents('commission_cents').notNull(),
  supplierPayoutCents: cents('supplier_payout_cents').notNull(),
  courierCostCents: cents('courier_cost_cents'),
  status: text('status').notNull(),
  authorisedAt: timestamp('authorised_at', { withTimezone: true }),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid('order_id').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref').notNull(),
  intent: text('intent').notNull(),
  amountCents: cents('amount_cents').notNull(),
  status: text('status').notNull(),
  failureCode: text('failure_code'),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    result: text('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex('webhook_events_provider_event_id_key').on(t.provider, t.eventId) }),
);

export const payoutQueue = pgTable('payout_queue', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  supplierId: uuid('supplier_id').notNull(),
  orderId: uuid('order_id').notNull().unique(),
  currency: text('currency').notNull(),
  amountCents: cents('amount_cents').notNull(),
  status: text('status').notNull().default('queued'),
  blockedReason: text('blocked_reason'),
  queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  providerRef: text('provider_ref'),
});

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid('order_id').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  status: text('status').notNull(),
  parcelClass: text('parcel_class').notNull(),
  pickupLocation: geographyPoint('pickup_location').notNull(),
  dropoffLocation: geographyPoint('dropoff_location').notNull(),
  quotedCents: cents('quoted_cents'),
  actualCents: cents('actual_cents'),
  quotedEtaMin: integer('quoted_eta_min'),
  attempt: integer('attempt').notNull().default(1),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  driverAssignedAt: timestamp('driver_assigned_at', { withTimezone: true }),
  collectedAt: timestamp('collected_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  proofUrl: text('proof_url'),
  failureReason: text('failure_reason'),
  wasPeak: boolean('was_peak'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryQuotes = pgTable('delivery_quotes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid('order_id').notNull(),
  provider: text('provider').notNull(),
  parcelClass: text('parcel_class').notNull(),
  priceCents: cents('price_cents'),
  etaMinutes: integer('eta_minutes'),
  selected: boolean('selected').notNull().default(false),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const opsQueue = pgTable('ops_queue', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  kind: text('kind').notNull(),
  requestId: uuid('request_id'),
  orderId: uuid('order_id'),
  severity: text('severity').notNull().default('normal'),
  summary: text('summary').notNull(),
  detail: jsonb('detail'),
  status: text('status').notNull().default('open'),
  assignedTo: uuid('assigned_to'),
  resolvedBy: uuid('resolved_by'),
  resolution: text('resolution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid('order_id').notNull(),
  raisedBy: text('raised_by').notNull(),
  raisedByUserId: uuid('raised_by_user_id'),
  reason: text('reason').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'),
  resolution: text('resolution'),
  refundCents: cents('refund_cents'),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const disputeEvidence = pgTable('dispute_evidence', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeId: uuid('dispute_id').notNull(),
  uploadedBy: uuid('uploaded_by'),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  kind: text('kind').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplierScoreEvents = pgTable('supplier_score_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  supplierId: uuid('supplier_id').notNull(),
  event: text('event').notNull(),
  delta: numeric('delta').notNull(),
  scoreAfter: numeric('score_after'),
  requestId: uuid('request_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const demandMisses = pgTable('demand_misses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid('request_id').notNull().unique(),
  marketId: uuid('market_id').notNull(),
  cityId: uuid('city_id'),
  partCategoryId: uuid('part_category_id'),
  partDescription: text('part_description').notNull(),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleYear: integer('vehicle_year'),
  location: geographyPoint('location').notNull(),
  missKind: text('miss_kind').notNull(),
  suppliersPinged: integer('suppliers_pinged').notNull().default(0),
  tier2Attempted: boolean('tier2_attempted').notNull().default(false),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const identityAccessLog = pgTable('identity_access_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: uuid('actor_user_id'),
  actorRole: text('actor_role'),
  route: text('route').notNull(),
  supplierId: uuid('supplier_id'),
  fields: text('fields').array().notNull(),
  allowed: boolean('allowed').notNull(),
  requestId: text('request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminInterventions = pgTable('admin_interventions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  adminId: uuid('admin_id').notNull(),
  requestId: uuid('request_id'),
  orderId: uuid('order_id'),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dataDeletionRequests = pgTable('data_deletion_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  requestedBy: uuid('requested_by'),
  executedBy: uuid('executed_by'),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  report: jsonb('report'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id'),
  channel: text('channel').notNull(),
  messageKey: text('message_key').notNull(),
  params: jsonb('params').$type<Record<string, string | number>>().notNull(),
  locale: text('locale').notNull(),
  rendered: text('rendered').notNull(),
  requestId: uuid('request_id'),
  orderId: uuid('order_id'),
  status: text('status').notNull().default('queued'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const funnelEvents = pgTable('funnel_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  event: text('event').notNull(),
  userId: uuid('user_id'),
  requestId: uuid('request_id'),
  orderId: uuid('order_id'),
  marketId: uuid('market_id'),
  properties: jsonb('properties').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
