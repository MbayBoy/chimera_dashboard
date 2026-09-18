# Gate evidence

Each phase's gate, criterion by criterion, with what was demonstrated and how to
re-run it. Where something could not be demonstrated in this container, it says
so and says what would demonstrate it — an asserted gate is not a passed gate.

Everything below was produced by commands in this repository against a real
PostgreSQL 16 with PostGIS 3.4 and a real Redis 7. Nothing is mocked.

**Workspace totals:** 212 tests pass — 107 API, 66 shared, 19 terminal, 15 buyer,
11 config/guards. `pnpm -r typecheck`, `pnpm -r lint` and the market-value guard
are green.

---

## How to reproduce all of it

```bash
cd ninety
pnpm install
./infra/dev-services.sh start          # or: docker compose -f infra/docker-compose.yml up -d
pnpm bootstrap                         # migrate + seed
pnpm -r typecheck && pnpm -r lint && pnpm -r test

# the guards, proved to bite rather than asserted to exist
./scripts/guard-demo.sh
./scripts/locale-demo.sh
node scripts/check-data-safety.mjs

# load test (needs the API and 200 seeded terminals)
pnpm --filter @ninety/api start &
pnpm --filter @ninety/api seed:load -- --terminals 200
pnpm --filter @ninety/api loadtest -- --market AE --requests 500 --terminals 200

# the Arabic RTL pass (needs the API and the built terminal being served)
node scripts/capture-rtl-pass.mjs
```

---

## Phase 07 — Hardening

### a. Every unhappy path has a test AND a written user-facing message

**Demonstrated.** `docs/UNHAPPY-PATHS.md` lists twelve paths — the ten the phase
names plus two the build added — each with what the system does, where it is
implemented, the test that proves it, and the exact copy in English and Arabic.
The document is **generated** by `node scripts/generate-unhappy-paths.mjs` from
`apps/api/src/i18n/catalogues/*.json`, so it cannot drift from what ships.

Tests: `apps/api/tests/unhappy-paths.test.ts` (12 tests). Each asserts the
behaviour and that the copy exists in both launch languages, is not identical to
the English, and contains Arabic script.

### b. Load test: 500 concurrent requests, 200 terminals, no dropped timers

**Demonstrated.** Full output in `docs/evidence/loadtest.txt`.

| | p50 | p95 | p99 | max |
|---|---|---|---|---|
| Request creation (n=500, 0 failed) | 2031 ms | 2222 ms | 2230 ms | 2237 ms |
| Offer submission (n=200, 0 failed) | 893 ms | 974 ms | 991 ms | 1034 ms |

- 500 requests created in 2268 ms wall clock — 220/s, issued concurrently in one
  wave, not sequentially.
- 200 terminals, each authenticated as its own yard, each on its own WebSocket.
  **8000 fan-out pings observed arriving on those sockets**, which is how we know
  the fan-out reached a screen and not only a database row.
- 8240 supplier pings recorded; every offer went through the real endpoint, so
  row locks, the state machine and the score writes were all under contention.
- **Zero dropped timers. Zero deadlines fired late.** Timer lateness measured
  against the deadline the API itself published: p50 91 ms, p95 2295 ms, max
  2536 ms, tolerance 3000 ms.
- 0 requests stuck in MATCHING, 0 missing a deadline.

Two defects were found and fixed by this test rather than asserted away:

1. `TIMER_SPEED_FACTOR` compressed only the queue delay, so a sped-up run fired
   its timers twelve minutes *before* the deadline the API had published. The
   compression now applies to the deadline itself (`apps/api/src/core/clock.ts`),
   so client countdowns and server behaviour agree at any speed.
2. Tier-2 widening and supplier score bookkeeping ran inside the timer job, so
   500 simultaneous deadlines queued behind each other's fan-out work: 86 late
   fires, worst 10.0 s. Widening moved to the matching queue and scoring moved
   to after the transition. Worst case is now 2.5 s and nothing is late.

### c. A device loses power mid-request; score unaffected, queued offer sends

**Partly demonstrated. The physical test has not been done and cannot be done
here — there is no tablet in this container.** What was done:

- `apps/terminal/src/lib/queue.test.ts` simulates a **hard** power loss the way
  one actually happens: the module registry is discarded and only what reached
  storage survives, then the terminal cold-starts against it. The composed offer
  is still there, it sends on reconnect, and it carries the time it was
  *composed* rather than the time the power came back. A transient failure keeps
  it queued; a permanent rejection stays on screen rather than disappearing.
- `apps/api/tests/resilience-and-security.test.ts` proves the server half: a
  replayed offer is credited to its `composedAt`, a clock-skewed `composedAt`
  from before the job existed is ignored, and a yard whose terminal was offline
  at fan-out is recorded `unreachable` rather than `no_response` — for which the
  score delta is exactly zero.
- `docs/screenshots/rtl-pass/offline-*.png` shows the terminal genuinely offline
  (`navigator.onLine === false`), with a queued offer and the banner saying it
  will send when the connection returns.

**What remains:** step 4 of `docs/DRESS-REHEARSAL.md` — pull the plug on a real
tablet mid-quote, in a yard, and watch it. Software cannot prove that.

### d. The anonymity leak test passes against every buyer-facing endpoint

**Demonstrated.** `apps/api/tests/anonymity-sweep.test.ts`. It reads the running
server's own route table and fails if any route has no recorded decision — swept,
or excluded with a written reason — so a new buyer-facing endpoint cannot be
added without one.

Endpoints swept, whole-payload, against every yard name, phone, supplier id,
user id and coordinate in the database:

`GET /v1/auth/me` · `/v1/requests` · `/v1/requests/:id` · `/v1/requests/:id/offers` ·
`/v1/requests/:id/timeline` · **`/v1/requests/:id/tracking`** · `/v1/orders` ·
`/v1/orders/:id` · `/v1/disputes` · `/v1/part-categories` · `/v1/vehicles/makes` ·
`/v1/vehicles/models` · `/v1/app-version` · `/v1/health`

The tracking endpoint is the one this phase singles out as highest risk, and it
is driven to a collected delivery before being swept, so the courier payload is
populated when it is checked. Also asserted: a buyer token cannot reach any
supplier or admin route, and the supplier side never sees the buyer's phone,
name, address or pin.

### e. A data-deletion request removes the right data, integrity intact

**Demonstrated.** `apps/api/tests/privacy.test.ts` (5 tests).

A person asks from inside the app (`POST /v1/account/deletion-request`), an admin
executes it, and the report says what was anonymised, what was deleted and what
was retained under what basis and until when. The test asserts the identifiers
are gone, the old session no longer authenticates, the delivery note is gone and
the pin is coarsened to a ~1 km grid, a second execution is refused — and that
**every foreign key in the database still resolves afterwards**.

Both markets: retention is `markets.financial_retention_years`, read from market
configuration, and a test asserts no retention period appears as a literal in
application code. See `docs/SECURITY-AND-COMPLIANCE.md` for the lawful bases and
the POPIA differences.

### f. A dispute runs end to end, including the score effect

**Demonstrated.** `apps/api/tests/disputes.test.ts` (5 tests). Raised by the
buyer, evidence uploaded by both sides through the same EXIF-stripping ingest as
every other photo, resolved by an admin with a partial refund, money moved in
minor units, and the yard's score falls with the reason visible on their own
performance screen. A rejected dispute costs the yard nothing.

A defect was found here too: a dispute is usually raised *instead* of confirming
receipt, so the card is authorised and never captured — and the resolution threw
an illegal-transition error at the admin. Resolution is now expressed as what the
buyer ends up paying, and the instrument follows (refund if captured, void if
they pay nothing, reduced capture otherwise).

### g. A supplier cannot resolve a dispute raised against them

**Demonstrated.** Same file. The accused yard gets 403, the complaining buyer
gets 403, and the dispute stays open. Enforced twice: by the route guard and
again inside `resolveDispute`, which re-checks that the resolver is an admin and
is neither party to the order.

### h. The dress-rehearsal script

**Demonstrated.** `docs/DRESS-REHEARSAL.md` — preparation checklist, six
scenarios (happy path, silence, withdrawal after winning, physical power cut,
an attempt to go around the platform, a wrong part), what to observe and what
"pass" looks like at every step, a running order for the morning, a rollback
table where nothing requires a deploy, and the changes needed to run it
unchanged in South Africa.

### i. Screenshots of every screen in Arabic RTL, including error and empty states

**Demonstrated for the supplier terminal. Not demonstrated for the buyer app.**

`node scripts/capture-rtl-pass.mjs` produced **36 screenshots** in
`docs/screenshots/rtl-pass/`: nine screens × two languages × two widths
(1280×800 tablet, 390×844 phone).

Screens: sign-in · live jobs · **no live jobs (empty)** · quote with a price
entered · **quote rejected for contact details (error)** · won jobs · stock
profile · performance and score · **offline with a queued offer**.

The script measures rather than asserts: it records `document.dir` for every page
and walks every element for horizontal overflow. Result, in
`docs/evidence/rtl-pass.json`:

- **Arabic pages that rendered left-to-right: 0.**
- **Pages with horizontal overflow: 0** — the check that matters for Arabic,
  which is routinely longer than the English it was translated from.

Layout problems found and fixed during this pass:

1. The Arabic catalogue spelled numerals by hand (`٣٠ يومًا`) while every
   Intl-formatted number on the same screen rendered in Latin digits, because
   that is what `ar-AE` does. One screen, two numbering systems. Numbers are now
   parameters formatted by Intl, and a test fails on any digit written into a
   translation, in any of the three catalogues.
2. The contact-details rejection told the yard *no* without telling them *why*.
   The reason — that the anonymity is what protects their next job and is why
   they are paid automatically — is now on the screen.
3. The clients composed `ar-AE` from a language and a hardcoded region, and
   defaulted the market to `AE`. Fixed by a public `GET /v1/markets`.

**The buyer app has no screenshots.** It is React Native; rendering it needs an
Android emulator, and there is none in this container. What exists instead:
`apps/buyer/src/lib/rtl.test.ts` asserts that the app calls
`I18nManager.forceRTL` (without which Arabic renders inside a left-to-right
frame), that no style uses a physical edge, that text alignment follows
direction, that no string contains a directional arrow, that no translated text
is clamped to one line, and that the empty and error states have real Arabic
copy. To produce the screenshots: `pnpm --filter @ninety/buyer android` on a
machine with the Android SDK, with the device language set to Arabic.

### j. A native Arabic speaker reviewed the supplier-facing copy

**Not done. There is no Arabic speaker in this container, and this is not
something to claim.**

The copy was written to be read by one, and three specific things need a native
eye before launch:

1. **Numeral-noun agreement.** Arabic inflects nouns by count (١ ساعة، ساعتان،
   ٣ ساعات، ١١ ساعة). The templated strings use the form that goes with digits
   (`{{hours}} ساعة`), which is standard for interpolated values but is not
   always what a person would say.
2. **Trade register.** `استوب خلفي يمين` for a rear right tail lamp is the trade
   word used in Sharjah, not the dictionary word. Every part name needs that
   check — a grammatically perfect translation can still be wrong on a counter.
3. **The anonymity explanation.** It is the paragraph the whole business model
   rests on, and it has to persuade, not merely inform.

The mechanism to act on the review already exists: every string is in
`apps/api/src/i18n/catalogues/ar.json`, `apps/terminal/src/locales/ar.json` and
`apps/buyer/src/locales/ar.json`, and changing one changes the product and
regenerates the unhappy-paths document.

---

## Earlier phases, in brief

| Phase | Gate | Status |
|---|---|---|
| 00 Foundations | Market values not in code; Arabic parity fails the build; money in minor units; state machine rejects an illegal transition | Demonstrated — `scripts/guard-demo.sh` and `scripts/locale-demo.sh` make each guard fail, then pass; `tests/phase-00-foundations.test.ts` (19 tests) |
| 01 Requests and terminal | Request with a map pin; EXIF stripped; contact details rejected in both numeral systems; terminal usable in Arabic | Demonstrated — `src/media/pipeline.test.ts`, the scrub tests, the RTL screenshots |
| 02 Matching and clock | Fan-out explained per candidate; deadlines absolute; timers are delayed jobs with a reconciliation sweep | Demonstrated — `tests/full-loop.test.ts`, `/v1/admin/requests/:id/match-decisions` |
| 03 Offers and buyer app | Anonymisation on a type that cannot carry identity; ranked by price, never by score | Demonstrated — `src/offers/to-buyer-view.test.ts`, the anonymity sweep |
| 04 Payments | Authorise on acceptance, capture on delivery, void on failure; 10,000-order reconciliation | Demonstrated — `src/payments/pricing.test.ts`, `tests/full-loop.test.ts`. **Against the stub provider**: no Stripe credentials exist here |
| 05 Logistics | Courier abstraction with failover; tracking that cannot leak a pickup | Demonstrated — `tests/full-loop.test.ts`, the anonymity sweep. **Against stub couriers** |
| 06 Admin console | Board, metrics, supply pipeline, demand, market editor, disputes | Demonstrated — `docs/screenshots/admin-*.png`. **The phase document was not supplied**; the scope was reconstructed from the product and technical specifications, which is a risk worth naming |
| 08 Android release | Three build profiles with distinct ids, store listings in both languages, data-safety declaration checked mechanically | Partly — `scripts/check-data-safety.mjs` was proved to fail on an undeclared permission and then pass. **No `.aab` was produced: there is no Android SDK and no Play credentials here** |

---

## What is not proved, in one place

1. **No physical power-cut test.** Software cannot stand in for it. Scenario 4 of
   the rehearsal is written for it.
2. **No native Arabic review.** Three specific items listed above.
3. **No real payment provider.** Everything runs against the stub. The interface
   is provider-agnostic by construction, but the first Stripe call in anger will
   find something.
4. **No real courier.** Same.
5. **No Android build artefact.** No SDK, no signing key, no Play account.
6. **No region-pinned deployment.** There is no cloud account attached to this
   repository. The application reads one `DATABASE_URL`, one `REDIS_URL` and one
   media configuration per environment, so there is exactly one place to set it.
7. **Phase 06's specification was reconstructed**, not read.
