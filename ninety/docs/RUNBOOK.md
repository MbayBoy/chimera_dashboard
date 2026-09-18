# Runbook

For the person on call, and for the person setting this up for the first time.

---

## Running it

```bash
cd ninety
pnpm install
./infra/dev-services.sh start     # PostgreSQL 16 + PostGIS 3.4, Redis 7
                                  # or: docker compose -f infra/docker-compose.yml up -d
cp .env.example .env              # then fill in the secrets
pnpm bootstrap                    # migrate + seed
pnpm dev                          # API on :3000
pnpm --filter @ninety/terminal dev # supplier terminal on :5173
pnpm --filter @ninety/admin dev    # ops console on :5174
```

The seed creates two markets (AE live, ZA configured and not live), eight yards,
a few workshops, an admin, part categories and vehicles. Phone numbers are in the
synthetic `+999` range so nothing real is reachable, and `OTP_ECHO_IN_RESPONSE`
returns the code in the response in development. **Production refuses to start
with that set.**

## Environment

| Variable | What it does |
|---|---|
| `DATABASE_URL` | PostgreSQL with PostGIS. **This is where the region is pinned.** |
| `REDIS_URL` | Timers, queues, rate limits, config cache |
| `REDIS_NAMESPACE` | Key prefix. Distinct per environment, or a test run reads a dev server's cached config |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing. Rotating refresh tokens |
| `MEDIA_DRIVER` | `local` or `s3`. **The second place the region is pinned** |
| `TIMER_SPEED_FACTOR` | Compresses the product clock for tests and rehearsals. **1 in production** |
| `TIMER_CONCURRENCY`, `DATABASE_POOL_MAX` | Sized together: a timer job holds a connection for its work |
| `MIN_BUYER_APP_VERSION` | Below this the app blocks and prompts to update |
| `OTP_ECHO_IN_RESPONSE` | Development only. Production refuses to start with it true |

## Health

`GET /v1/health` reports the database, the PostGIS version and Redis. It names
the PostGIS version deliberately: its absence is invisible until a radius query
returns plausible numbers that are wrong.

---

## When something is wrong

### Requests are being created but nothing fans out

1. `GET /v1/health` — is PostGIS there?
2. Ops → the request → match decisions. Every candidate is recorded with its
   components and the reason it was or was not selected. If the list is empty,
   the matching job never ran; if it is full of exclusions, the engine did its
   job and the answer is in the numbers.
3. Check the matching queue. A job in `failed` carries its reason.
4. **`no spatial operator found for 'st_dwithin'`** means a connection is holding
   a PostGIS operator-class cache from a schema that has since been dropped and
   recreated. Restart the API. It cannot happen without a schema reset.
5. Check the hourly ping budget: a yard is capped, on purpose, and a load test
   that did not clear the counters will have exhausted it.

### Deadlines are firing late

The worker logs `timer fired late` with the lateness in milliseconds whenever it
exceeds five seconds. If it is a burst, raise `TIMER_CONCURRENCY` **and**
`DATABASE_POOL_MAX` together — raising concurrency alone buys queueing inside the
pool. If they are late by minutes, Redis lost the delayed jobs: the 60-second
reconciliation sweep will recover them from the database, and the sweep finding
work is itself the alarm.

### A request is stuck

Ops → the request → Intervene. Extend the window or close it with a reason. Both
write an audit row and both tell the buyer. Never edit the database directly: the
next person to look will not know what happened.

### The clock on a terminal is wrong

The terminal detects its own drift against the server time returned with every
poll and shows a warning. Deadlines are absolute UTC timestamps from the server,
so a wrong tablet clock changes what is displayed, never what is enforced.

### A payout has not gone out

`payout_queue`. Status `blocked_kyc` means the yard is not verified — that is the
rule working. Verify them in Ops → Supply, and the next run releases it.

---

## Turning things off

| Situation | Action | Effect |
|---|---|---|
| One yard is causing trouble | Ops → Supply → Suspend | They stop receiving jobs immediately |
| A market is misbehaving | Ops → Markets → Live off | No new request fans out; in-flight requests finish |
| A courier provider is down | Ops → Markets → remove it from the provider list | Failover uses the remaining ones |
| A tablet is lost | Ops → Supply → Tablet → revoke | That terminal's session stops working |

Every one of these is a configuration change, audited, with no deploy.

---

## Deployment, and the two things this repository cannot do for you

1. **Region pinning.** UAE data must be in a UAE region: the database, Redis,
   object storage and the backups. Nothing in the application chooses a region —
   it reads one `DATABASE_URL`, one `REDIS_URL` and one media configuration per
   environment, so there is exactly one place per environment to get this right,
   and it is outside this repository. Do it before the first real buyer.
2. **Secrets.** No credential for Stripe, a courier or Google Play exists here.
   The payment and courier providers fall back to stubs and say so in the log at
   start-up. Set them, and the same interfaces pick them up — nothing in
   application code knows which provider it is talking to.

## Backups

The financial record must survive for the retention period configured per market
(`markets.financial_retention_years`). Two things follow: backups are in the same
region as the data, and a restore has to be tested — a backup nobody has restored
is a hypothesis. Not set up here, for the same reason as above.

## Releasing the Android app

`docs/../apps/buyer/store/ROLLOUT.md` has the staged rollout. In short: internal
track, then 10% of production, then 50%, then 100%, with a day at each step and
the crash rate watched between them. `scripts/check-data-safety.mjs` runs in CI
and fails the build if the manifest asks for a permission the Play data-safety
declaration does not mention — proved by adding `RECORD_AUDIO` and watching it
exit 1.
