# Ni90ty website — how to put it on Hostinger

Everything in this folder is the website. There is no build step, no
Node, no framework and no third-party request at run time: the fonts,
the logo artwork and the stylesheet are all served from your own domain.

Upload the **contents** of this folder into `public_html`. Not the folder
itself — `index.html` has to sit directly inside `public_html`, or you
will end up with the site at `ni90ty.com/website/`.

---

## 1. Upload

### Option A — hPanel File Manager (easiest)

1. Zip this folder's contents. On the command line, from inside the
   `website` folder:

   ```
   zip -r ni90ty-site.zip . -x '.DS_Store'
   ```

   Make sure the hidden `.htaccess` goes in — `zip -r` includes it, but
   if you zip by dragging in Finder or Explorer, hidden files are left
   out and the site will still work, just without clean URLs, caching or
   the security headers.

2. hPanel → **Files** → **File Manager** → open `public_html`.
3. Delete Hostinger's placeholder `default.php` or `index.html` if one is
   there.
4. Upload `ni90ty-site.zip`, right-click it, **Extract**, then delete the
   zip.
5. Confirm `index.html` is at the top level of `public_html`, not inside
   a subfolder.

### Option B — FTP

Hostinger gives you the details under **Files → FTP Accounts**. In
FileZilla, connect and drag the contents of this folder into
`public_html`. Turn on **Server → Force showing hidden files** first, or
`.htaccess` will not be transferred.

### Option C — Git

If your plan has Git deployment (hPanel → **Advanced → Git**), point it
at this repository and set the build path so that the `website` folder's
contents land in `public_html`.

---

## 2. Turn on HTTPS

hPanel → **Security → SSL**. Install the free certificate for the domain
and wait for it to go green.

The supplied `.htaccess` forces HTTPS from the first request. If you
upload it *before* the certificate is issued, the site will redirect to
an address that does not answer yet. Either install the certificate
first, or comment out the four lines under `# Force HTTPS` and put them
back afterwards.

Once HTTPS has been working for a few days, you can uncomment the
`Strict-Transport-Security` line near the bottom of `.htaccess`. Do not
do it sooner — browsers remember that header for a year, and it is
awkward to undo.

---

## 3. Pick one hostname

Decide whether the site lives at `ni90ty.com` or `www.ni90ty.com`, then
uncomment the matching block in `.htaccess` under `# Canonical host`.
Leaving both live means search engines see two copies of every page.

The `<link rel="canonical">` in each page and the URLs in `sitemap.xml`
currently say `https://ni90ty.com`. If you choose `www`, search and
replace `https://ni90ty.com` with `https://www.ni90ty.com` across the
`.html` files and `sitemap.xml`.

---

## 4. Make the forms work

The three forms — scrapyard registration, buyer early access and general
enquiries — post to `contact.php`. Open it and change the settings at the
top:

```php
const MAIL_TO        = 'hello@ni90ty.com';   // who receives enquiries
const MAIL_FROM      = 'website@ni90ty.com'; // must be a real mailbox on this domain
```

`MAIL_FROM` has to be an address that exists on your domain. Create it in
hPanel → **Emails** first. Shared hosts reject or silently drop mail that
claims to come from an address they do not host, which is why the
visitor's own address goes into `Reply-To` rather than `From`.

Then send yourself a test message from the live site and confirm it
arrives, including in the spam folder.

If nothing arrives, `contact.php` has `LOG_FALLBACK` set to `true`, so
every submission is also appended to `contact-log.txt` in `public_html`.
Read it over FTP. The supplied `.htaccess` blocks that file from the web;
if you ever remove the `.htaccess`, delete the log too.

**If you would rather not run PHP at all:** change each form's `action`
from `contact.php` to a hosted form endpoint (Formspree, Getform, Web3Forms
and similar all take a plain `POST`), delete `contact.php`, and set the
service's redirect to `thank-you.html`. The forms already carry a hidden
honeypot field named `company_url` that most of these services can use
for spam filtering.

---

## 5. Check it

- `https://ni90ty.com/` loads and the wordmark shows the cyan dial.
- `https://ni90ty.com/how-it-works` works without the `.html`.
- `https://ni90ty.com/nothing-here` shows the Ni90ty 404 page, not
  Hostinger's.
- A form submission reaches your inbox and lands on the thank-you page.
- `https://ni90ty.com/sitemap.xml` and `/robots.txt` both load.
- Open it on a phone.

Then submit the sitemap in Google Search Console.

---

## What is in here

```
index.html            Home
how-it-works.html     The loop, step by step
for-buyers.html       Workshops and fleets, with the early-access form
for-suppliers.html    Scrapyards, with the registration form
markets.html          Where it runs, and what differs per country
company.html          What is being built, and what is honestly hard
contact.html          Three routes in, plus the general form
brand.html            The mark, ink and type, with artwork to download
privacy.html          Website privacy notice        — needs legal review
terms.html            Website terms                 — needs legal review
thank-you.html        Where a submitted form lands
404.html              Not found

contact.php           Form handler. Configure before going live.
.htaccess             Clean URLs, HTTPS, compression, caching, headers
robots.txt            Crawl rules, points at the sitemap
sitemap.xml           All indexable pages
site.webmanifest      Icons and colours for add-to-home-screen
favicon.ico           16, 32 and 48 px

assets/site.css       The whole stylesheet
assets/fonts.css      @font-face for Source Serif 4
assets/fonts/         Four variable woff2 files, plus the OFL licence
assets/img/           Logo artwork, app icons, favicons, share image
```

## Editing the pages

The `.html` files are ordinary HTML — edit them in any editor and
re-upload.

They were generated from `tools/build_site.py` in this repository, which
holds the masthead, navigation and footer in one place so they cannot
drift across ten files. If you make a change that touches every page,
make it there and run `python3 tools/build_site.py` from the repository
root. **That regenerates every `.html` file in this folder and will
overwrite edits made directly to them**, so pick one of the two ways of
working and stay with it.

`contact.php`, `.htaccess`, `robots.txt`, `site.webmanifest` and
everything under `assets/` are not generated and are never overwritten.

## The brand

The site is built to the corporate identity manual, volume one. The parts
that are easy to break by accident:

- **One typeface.** Source Serif 4, for headings, interface and body.
  There is no sans-serif anywhere.
- **Paper and ink do 95% of the work.** Cyan is the only interactive
  colour and the colour of the clock. Magenta is for expiry, failure and
  the empty result only, and never appears in the same small component as
  cyan.
- **One filled shape per view** — the action. A second call to action is
  a text link with a rule under it.
- **No cards, shadows, gradients, outlines or pills.** Things are
  separated by space and a hairline.
- **The wordmark is artwork, not live text.** Place
  `assets/img/logo-primary.svg`; never set the name in a font.
- **No exclamation marks and no emoji**, in any copy on any page.

`brand.html` carries the short version of all of this, and the artwork,
for anyone outside the company who asks.
