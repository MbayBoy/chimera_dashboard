# Decisions

The ones that were not obvious, with the reasoning, so the next person can
disagree with the argument rather than guess at it.

---

## 1. The compression of the product clock lives on the deadline, not the timer

`TIMER_SPEED_FACTOR` lets a fifteen-minute window be watched end to end in a
test or a rehearsal. It originally divided the queue delay, which meant the
deadline the API published and the moment the server acted on it disagreed by
the whole difference: at factor 600 a timer fired 12.5 minutes "early" against a
deadline nobody honoured, and a terminal in a sped-up rehearsal would render a
fifteen-minute countdown over a window closing in seconds.

It now applies to the deadline itself, in one function (`core/clock.ts`), and the
timer waits for exactly the published moment. At the production default of 1 it
is the identity function.

**Cost:** a knob that changes stored data, not only scheduling. Acceptable
because it is one function and it is tested.

## 2. A timer job's only obligation is the transition

Tier-2 widening and supplier score bookkeeping both ran inside the response
deadline job. Under 500 simultaneous deadlines that meant every job queued behind
several hundred fan-out rows of other people's work: 86 late fires, worst 10 s.

Widening now goes on the matching queue — the same queue submission already uses
— and scoring runs after the transition rather than before it. Worst case fell to
2.5 s with nothing late.

**The rule this encodes:** what the buyer is watching for happens at the
deadline; the bookkeeping that follows can follow.

## 3. Disputes are settled by "what the buyer ends up paying"

The obvious model is "refund N". It breaks immediately, because a dispute is
usually raised *instead* of confirming receipt, so there is nothing to refund —
the card is authorised and never captured. The first version threw an
illegal-transition error at the admin trying to resolve a genuine complaint.

Expressing the outcome as the amount the buyer pays makes all three cases the
same decision: refund the difference if captured, void if they pay nothing,
capture the reduced amount otherwise. Money moves once per order, and the total
charged is the number the admin decided, in minor units, in every branch.

## 4. Erasure is anonymisation in place, never DELETE

Both markets require the financial record of a completed sale to be kept for
years, and both give a person the right to have their personal data deleted. A
cascade delete satisfies the second and breaks the first, and leaves a database
where orders point at buyers who no longer exist.

Identifiers are overwritten, rows survive, and the delivery pin is coarsened to
a ~1 km grid rather than dropped — the column is NOT NULL and the demand dataset
is about which city wanted which part, not which workshop.

**The test that matters** is not "the name is gone" but "every foreign key still
resolves". A deletion that breaks referential integrity is found three months
later by a reconciliation job.

## 5. A public `GET /v1/markets`

Every client needs to know what market it is in, and in what language to render
its sign-in screen, before it has a session to read that from. The shortcut is
`VITE_MARKET_CODE ?? 'AE'` and `language === 'ar' ? 'ar-AE' : 'en-AE'`, and it
is how one application becomes two: the same binary announces the wrong country
the moment it ships anywhere else.

Nothing on that endpoint is confidential — it is what a market is, not who is in
it.

## 6. Numbers in messages are parameters

Two different bugs wear the same disguise, and both shipped before the rule
existed:

- A market value hiding where the market-value guard does not look. "Yards have
  15 minutes to answer" is the response SLA typed into a sentence.
- A numbering system decided by hand. The Arabic catalogue spelled "٣٠ يومًا"
  while every Intl-formatted number on the same screen rendered in Latin digits,
  because that is what `ar-AE` does.

`findHardcodedNumbers` now fails the build on a digit in any of the three
catalogues, in Latin or Arabic-Indic script.

**Cost:** Arabic numeral-noun agreement is not expressible this way, which is
the first thing on the list for a native reviewer.

## 7. The unhappy-paths document is generated

The failure mode the phase warns about is a catalogue of copy that drifts from
the product: a message is reworded in the app, the document keeps the old
wording, and the launch team quotes the document. `docs/UNHAPPY-PATHS.md` is
produced from the shipping catalogues, so it cannot.

## 8. The load test does not seed offers into the database

It creates them through the real endpoint from 200 authenticated terminals on
live WebSockets, so row locks, the state machine and the score writes are under
the same contention. It also clears the hourly ping budgets first and says so:
that cap is correct in production and would otherwise make the second run of the
test measure the cap rather than the system.

It counts the pings that actually arrive on the sockets, because a fan-out that
wrote a database row and never reached a screen is not a fan-out.

## 9. Each test file gets its own Redis namespace

A shared namespace let a matching worker belonging to an earlier test file pick
up a later file's job and run it against a connection pool predating that file's
schema reset. The failure was `no spatial operator found for 'st_dwithin'`, once,
somewhere in a long run — which reads as a broken PostGIS installation and is
not.

Related: `resetDatabase` now throws its connections away, because dropping the
schema takes PostGIS with it and a surviving connection keeps the operator-class
cache of a schema that no longer exists.

## 10. A yard offline at fan-out is `unreachable`, not `no_response`

The score delta for `unreachable` is exactly zero, and it is asserted in two
different test files. This is the single commercially important line in the
scoring code: penalising a yard for a power cut is the fastest way to lose the
yards that took three months to sign, and in South Africa from month 11 it would
happen daily.

## 11. Contact details are rejected with a reason

Refusing the note is the rule. Refusing it *without saying why* produces a
supplier who concludes the product is broken — so the terminal now explains that
the anonymity is what protects their next job and is why they are paid
automatically and the delivery is handled.

## 12. What was deliberately not built

- **No live driver map.** Distance, never bearing. Distance plus direction
  locates a workshop in about four seconds.
- **No wallet, no balance, no stored value.** Holding money for two parties can
  make this a regulated payments intermediary in both markets.
- **No supplier ranking by score.** Score governs distribution, never selection;
  offers are ranked by price.
- **No in-app messaging.** It is the obvious feature request and it is the end of
  the business model.
- **Mandatory donor-VIN capture on high-value parts** is specified in
  `docs/SECURITY-AND-COMPLIANCE.md` and **not enforced in code**. It is the first
  item on the Phase 2 list; adding it during a hardening phase would have been
  the new feature the phase explicitly forbids.
