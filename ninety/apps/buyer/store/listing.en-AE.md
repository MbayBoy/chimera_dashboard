# Play Store listing — en-AE

## App name (30 characters)

```
NINETY — Car Parts in 90 Min
```

## Short description (80 characters)

```
Post the part you need. Anonymous offers in 30 minutes. Delivered in 90.
```

`72 characters.`

## Full description (4,000 characters)

```
Post the part you need. Get offers in 30 minutes. Have it delivered in 90.

NINETY is a faster way for workshops, panel beaters and fleet operators to
source second-hand car parts. Instead of phoning six scrapyards and waiting for
callbacks that never come, you post what you need once and every relevant yard
in your area sees it at the same moment.

HOW IT WORKS

1. Post what you need — under a minute
   Scan the chassis number or pick the make, model and year. Choose the part,
   photograph the damaged one, and drop a pin where the driver should come.

2. Yards have 15 minutes to answer
   Your request goes out to every yard that breaks your vehicle, at once, on a
   screen sitting on their counter. They have fifteen minutes to respond with a
   photo of the actual part, a price, the condition and a warranty.

3. Offers come back anonymous
   You see the price, the condition, the warranty, how far away it is and how
   soon it is ready. Sorted cheapest first by default. You compare on what
   matters instead of on who you happen to know.

4. Choose one, and your card is authorised
   Authorised, not charged. The money is only taken when the part arrives.

5. A driver collects and delivers
   Typically within 90 minutes, and up to 3 hours in peak traffic. You confirm
   it arrived, and only then is the payment taken. If the delivery fails, the
   hold on your card is released and nothing is charged.

WHY WORKSHOPS USE IT

• One request instead of six phone calls
• Real prices you can compare, side by side
• A photo of the actual part before you commit
• A car off the lift the same day instead of two days later
• Payment protected until the part is in your hands
• Available in Arabic and English

WHAT IT COSTS

Free to join. A small service fee on completed orders, shown in full before you
pay. No subscription and no minimum.

HONEST ABOUT THE TIMING

Ninety minutes is what we aim for and usually achieve in-metro and off-peak.
In peak traffic it can take up to three hours. We tell you an expected time,
we tell you when it changes, and we would rather publish a promise we keep
than one that sounds better.

WHERE IT WORKS

Dubai and Sharjah now. More cities as we grow.

QUESTIONS

Contact support from inside the app.
```

`Approximately 2,050 characters.`

## Required assets

| Asset | Requirement | Status |
| --- | --- | --- |
| App icon | 512×512 PNG, 32-bit, under 1 MB | `store/assets/icon-512.png` |
| Feature graphic | 1024×500 PNG or JPEG, no alpha | `store/assets/feature-graphic.png` |
| Phone screenshots | 2–8, min 320px, max 3840px, 16:9 or 9:16 | `store/assets/screenshot-*.png` |
| Privacy policy URL | Publicly reachable, no login | **Needed from you** |

## Screenshots to submit

Each one shows a step of the loop, with a caption burnt in:

1. `screenshot-1-post.png` — "Post the part you need"
2. `screenshot-2-waiting.png` — "Offers in 30 minutes"
3. `screenshot-3-offers.png` — "Compare anonymous offers"
4. `screenshot-4-tracking.png` — "Delivered in 90 minutes"

## Content rating questionnaire

| Question | Answer |
| --- | --- |
| Violence, sexual content, profanity, drugs | None |
| User-generated content shared publicly | No — photos go to the counterparty only |
| Users can communicate with each other | No — communication is relayed and identities are hidden |
| Shares location | Yes — with our own service, to route a delivery |
| Digital purchases | No — payments are for physical goods |
| Expected rating | Everyone / PEGI 3 |

## What is needed from the Play Console

In order. Nothing here is development work and none of it can be compressed.

1. **An organisation developer account** — not a personal one. A personal
   account created after 13 November 2023 must run a closed test with at least
   12 testers opted in continuously for 14 days before it can even apply for
   production access. An organisation account with a D-U-N-S number is exempt.
2. **A D-U-N-S number** for the holding company. Days to weeks to obtain.
3. **Identity verification** completed on the account. Longer again.
4. The one-time **US$25 registration fee**.
5. A **Google Play service account JSON**, downloaded from the Play Console and
   stored as the `GOOGLE_PLAY_SERVICE_ACCOUNT` secret, for automated submission.
6. The **app created in the console** under the package name `ae.ninety.buyer`.
7. The **privacy policy URL**.
8. **App signing** enrolled (Play App Signing), with the upload key backed up
   somewhere you control — see `store/SIGNING.md`.
