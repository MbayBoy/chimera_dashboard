# Dress rehearsal

**Who runs this:** one non-technical person, with a phone, a laptop and the ops
console open. No engineer is required, and no step needs a terminal window.

**Who takes part:** twenty yards and ten friendly workshops. In the UAE that is
Sharjah Industrial Areas 1–4 and Al Aweer for supply, and workshops in Al Quoz
and Ras Al Khor for demand. For South Africa in month 11, the same script runs
unchanged with the yards and workshops of Johannesburg South.

**How long:** one day of preparation, one morning to run.

**Why it exists:** launch week decides whether the market thinks NINETY works. A
workshop that posts a request and gets silence does not post a second one, and
they tell the other workshops. Everything below is a rehearsal of the silence.

---

## Before the day

| # | Step | Done when |
|---|---|---|
| P1 | Confirm the market is live in the ops console (Markets → the market → "Live") | The badge reads Live |
| P2 | Confirm every participating yard shows onboarding stage **test request passed** (Supply) | Twenty rows, all at the last stage |
| P3 | Confirm every yard's stock profile has makes, models and part categories set | No yard shows an empty profile |
| P4 | Confirm each yard's tablet is charged, on the yard's own Wi-Fi, and showing the live-jobs screen | Twenty green dots in Supply |
| P5 | Confirm each workshop has the buyer app installed and has signed in once | Ten accounts in the console |
| P6 | Agree the WhatsApp group for the morning, with one person per yard in it | Group exists, everyone replies |
| P7 | Tell every participant, in writing, that this is a rehearsal and the parts are real but the money is test money | Everyone has confirmed |
| P8 | Put the ops phone number on a card at each yard | Twenty cards delivered |

**If P2, P3 or P4 fails for a yard, that yard does not take part.** A yard whose
first experience of NINETY is a job they could not answer is worse than a yard
that was not invited.

---

## Scenario 1 — The happy path

**What we are testing:** the whole loop, at the speed the promise claims.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 1.1 | Workshop A posts a request for a part you have already confirmed at least three yards stock. Photograph included. | The reference appears in the ops console within seconds | A reference like `REQ-XXXXXX`, status **Finding yards** |
| 1.2 | Count the yards that received it (Ops → the request → fan-out) | The number and the tier | At least five yards, tier 1 |
| 1.3 | Stand at one of those yards and watch the tablet | The alert, the sound, the countdown | The job appears within 10 seconds, with a counting-down clock |
| 1.4 | The yard quotes: photograph, price, condition, warranty, ready-in | The payout line | The screen shows what they will be paid, not a percentage |
| 1.5 | Two more yards quote | Offers arriving | The workshop's app shows offers appearing live |
| 1.6 | Wait for the response window to close | The buyer's screen | Offers become choosable at the deadline, not before |
| 1.7 | The workshop looks at the offers | What they can see | **Price, condition, warranty, distance and photographs — and nothing that identifies a yard.** No name, no phone, no direction |
| 1.8 | The workshop accepts the cheapest and pays with a test card | The confirmation | "Payment ring-fenced", not "paid" |
| 1.9 | Watch for the driver | The yard's screen | The winning yard sees they won, with the payout and the packaging rule |
| 1.10 | The driver collects and delivers | Both screens | The buyer sees progress; the buyer never sees a map of where it came from |
| 1.11 | The workshop confirms receipt | The money | Only now is the card charged; the yard's payout is queued |
| 1.12 | Ask the workshop, out loud: did you know which yard it came from? | Their answer | "No" |

**Stop the rehearsal if:** the offers show anything identifying a yard, or the
card is charged before delivery. Both are launch blockers, not observations.

---

## Scenario 2 — Nobody answers

**What we are testing:** that silence is handled, and that it is spoken about.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 2.1 | Ask every yard to ignore the next job deliberately | Nobody quotes | Nothing on any screen |
| 2.2 | Workshop B posts a request | The countdown | Ops shows **Waiting for offers** |
| 2.3 | Wait for the response deadline (15 minutes in the UAE) | The buyer's phone | A message saying the search has been **widened**, with a time by which they will hear either way |
| 2.4 | Watch the yards' tablets again | A second wave | More yards receive it, including ones further away |
| 2.5 | Keep ignoring it until the second deadline | The buyer's phone | A message saying plainly that nobody had it, and that it has been logged |
| 2.6 | Open Ops → Demand → Unfilled | The miss | A row naming the part, the vehicle, the area and the time |

**Pass condition that matters:** the workshop was told twice and never left in
silence. Ask them whether they would post again. Write down the answer.

---

## Scenario 3 — A yard withdraws after winning

**What we are testing:** that the buyer is not stranded and the money is released.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 3.1 | Run scenario 1 as far as acceptance, with at least two offers | The order | "Payment ring-fenced" |
| 3.2 | The winning yard opens the job and withdraws it, giving a reason | Their screen | Withdrawal accepted; the yard is told it affects their score |
| 3.3 | Look at the workshop's phone | The message | Told the yard withdrew, that **nothing has been charged and the hold is released**, and that their other offers are open again |
| 3.4 | The workshop accepts the second offer | The loop continues | A new order, a new driver |
| 3.5 | Open Ops → Supply → that yard | The score | The score has fallen, and the reason is visible |

---

## Scenario 4 — The power goes out

**What we are testing:** the failure that decides whether yards stay.

Do this **physically**. Pull the plug or hold the power button. Do not turn off
Wi-Fi and call it a power cut — a tablet dying mid-upload is a different failure.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 4.1 | A yard starts a quote: photograph taken, price typed | The draft | Everything on screen |
| 4.2 | **Kill the power to the tablet** while the quote is open | Nothing | The tablet is off |
| 4.3 | Power it back on and open the terminal | The recovery | The quote is still there, with its photograph and price |
| 4.4 | Send it | The banner | "Saved. It will send when the connection returns" if still offline; sent, if online |
| 4.5 | Restore the connection | The outbox | The offer sends by itself. The counter returns to zero |
| 4.6 | Open Ops → that request | The response time | The time credited is **when they composed it**, not when the power came back |
| 4.7 | Post another request while one yard's tablet is switched off | That yard's record | Ops shows the fan-out as **unreachable**, not as a no-response |
| 4.8 | Open Ops → Supply → that yard | Their score | **Unchanged.** A yard must never lose score for a power cut |

**Stop the rehearsal if 4.8 fails.** Penalising a yard for infrastructure is the
fastest way to lose the yards that took three months to sign.

---

## Scenario 5 — Somebody tries to go around us

**What we are testing:** the rule the business rests on, and whether a yard
understands it after meeting it once.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 5.1 | A yard quotes and puts their phone number in the note | The rejection | The quote is **refused**, the note is not sent, and the number is not quietly deleted |
| 5.2 | Read the message on their screen | The reason | It says why: both sides stay anonymous, that is what protects their next job, and it is why they are paid automatically |
| 5.3 | Try again with the number written in Arabic-Indic numerals (٠٥٠١٢٣٤٥٦٧) | The rejection | Refused the same way |
| 5.4 | Try "واتساب" in the note | The rejection | Refused |
| 5.5 | Remove it and send | The quote | Accepted normally |
| 5.6 | Ask the yard: do you understand why? | Their answer | They repeat the reason back in their own words |

---

## Scenario 6 — Something arrives wrong

**What we are testing:** that a complaint has a route that is not a phone call.

| # | Do this | Watch for | Pass looks like |
|---|---|---|---|
| 6.1 | Complete a delivery, then the workshop raises a problem instead of confirming | The order | Status **Under review**; the card is not charged |
| 6.2 | Both sides add a photograph as evidence | The case | Two photographs in Ops → Disputes |
| 6.3 | Ask the yard to close the case in their own favour | The refusal | They cannot. Only NINETY resolves a case |
| 6.4 | Resolve it with a part refund from the console | The money | The workshop is charged the reduced amount, and told |
| 6.5 | Open Ops → Supply → that yard | The score | The score has fallen, with the reason visible |

---

## The morning, in order

1. 08:00 — everyone on the WhatsApp group confirms their tablet is on.
2. 08:30 — Scenario 1, twice, with two different workshops.
3. 09:15 — Scenario 5 at one yard while the others watch.
4. 09:30 — Scenario 2. Use the wait to walk the yards.
5. 10:15 — Scenario 3.
6. 10:45 — Scenario 4 at two yards, one of them the busiest.
7. 11:15 — Scenario 6.
8. 11:45 — Everyone on a call. Three questions, in this order:
   - What was confusing?
   - What was slower than you expected?
   - Would you use it tomorrow without us standing here?

Write down the answers verbatim. The third answer is the result of the
rehearsal.

---

## Rollback

Anything here is reversible, and none of it needs a deploy.

| Situation | Do this | Effect |
|---|---|---|
| One yard is having a bad time | Ops → Supply → that yard → **Suspend** | They stop receiving jobs immediately. Their score is untouched |
| The whole rehearsal is going wrong | Ops → Markets → the market → turn **Live** off | No new request fans out anywhere. Requests already in flight finish |
| A request is stuck | Ops → the request → **Intervene** → extend or close with a reason | The buyer is told. Nothing is left silently open |
| Money moved that should not have | Ops → the order → refund with a reason | The workshop is refunded and told |
| A tablet is lost or stolen | Ops → Supply → that yard → **Tablet** → revoke | That terminal's session stops working |

**Do not** roll back by editing the database. Every control above writes an
audit row; a direct edit does not, and the next person to look will not know
what happened.

---

## Using this again for South Africa

The script is unchanged. Only the market configuration differs, and none of it
is in the script:

| | UAE | South Africa |
|---|---|---|
| Language | Arabic first, English second | English |
| Layout | Right to left | Left to right |
| Vehicle identifier | Chassis number | VIN |
| Address | Map pin, Makani where given | Map pin, street address |
| Tax | As configured for the market | As configured for the market |
| Weekend | As configured | As configured |
| Extra rehearsal step | — | Run scenario 4 during an actual load-shedding window. It is a daily operating condition, not an edge case |

The only change to the preparation list: for South Africa, P4 becomes "tablet
charged **and** the yard's power schedule known", and scenario 4 is run twice.
