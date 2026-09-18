# Release and rollback

## Tracks

```
internal    → the team, minutes to propagate
closed      → named testers: workshops and yards you trust. The real pre-launch track
open        → skipped. An open beta before launch day is a way to lose the first impression
production  → launch, staged
```

Run the Phase 07 dress rehearsal on the **closed** track with real Sharjah and
Dubai yards and real workshops. That is what the closed track is for, and
running it there rather than in production is what makes a bad result cheap.

## The pipeline

| Trigger | What happens |
| --- | --- |
| Merge to `main` | CI builds a production `.aab` and uploads it to **internal** |
| Manual promotion | internal → closed, after the team has used it |
| Manual promotion | closed → production at 10%, after the rehearsal passes |

Every step is deliberate except the first. An automatic promotion to production
is a way to ship a Friday afternoon regression to a whole market.

## Staged rollout

| Stage | Hold for | Halt if |
| --- | --- | --- |
| 10% | 24 hours | crash-free sessions < 99.0%, or any crash in the payment or offer path |
| 25% | 24 hours | crash-free < 99.2%, or ANR rate above baseline |
| 50% | 24 hours | crash-free < 99.4% |
| 100% | — | — |

Watch the funnel as well as the crash rate. A release that does not crash and
halves the rate of requests reaching an accepted offer is worse than one that
crashes visibly, because nobody pages you for it.

## Halting a rollout

1. Play Console → Production → **Halt rollout**. Takes effect within minutes for
   anyone who has not already updated.
2. Post in the incident channel with the version and what you saw.
3. Decide: roll forward with a fix, or roll back.

## Rolling back

Google Play cannot un-ship a version. A rollback is shipping the previous build
with a higher version code.

1. Halt the rollout, as above.
2. Check out the previous release tag:
   ```bash
   git checkout release/android-v1.4.2
   ```
3. Build with a **new, higher** version code — the old one cannot be reused:
   ```bash
   APP_ENV=production ANDROID_VERSION_CODE=<previous + 2> \
     eas build --platform android --profile production
   ```
4. Submit and roll out at 100% to the affected track: everyone on the bad
   version needs this, and staging it slowly leaves them on the bad version
   longer.
5. If the bad version broke against the API rather than on its own, also raise
   `MIN_BUYER_APP_VERSION` on the API so the bad build blocks itself. That is
   what the forced-update check is for, and it works even for users who have not
   yet taken the fix.
6. Write down what happened before anyone goes home.

## Before every production release

- [ ] CI is green on `main`
- [ ] Version code is higher than the last one uploaded
- [ ] `store/DATA-SAFETY.md` still matches the permissions in `app.config.ts`
- [ ] The store description still says "typically 90 minutes, up to 3 hours in
      peak traffic" and does not promise a guarantee
- [ ] Arabic listing and Arabic RTL screenshots are current
- [ ] A crash from this build appears in the dashboard with a readable stack
      trace — confirm source maps uploaded
- [ ] The full loop completed on a real device from the `.aab`, not from Expo Go
