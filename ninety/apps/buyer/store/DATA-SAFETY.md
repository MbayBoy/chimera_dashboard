# Play Data Safety declaration

This is a compliance statement about what the app actually collects, not a
template. Corrections after publication are slow, and a declaration that
disagrees with the app's behaviour is a policy violation rather than a typo.

It must stay in step with three things: the permissions in `app.config.ts`, the
privacy policy, and what the code does. If any of those change, this changes.

## Summary

| | |
| --- | --- |
| Does the app collect or share user data? | **Yes** |
| Is all data encrypted in transit? | **Yes** — TLS on every request |
| Can users request deletion? | **Yes** — in-app, and `DELETE` honoured end to end |
| Has the app committed to the Play Families policy? | No — not a children's app |

## Data collected

### Location — approximate and precise

| | |
| --- | --- |
| Collected | Yes |
| Shared | Yes — with the courier company carrying the delivery |
| Processed ephemerally | No — the delivery pin is stored with the request |
| Required or optional | **Required.** A part cannot be delivered without a destination |
| Purpose | App functionality |

The pin the buyer drops is the delivery destination. It is passed to the courier
so a driver can find the workshop. It is **never** shown to the supplying yard.

### Photos

| | |
| --- | --- |
| Collected | Yes |
| Shared | Yes — with the yards asked to quote |
| Required or optional | **Required** |
| Purpose | App functionality |

A photograph of the damaged part, so yards can identify what is needed. All EXIF
metadata — location especially — is stripped on upload, before storage, in both
directions.

### Personal identifiers — phone number

| | |
| --- | --- |
| Collected | Yes |
| Shared | Yes — with the SMS provider that delivers the sign-in code |
| Required or optional | **Required** |
| Purpose | Account management, app functionality |

The phone number is the account. It is never shown to a supplier.

### Personal identifiers — name and business name

| | |
| --- | --- |
| Collected | Yes |
| Shared | No |
| Required or optional | Optional |
| Purpose | Account management |

### Financial — purchase history

| | |
| --- | --- |
| Collected | Yes |
| Shared | No |
| Required or optional | Required |
| Purpose | App functionality, fraud prevention |

### Financial — payment information

| | |
| --- | --- |
| Collected | **No** |
| Shared | No |

Card details are collected by the payment provider's own hosted fields and never
reach this app or our servers. What we hold is a provider token and the amounts,
which is the whole of our PCI position.

### App activity — app interactions

| | |
| --- | --- |
| Collected | Yes |
| Shared | No |
| Required or optional | Optional |
| Purpose | Analytics, app functionality |

Funnel events for the core loop: request created, offers received, offer
accepted, delivery confirmed. Enough to see where buyers drop out, and no more.

### Diagnostics — crash logs

| | |
| --- | --- |
| Collected | Yes |
| Shared | Yes — with the crash reporting provider |
| Required or optional | Optional |
| Purpose | Analytics |

## Deliberately NOT collected

Declaring these as absent is a commitment, and the code has to keep it:

- Contacts, calendar, SMS, call logs
- Microphone or audio
- Health, fitness, financial account numbers
- Advertising identifiers — there is no advertising SDK in this app
- Background location — location is requested only while the app is in use

## Keeping it honest

The analytics in this app must never exceed this declaration. That is why no
third-party analytics SDK is bundled: funnel events go to our own API, where
what is collected is visible in the code rather than in a vendor's changelog.

Before every release, check:

- [ ] Any new permission in `app.config.ts` is reflected here
- [ ] No dependency has added an advertising or analytics SDK
- [ ] The privacy policy says the same things in the same order
