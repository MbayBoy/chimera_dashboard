# Security and compliance

Written for two audiences: the person who has to answer a regulator, and the
engineer who has to keep the answer true. Every claim below names the code or
the test that makes it true, because a policy nobody can point at is a wish.

Two markets are configured. The UAE is live; South Africa is seeded and not
live, and its rules are answered here already — POPIA applies from the first
record stored, not from launch day.

---

## 1. Rate limiting

A competitor scraping the market is a real risk: the fan-out tells you which
yards stock which parts, and the offer list tells you what they charge.

| Surface | Limit | Where |
|---|---|---|
| `POST /v1/requests` | 30 per minute per caller | `apps/api/src/requests/routes.ts` |
| `POST /v1/auth/otp/request` | per caller, short window | `apps/api/src/auth/routes.ts` |
| `POST /v1/supplier/requests/:id/offer` | 120 per 5 minutes | `apps/api/src/routes/supplier.ts` |
| `POST /v1/account/deletion-request` | 5 per hour | `apps/api/src/privacy/routes.ts` |

Proved by `tests/resilience-and-security.test.ts — "request creation is rate
limited"`, which drives 45 attempts from one address and asserts that some are
refused. The limiter keys are namespaced per environment so a test run cannot
exhaust a development server's budget.

## 2. Anonymity

The double-blind is the business model, not a privacy feature: it is the only
thing stopping the second job being done on WhatsApp.

- One serialiser, `toBuyerView()`, on a type that structurally cannot carry
  supplier identity — there is no `supplierId`, `businessName`, `address`,
  `location` or `phone` on `AnonymisableOffer`, so a leak is a type error rather
  than a review comment.
- Distance is shown, never bearing or direction. Distance plus direction locates
  a workshop in about four seconds.
- Buyer tracking has its own view, `toBuyerTrackingView()`, which cannot emit a
  pickup location. The courier's natural payload contains the yard's address;
  this is the endpoint that would leak it.
- Photographs are re-encoded on ingest, in both directions, and the residual
  metadata is verified empty. A GPS tag in an EXIF header is the yard's address.
- Contact details in free text are rejected, never silently mangled, in Latin
  and Arabic-Indic numerals, and the supplier is told why the rule exists.

**The sweep.** `tests/anonymity-sweep.test.ts` enumerates every route the server
exposes, asserts that each is either swept or excluded with a written reason,
drives a real request to a collected delivery, and greps the whole response body
of every buyer-facing endpoint for every yard name, phone, supplier id, user id
and coordinate in the database. Endpoints covered:

`GET /v1/auth/me`, `/v1/requests`, `/v1/requests/:id`, `/v1/requests/:id/offers`,
`/v1/requests/:id/timeline`, `/v1/requests/:id/tracking`, `/v1/orders`,
`/v1/orders/:id`, `/v1/disputes`, `/v1/part-categories`, `/v1/vehicles/makes`,
`/v1/vehicles/models`, `/v1/app-version`, `/v1/health`.

The reverse direction is swept too: the supplier terminal must not see the
buyer's phone, name, delivery address or pin.

**Identity access audit.** Every read of supplier identity outside the admin
console is logged with the actor, the route and the time
(`apps/api/src/security/audit.ts`). The point is not to prevent access — some is
necessary — but to make an anomalous pattern visible. A leak of this kind is
found by noticing that something started reading identity at a rate it never
used to.

## 3. Data protection

### Lawful basis

| Data | Basis | Note |
|---|---|---|
| Phone number, account | Contract | You cannot be sold a part without an account. |
| Delivery pin and address | Contract | The courier cannot deliver to a city. |
| Photographs of parts | Contract | The offer is meaningless without them. |
| Yard location | Contract | Matching is a geo query. |
| Funnel events | Legitimate interest | Aggregated product analytics; the subject is removable. |
| Financial records | Legal obligation | Tax law in both markets. Survives erasure. |
| Identity access log | Legitimate interest | Security monitoring of our own staff. |

### Retention

`markets.financial_retention_years` — a market value in market configuration,
not a number in code, and asserted to be so by
`tests/privacy.test.ts — "uses each market's own retention period"`. Both
markets are configured at five years today (UAE Federal Tax Procedures Law;
South African Tax Administration Act). Either can change without a deploy.

### The deletion path

`POST /v1/account/deletion-request` from inside the app the person already uses.
A right that can only be exercised by email is a right most people never
exercise. An admin executes it and receives a report.

Erasure is by anonymisation in place, not by `DELETE`:

| Table | What happens | Why |
|---|---|---|
| `users` | phone → tombstone, email, name → null, deactivated | The row is referenced by orders and disputes. |
| `buyers` | business name, tax number, address, pin → null | |
| `suppliers` | address → `{}` | The trading name appears on invoices that must be kept. |
| `requests` | note → `{}`, pin snapped to a ~1 km grid | Keeps the demand map, loses the workshop. |
| `request_media` | deleted | A photograph is personal data with no retention duty. |
| `notifications`, `otp_codes`, `refresh_tokens` | deleted | Existed only to reach the person. |
| `funnel_events` | `user_id` → null | The shape is kept, the subject is not. |
| `orders`, `payments`, `disputes` | **kept** | Legal obligation, for the configured retention period. |

Proved by `tests/privacy.test.ts`, which asserts the identifiers are gone, that
the old session no longer authenticates, that the report names what was kept and
under what basis, that a second execution is refused, and — the assertion that
matters operationally — that every foreign key in the database still resolves
afterwards. A deletion that breaks referential integrity is discovered three
months later by a reconciliation job, not by the person who asked.

### Region pinning

The UAE deployment must run its database, Redis, object storage and backups in a
UAE region. This is a deployment decision, not a code decision: nothing in the
application chooses a region. What the code does provide is a single
`DATABASE_URL`, `REDIS_URL` and media driver configuration, so there is exactly
one place per environment where the region is set. **Not yet done in this
repository — there is no cloud account attached to it.** See RUNBOOK.md.

### POPIA, for market #2

The mechanism is the same; the differences are recorded so nobody rediscovers
them under launch pressure:

- An information officer must be registered with the South African Information
  Regulator before processing begins.
- The lawful bases above map onto POPIA's justifications without change; the
  "legitimate interest" rows require a balancing record, which is this table.
- Cross-border transfer (section 72) applies if any processing happens outside
  South Africa. If the ZA deployment runs in a non-ZA region, that needs an
  adequacy assessment or explicit consent; the cleanest answer is to deploy in
  region, as the UAE does.
- Breach notification is to the Regulator **and** the data subject.

## 4. PCI

Card data never touches these servers. The buyer app collects card details in
the provider's own hosted fields and sends a token; `AuthoriseInput` takes a
`PaymentMethod` whose only field is that token. This keeps the platform in
SAQ-A territory rather than in scope for the full standard.

Asserted mechanically by `tests/resilience-and-security.test.ts — "card details
never reach these servers"`, which greps application code for card fields and
checks stored provider payloads for anything shaped like a PAN or a CVV.

The same test exempts the logger's redaction list, which names those fields in
order to strip them.

## 5. Payouts and KYC

- No wallet, no balance, no stored value. Authorise on acceptance, capture on
  delivery, void on failure. Holding money on behalf of two parties can make
  this a regulated payments intermediary under the UAE Central Bank's
  stored-value regime and under South Africa's National Payment System
  framework; the design gives the buyer protection and the platform the leverage
  of the double-blind without the licence. If anything starts to look like a
  supplier balance, that is a licensing question and not an engineering one.
- A payout is queued from the operating account, and a yard that is not verified
  gets `blocked_kyc` with a reason rather than a release
  (`apps/api/src/payments/service.ts`, asserted in
  `tests/resilience-and-security.test.ts — "a payout cannot be released before
  the yard is verified"`).

## 6. Stolen parts

A used-parts platform attracts illicit stock, and the brand carries the
consequence. This is also the first question a serious investor asks.

**Controls in the product today**

1. **No anonymous supply.** A yard cannot receive a job until an operator has
   verified the business: trade licence, physical visit, tablet issued to a
   named person. `suppliers.verified` gates payouts;
   `suppliers.onboarding_stage` records how far the verification got, and only
   the last stage counts.
2. **Every part is traceable to a yard.** The buyer never sees who supplied it,
   but `orders.supplier_id`, the offer, the fan-out row and the photographs are
   permanent and admin-visible. Anonymity is from the counterparty, never from
   us and never from the police.
3. **Photographs are kept.** Every offer carries the yard's own photographs of
   the actual part, taken at the time of quoting, with a server-side timestamp.
4. **VIN-level traceability on high-value components.** Engines, gearboxes,
   airbags and ECUs are the categories a stolen-vehicle investigation asks
   about. The donor vehicle identifier is recorded on the offer for these
   categories, and the market's own identifier type (`chassis` in the UAE, `vin`
   in South Africa) governs the format. **Status: the vehicle identifier is
   captured on the request and the category tree distinguishes these parts;
   mandatory donor-identifier capture on high-value offers is specified here and
   is not yet enforced in code.** It is the first item on the Phase 2 list.
5. **An audit trail nobody can quietly edit.** State transitions, match
   decisions, payments and identity access are append-only.

**Law-enforcement cooperation process**

1. A request from a police force, a vehicle-crime unit or an insurer goes to a
   single named contact at NINETY. Nobody else answers one.
2. That contact verifies the request is genuine — a case number and a callback
   to a published switchboard number, not a mobile number in the email.
3. Scope is confirmed in writing before anything is produced: which part, which
   period, which vehicle.
4. What can be produced: the yard's identity and trading address, the order and
   its photographs, the timestamps, the delivery record and the donor vehicle
   identifier where captured. What is not produced without a court order: the
   buyer's identity beyond what is necessary to identify the transaction.
5. Every disclosure is logged in the identity access log with the case number as
   the reason, like any other identity read.
6. If a pattern emerges around one yard, that yard is suspended pending the
   investigation. `suppliers.status = 'suspended'` stops fan-out immediately.

**What this does not do.** None of it detects a stolen part at the moment it is
listed. It makes a yard traceable and makes disposal through the platform a bad
idea, which is the achievable goal.
