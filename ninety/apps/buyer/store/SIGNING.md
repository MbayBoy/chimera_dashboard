# Signing and release keys

## What you must hold, and where

| Item | Where it lives | Who holds it |
| --- | --- | --- |
| Upload key (`.jks`) | Your password manager, **and** an offline backup you control | Two named people |
| Upload key password | Password manager | Same two people |
| Play App Signing key | Google holds it. You never see it | — |
| Play service account JSON | CI secret `GOOGLE_PLAY_SERVICE_ACCOUNT` | CI, plus a backup |

**The upload key must not exist only in CI.** CI gets wiped, rotated and
rebuilt. If the key exists nowhere else, recovering it becomes a Google support
process — during launch week, which is the worst week of the year for it.

Enrol in Play App Signing. It means a lost upload key is recoverable rather than
terminal, but treat that as insurance, not as a plan.

## Generating the upload key

EAS can manage credentials for you. If you would rather hold the key yourself:

```bash
keytool -genkeypair -v \
  -keystore ninety-upload.jks \
  -alias ninety-upload \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

Then:

1. Store `ninety-upload.jks` and its passwords in the password manager.
2. Put a copy on encrypted offline media, held by someone other than the person
   who made it.
3. Upload the public certificate to the Play Console when enrolling.
4. Give EAS the keystore with `eas credentials`.

## Verifying a build before it goes anywhere

```bash
# What is actually inside the bundle
bundletool validate --bundle=build.aab

# Which key signed it
jarsigner -verify -verbose -certs build.aab | head -40
```

## If the upload key is lost

1. Generate a new one as above.
2. Open a Play Console support request to reset the upload key, attaching the
   new public certificate.
3. Expect days, not hours.
4. Meanwhile you cannot ship an update. Plan for that, or hold the backup.
