-- NINETY — initial schema.
--
-- PostGIS is required, not optional: geo radius matching is the core of the
-- product. Every location column is GEOGRAPHY(POINT,4326) rather than a plain
-- POINT, so distances come back in metres on the spheroid instead of in degrees
-- — a difference that is invisible until a matching radius is silently wrong.
--
-- Every monetary column is BIGINT minor units. There is no NUMERIC and no
-- DOUBLE PRECISION anywhere near a currency value.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────  Markets & config  ───────────────────────────

CREATE TABLE markets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT UNIQUE NOT NULL,
  name                      TEXT NOT NULL,
  currency                  TEXT NOT NULL,
  currency_minor_unit_exp   INT NOT NULL DEFAULT 2,
  locale_default            TEXT NOT NULL,
  locales_supported         TEXT[] NOT NULL,
  timezone                  TEXT NOT NULL,
  vehicle_id_type           TEXT NOT NULL CHECK (vehicle_id_type IN ('vin','chassis')),
  vehicle_id_regex          TEXT,
  payment_provider          TEXT NOT NULL,
  courier_providers         TEXT[] NOT NULL DEFAULT '{}',
  tax_rate                  NUMERIC(5,4) NOT NULL,
  tax_label                 TEXT NOT NULL,
  tax_inclusive             BOOLEAN NOT NULL DEFAULT false,
  commission_rate           NUMERIC(5,4) NOT NULL,
  buyer_fee_rate            NUMERIC(5,4) NOT NULL,
  delivery_markup_rate      NUMERIC(5,4) NOT NULL DEFAULT 0,
  sla_response_min          INT NOT NULL DEFAULT 15,
  sla_offers_min            INT NOT NULL DEFAULT 30,
  sla_delivery_min          INT NOT NULL DEFAULT 90,
  selection_window_min      INT NOT NULL DEFAULT 120,
  widening_window_min       INT NOT NULL DEFAULT 45,
  auto_confirm_hours        INT NOT NULL DEFAULT 24,
  address_model             TEXT NOT NULL DEFAULT 'hybrid' CHECK (address_model IN ('street','makani','hybrid')),
  weekend_days              INT[] NOT NULL,
  holidays                  DATE[] NOT NULL DEFAULT '{}',
  is_live                   BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every edit to a market is an audit event: these values move money and move
-- the SLA, and "who changed the commission rate" must always have an answer.
CREATE TABLE market_config_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id    UUID NOT NULL REFERENCES markets(id),
  changed_by   UUID,
  field        TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_config_audit_market ON market_config_audit(market_id, created_at DESC);

CREATE TABLE cities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id    UUID NOT NULL REFERENCES markets(id),
  name         TEXT NOT NULL,
  centroid     GEOGRAPHY(POINT,4326) NOT NULL,
  radius_km    INT NOT NULL DEFAULT 50,
  is_live      BOOLEAN NOT NULL DEFAULT false,
  launch_date  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, name)
);
CREATE INDEX idx_cities_centroid ON cities USING GIST (centroid);

-- ───────────────────────────  Actors  ───────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     UUID NOT NULL REFERENCES markets(id),
  role          TEXT NOT NULL CHECK (role IN ('buyer','supplier','admin')),
  phone         TEXT NOT NULL,
  email         TEXT,
  display_name  TEXT,
  locale        TEXT,
  kyc_status    TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','submitted','verified','rejected')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, phone)
);
CREATE INDEX idx_users_role ON users(role, market_id);

CREATE TABLE otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     UUID NOT NULL REFERENCES markets(id),
  phone         TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  attempts      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_lookup ON otp_codes(market_id, phone, created_at DESC);

CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE buyers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id),
  type             TEXT NOT NULL CHECK (type IN ('workshop','panelbeater','consumer','fleet')),
  business_name    TEXT,
  tax_number       TEXT,
  default_address  JSONB,
  default_location GEOGRAPHY(POINT,4326),
  credit_terms     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_buyers_location ON buyers USING GIST (default_location);

CREATE TABLE suppliers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES users(id),
  city_id            UUID NOT NULL REFERENCES cities(id),
  -- INTERNAL ONLY. Never sent to a buyer. Access from a non-admin path is audited.
  business_name      TEXT NOT NULL,
  location           GEOGRAPHY(POINT,4326) NOT NULL,
  address            JSONB NOT NULL,
  operating_hours    JSONB NOT NULL,
  verified           BOOLEAN NOT NULL DEFAULT false,
  verified_at        TIMESTAMPTZ,
  payout_details_id  UUID,
  status             TEXT NOT NULL DEFAULT 'onboarding'
                     CHECK (status IN ('onboarding','active','suspended','churned')),
  onboarding_stage   TEXT NOT NULL DEFAULT 'signed'
                     CHECK (onboarding_stage IN ('signed','tablet_installed','profile_configured','test_request_passed')),
  onboarding_stage_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score              NUMERIC(4,2) NOT NULL DEFAULT 3.00,
  response_rate      NUMERIC(5,4) NOT NULL DEFAULT 0,
  median_response_s  INT,
  fulfilment_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
  dispute_rate       NUMERIC(5,4) NOT NULL DEFAULT 0,
  decline_rate       NUMERIC(5,4) NOT NULL DEFAULT 0,
  -- Raised automatically when a yard's decline rate climbs: relevance protects
  -- the clock, and a yard pinged with irrelevant work stops watching the screen.
  stock_match_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_location ON suppliers USING GIST (location);
CREATE INDEX idx_suppliers_city_status ON suppliers(city_id, status);

CREATE TABLE supplier_stock_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL UNIQUE REFERENCES suppliers(id),
  makes           TEXT[] NOT NULL DEFAULT '{}',
  models          TEXT[] NOT NULL DEFAULT '{}',
  year_from       INT,
  year_to         INT,
  part_categories TEXT[] NOT NULL DEFAULT '{}',
  max_radius_km   INT NOT NULL DEFAULT 50,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tablets are loaned hardware, not gifts, and a tablet nobody watches inflates
-- the supply numbers while contributing nothing to fill rate.
CREATE TABLE supplier_tablets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  serial_number TEXT NOT NULL UNIQUE,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_to     TEXT,
  status        TEXT NOT NULL DEFAULT 'deployed'
                CHECK (status IN ('deployed','returned','lost','broken','replaced')),
  last_seen_at  TIMESTAMPTZ,
  notes         TEXT
);
CREATE INDEX idx_tablets_supplier ON supplier_tablets(supplier_id);

-- Terminal presence. Drives the availability component of matching and, more
-- importantly, distinguishes "did not answer" from "was not reachable".
CREATE TABLE supplier_presence (
  supplier_id      UUID PRIMARY KEY REFERENCES suppliers(id),
  online           BOOLEAN NOT NULL DEFAULT false,
  last_seen_at     TIMESTAMPTZ,
  last_online_at   TIMESTAMPTZ,
  last_offline_at  TIMESTAMPTZ,
  connection_count INT NOT NULL DEFAULT 0
);

-- ───────────────────────────  Catalogue  ───────────────────────────

CREATE TABLE vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin         TEXT,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  variant     TEXT,
  year        INT NOT NULL,
  body_type   TEXT,
  engine_code TEXT,
  market_id   UUID REFERENCES markets(id)
);
CREATE INDEX idx_vehicles_lookup ON vehicles(make, model, year);

CREATE TABLE part_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  parent_id    UUID REFERENCES part_categories(id),
  name_i18n    JSONB NOT NULL,
  -- A tail lamp is a bike delivery; a bonnet is a van. Quoting everything as a
  -- small parcel makes courier margin wrong on exactly the high-value orders.
  parcel_class TEXT NOT NULL DEFAULT 'car' CHECK (parcel_class IN ('bike','car','van')),
  -- High-value components carry chassis-level traceability obligations.
  high_value   BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_part_categories_parent ON part_categories(parent_id);

-- ───────────────────────────  The core object  ───────────────────────────

CREATE TABLE requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          TEXT UNIQUE NOT NULL,
  buyer_id           UUID NOT NULL REFERENCES buyers(id),
  market_id          UUID NOT NULL REFERENCES markets(id),
  city_id            UUID REFERENCES cities(id),
  vehicle_id         UUID REFERENCES vehicles(id),
  vehicle_raw        JSONB NOT NULL,
  part_category_id   UUID REFERENCES part_categories(id),
  part_description   TEXT NOT NULL,
  condition_accepted TEXT[] NOT NULL DEFAULT '{used,refurbished}',
  quantity           INT NOT NULL DEFAULT 1,
  delivery_location  GEOGRAPHY(POINT,4326) NOT NULL,
  delivery_address   JSONB NOT NULL,
  status             TEXT NOT NULL,
  -- Duplicate detection: same buyer, same part, same vehicle, inside a window.
  dedupe_hash        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at       TIMESTAMPTZ,
  fanout_at          TIMESTAMPTZ,
  response_deadline  TIMESTAMPTZ,
  offers_deadline    TIMESTAMPTZ,
  widening_deadline  TIMESTAMPTZ,
  selection_deadline TIMESTAMPTZ,
  accepted_at        TIMESTAMPTZ,
  delivery_deadline  TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  outcome            TEXT,
  fanout_count       INT NOT NULL DEFAULT 0,
  offer_count        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_requests_delivery_location ON requests USING GIST (delivery_location);
CREATE INDEX idx_requests_status_deadline ON requests(status, response_deadline);
CREATE INDEX idx_requests_buyer ON requests(buyer_id, created_at DESC);
CREATE INDEX idx_requests_market_created ON requests(market_id, created_at DESC);
CREATE INDEX idx_requests_dedupe ON requests(buyer_id, dedupe_hash, created_at DESC);

-- Every transition, with who caused it and why. `requests.status` is never
-- assigned from a controller; this table is the record that it was not.
CREATE TABLE request_state_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES requests(id),
  from_state    TEXT NOT NULL,
  to_state      TEXT NOT NULL,
  transition    TEXT NOT NULL,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('buyer','supplier','admin','system','timer')),
  actor_id      UUID,
  reason        TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transitions_request ON request_state_transitions(request_id, created_at);

CREATE TABLE request_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES requests(id),
  url         TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('photo','video')),
  width       INT,
  height      INT,
  bytes       BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_media_request ON request_media(request_id);

CREATE TABLE request_fanouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES requests(id),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  tier          INT NOT NULL DEFAULT 1,
  sent_at       TIMESTAMPTZ NOT NULL,
  seen_at       TIMESTAMPTZ,
  responded_at  TIMESTAMPTZ,
  outcome       TEXT CHECK (outcome IN ('offered','declined','no_response','unreachable')),
  -- True when the terminal was offline for the whole response window. Such a
  -- fan-out does not count against the yard's response rate.
  was_online_at_send BOOLEAN NOT NULL DEFAULT false,
  distance_km   NUMERIC(6,2),
  UNIQUE (request_id, supplier_id)
);
CREATE INDEX idx_fanouts_supplier_sent ON request_fanouts(supplier_id, sent_at);
CREATE INDEX idx_fanouts_request ON request_fanouts(request_id);

-- Why each yard was or was not selected. Operational questions about matching
-- arrive weekly and forever; answering them by reading code is not viable.
CREATE TABLE match_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          UUID NOT NULL REFERENCES requests(id),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id),
  tier                INT NOT NULL,
  stock_profile_match NUMERIC(5,4) NOT NULL,
  proximity           NUMERIC(5,4) NOT NULL,
  supplier_score_norm NUMERIC(5,4) NOT NULL,
  availability        NUMERIC(5,4) NOT NULL,
  total               NUMERIC(5,4) NOT NULL,
  distance_km         NUMERIC(7,2) NOT NULL,
  threshold           NUMERIC(5,4) NOT NULL,
  selected            BOOLEAN NOT NULL,
  reason              TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_decisions_request ON match_decisions(request_id, tier, total DESC);

CREATE TABLE offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES requests(id),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id),
  anon_label       TEXT NOT NULL,
  price_cents      BIGINT NOT NULL CHECK (price_cents > 0),
  condition        TEXT NOT NULL CHECK (condition IN ('used','refurbished','new')),
  warranty_days    INT NOT NULL DEFAULT 0,
  notes            TEXT,
  distance_km      NUMERIC(6,2) NOT NULL,
  ready_in_min     INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL,
  response_seconds INT NOT NULL,
  withdrawn_at     TIMESTAMPTZ,
  withdrawn_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, supplier_id)
);
CREATE INDEX idx_offers_request_status ON offers(request_id, status);
CREATE INDEX idx_offers_supplier ON offers(supplier_id, created_at DESC);

CREATE TABLE offer_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID NOT NULL REFERENCES offers(id),
  url         TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('photo','video')),
  width       INT,
  height      INT,
  bytes       BIGINT,
  -- Flagged for human review when the image may show yard signage. A visual
  -- leak is a Phase 07 concern; the flag is written here from Phase 01 onward.
  leak_review_status TEXT NOT NULL DEFAULT 'not_required'
                     CHECK (leak_review_status IN ('not_required','pending','cleared','blocked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_offer_media_offer ON offer_media(offer_id);

-- ───────────────────────────  Money  ───────────────────────────

CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             TEXT UNIQUE NOT NULL,
  request_id            UUID NOT NULL REFERENCES requests(id),
  offer_id              UUID NOT NULL REFERENCES offers(id),
  buyer_id              UUID NOT NULL REFERENCES buyers(id),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  currency              TEXT NOT NULL,
  part_cents            BIGINT NOT NULL,
  delivery_cents        BIGINT NOT NULL,
  buyer_fee_cents       BIGINT NOT NULL,
  tax_cents             BIGINT NOT NULL,
  total_cents           BIGINT NOT NULL,
  commission_cents      BIGINT NOT NULL,
  supplier_payout_cents BIGINT NOT NULL,
  courier_cost_cents    BIGINT,
  status                TEXT NOT NULL,
  authorised_at         TIMESTAMPTZ,
  captured_at           TIMESTAMPTZ,
  voided_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The arithmetic must reconcile exactly. This is enforced by the database as
  -- well as by tests, because a cent lost per order is a week of reconciliation.
  CONSTRAINT order_total_reconciles
    CHECK (total_cents = part_cents + delivery_cents + buyer_fee_cents + tax_cents),
  CONSTRAINT order_payout_reconciles
    CHECK (supplier_payout_cents = part_cents - commission_cents)
);
CREATE INDEX idx_orders_request ON orders(request_id);
CREATE INDEX idx_orders_supplier ON orders(supplier_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id),
  provider          TEXT NOT NULL,
  provider_ref      TEXT NOT NULL,
  intent            TEXT NOT NULL CHECK (intent IN ('authorisation','capture','void','refund','payout')),
  amount_cents      BIGINT NOT NULL,
  status            TEXT NOT NULL,
  failure_code      TEXT,
  raw               JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref, intent)
);
CREATE INDEX idx_payments_order ON payments(order_id, created_at);

-- Provider webhooks are replayed routinely. Recording the delivery id makes a
-- replay a no-op rather than a double capture.
CREATE TABLE webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  processed_at  TIMESTAMPTZ,
  result        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- Payouts are QUEUED here and paid from the operating account on a schedule.
-- This is not a balance: no buyer money is ever held on a supplier's behalf.
CREATE TABLE payout_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  order_id      UUID NOT NULL REFERENCES orders(id),
  currency      TEXT NOT NULL,
  amount_cents  BIGINT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','blocked_kyc','paid','failed','cancelled')),
  blocked_reason TEXT,
  queued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at       TIMESTAMPTZ,
  provider_ref  TEXT,
  UNIQUE (order_id)
);
CREATE INDEX idx_payout_queue_status ON payout_queue(status, queued_at);

-- ───────────────────────────  Logistics  ───────────────────────────

CREATE TABLE deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id),
  provider         TEXT NOT NULL,
  provider_ref     TEXT,
  status           TEXT NOT NULL,
  parcel_class     TEXT NOT NULL CHECK (parcel_class IN ('bike','car','van')),
  pickup_location  GEOGRAPHY(POINT,4326) NOT NULL,
  dropoff_location GEOGRAPHY(POINT,4326) NOT NULL,
  quoted_cents     BIGINT,
  actual_cents     BIGINT,
  quoted_eta_min   INT,
  attempt          INT NOT NULL DEFAULT 1,
  dispatched_at    TIMESTAMPTZ,
  driver_assigned_at TIMESTAMPTZ,
  collected_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  proof_url        TEXT,
  failure_reason   TEXT,
  was_peak         BOOLEAN,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_order ON deliveries(order_id, attempt);
CREATE INDEX idx_deliveries_pickup ON deliveries USING GIST (pickup_location);
CREATE INDEX idx_deliveries_dropoff ON deliveries USING GIST (dropoff_location);

-- Every quote from every provider, kept whether or not it won. Without this
-- there is no way to tell whether courier margin is real.
CREATE TABLE delivery_quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  provider      TEXT NOT NULL,
  parcel_class  TEXT NOT NULL,
  price_cents   BIGINT,
  eta_minutes   INT,
  selected      BOOLEAN NOT NULL DEFAULT false,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_quotes_order ON delivery_quotes(order_id);

-- When every provider fails, a human picks it up. That is the system working.
CREATE TABLE ops_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL,
  request_id   UUID REFERENCES requests(id),
  order_id     UUID REFERENCES orders(id),
  severity     TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  summary      TEXT NOT NULL,
  detail       JSONB,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  assigned_to  UUID REFERENCES users(id),
  resolved_by  UUID REFERENCES users(id),
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX idx_ops_queue_status ON ops_queue(status, severity, created_at DESC);

-- ───────────────────────────  Trust  ───────────────────────────

CREATE TABLE disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  raised_by     TEXT NOT NULL CHECK (raised_by IN ('buyer','supplier')),
  raised_by_user_id UUID REFERENCES users(id),
  reason        TEXT NOT NULL
                CHECK (reason IN ('wrong_part','damaged','not_as_described','not_delivered','not_collected','other')),
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','rejected')),
  resolution    TEXT,
  refund_cents  BIGINT,
  -- A dispute can never be resolved by the counterparty. Enforced in code and
  -- recorded here: the resolver is always an admin.
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disputes_status ON disputes(status, created_at DESC);
CREATE INDEX idx_disputes_order ON disputes(order_id);

CREATE TABLE dispute_evidence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id),
  uploaded_by UUID REFERENCES users(id),
  url         TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  kind        TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_score_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  event       TEXT NOT NULL,
  delta       NUMERIC(4,2) NOT NULL,
  score_after NUMERIC(4,2),
  request_id  UUID REFERENCES requests(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_events_supplier ON supplier_score_events(supplier_id, created_at DESC);

-- ───────────────────────────  The demand dataset  ───────────────────────────

-- Unfilled requests are the most valuable data this business produces: they
-- decide the inventory strategy and they form part of the investment case.
-- This is a product surface, not a debug log.
CREATE TABLE demand_misses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL UNIQUE REFERENCES requests(id),
  market_id         UUID NOT NULL REFERENCES markets(id),
  city_id           UUID REFERENCES cities(id),
  part_category_id  UUID REFERENCES part_categories(id),
  part_description  TEXT NOT NULL,
  vehicle_make      TEXT,
  vehicle_model     TEXT,
  vehicle_year      INT,
  location          GEOGRAPHY(POINT,4326) NOT NULL,
  miss_kind         TEXT NOT NULL CHECK (miss_kind IN ('no_supply','no_offers')),
  suppliers_pinged  INT NOT NULL DEFAULT 0,
  tier2_attempted   BOOLEAN NOT NULL DEFAULT false,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demand_misses_location ON demand_misses USING GIST (location);
CREATE INDEX idx_demand_misses_lookup ON demand_misses(market_id, part_category_id, occurred_at DESC);

-- ───────────────────────────  Audit & compliance  ───────────────────────────

-- Every access to supplier identity from a non-admin path. Anomalies alert.
CREATE TABLE identity_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_role    TEXT,
  route         TEXT NOT NULL,
  supplier_id   UUID,
  fields        TEXT[] NOT NULL DEFAULT '{}',
  allowed       BOOLEAN NOT NULL,
  request_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_identity_access_created ON identity_access_log(created_at DESC);
CREATE INDEX idx_identity_access_actor ON identity_access_log(actor_user_id, created_at DESC);

CREATE TABLE admin_interventions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  request_id  UUID REFERENCES requests(id),
  order_id    UUID REFERENCES orders(id),
  action      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interventions_request ON admin_interventions(request_id, created_at DESC);

CREATE TABLE data_deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  requested_by UUID REFERENCES users(id),
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  completed_at TIMESTAMPTZ,
  report       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────  Notifications  ───────────────────────────

-- Every system-generated message is a locale key plus parameters, resolved at
-- send time. No English string is ever written into this table.
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  channel      TEXT NOT NULL CHECK (channel IN ('push','sms','email','in_app','web_push')),
  message_key  TEXT NOT NULL,
  params       JSONB NOT NULL DEFAULT '{}',
  locale       TEXT NOT NULL,
  rendered     TEXT NOT NULL,
  request_id   UUID REFERENCES requests(id),
  order_id     UUID REFERENCES orders(id),
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed')),
  sent_at      TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_request ON notifications(request_id, created_at DESC);

-- ───────────────────────────  Analytics funnel  ───────────────────────────

CREATE TABLE funnel_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event        TEXT NOT NULL,
  user_id      UUID REFERENCES users(id),
  request_id   UUID REFERENCES requests(id),
  order_id     UUID REFERENCES orders(id),
  market_id    UUID REFERENCES markets(id),
  properties   JSONB NOT NULL DEFAULT '{}',
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_funnel_events_lookup ON funnel_events(event, occurred_at DESC);
