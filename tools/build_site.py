#!/usr/bin/env python3
"""
Ni90ty website generator.

The deliverable is the plain static HTML in website/ — that is what gets
uploaded to Hostinger. This script exists so the masthead, navigation and
footer cannot drift apart across ten hand-edited files. Run it from the
repository root:

    python3 tools/build_site.py

Everything it writes is ordinary HTML with no build step, no framework and
no third-party request at run time.

Copy is written to the identity manual, section 11 (Voice): numbers are
exact or absent, bad news leads, the blind is stated plainly in one
sentence, and there are no exclamation marks and no emoji.
"""

import os
import re
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "website")

SITE = "https://ni90ty.com"
BRAND_MAIL = "brand@ni90ty.com"
HELLO_MAIL = "hello@ni90ty.com"
SUPPLY_MAIL = "supply@ni90ty.com"

NAV = [
    ("how-it-works.html", "How it works"),
    ("for-buyers.html", "For workshops"),
    ("for-suppliers.html", "For scrapyards"),
    ("markets.html", "Where it runs"),
    ("company.html", "Company"),
    ("contact.html", "Contact"),
]


# ---------------------------------------------------------------------------
# shared furniture
# ---------------------------------------------------------------------------

def lockup(variant="primary", width=150, clear=False, alt="Ni90ty"):
    cls = "lockup lockup--clear" if clear else "lockup"
    return (
        f'<span class="{cls}" style="--lockup-w:{width}px">'
        f'<img src="assets/img/logo-{variant}.svg" alt="{alt}" width="{width}" '
        f'height="{round(width / 3.202)}"></span>'
    )


def masthead(current, rail):
    links = "\n".join(
        '        <a href="{href}"{cur}>{label}</a>'.format(
            href=href,
            label=label,
            cur=' aria-current="page"' if href == current else "",
        )
        for href, label in NAV
    )
    rail_html = "\n".join(f"      <p>{field}</p>" for field in rail)
    home = "" if current == "index.html" else ""
    return f"""<header class="masthead">
  <div class="wrap">
    <div class="masthead__bar">
      <a href="index.html" aria-label="Ni90ty — home">{lockup("primary", 150)}</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
      <nav class="nav" id="nav" aria-label="Primary">
{links}
      </nav>
    </div>
    <hr class="rule-thick">
    <div class="rail">
{rail_html}
    </div>
    <hr class="rule-thin">
  </div>
</header>{home}"""


def footer():
    year = datetime.date.today().year
    return f"""<footer class="footer">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="footer__cols">
      <div>
        <p class="label">The product</p>
        <ul>
          <li><a href="how-it-works.html">How it works</a></li>
          <li><a href="for-buyers.html">For workshops</a></li>
          <li><a href="for-suppliers.html">For scrapyards</a></li>
          <li><a href="markets.html">Where it runs</a></li>
        </ul>
      </div>
      <div>
        <p class="label">Company</p>
        <ul>
          <li><a href="company.html">About Ni90ty</a></li>
          <li><a href="brand.html">Brand and press</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <p class="label">Legal</p>
        <ul>
          <li><a href="privacy.html">Privacy</a></li>
          <li><a href="terms.html">Terms</a></li>
        </ul>
      </div>
      <div>
        <p class="label">Direct</p>
        <ul>
          <li><a href="mailto:{HELLO_MAIL}">{HELLO_MAIL}</a></li>
          <li><a href="mailto:{SUPPLY_MAIL}">{SUPPLY_MAIL}</a></li>
          <li><a href="mailto:{BRAND_MAIL}">{BRAND_MAIL}</a></li>
        </ul>
      </div>
    </div>
    <hr class="rule-thin">
    <div class="footer__fine">
      <p>Ni90ty is a reverse marketplace for second-hand car parts. Suppliers are not
        named. Offers in 30 minutes; delivered in 90, typically — up to 3 hours in
        peak traffic.</p>
      <p>&copy; {year} Ni90ty. Ni90ty is not trading yet. Dubai and Sharjah first.</p>
    </div>
  </div>
</footer>"""


NAV_JS = """<script>
  (function () {
    var btn = document.querySelector('.nav-toggle');
    var nav = document.getElementById('nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      btn.textContent = open ? 'Menu' : 'Close';
    });
  })();
</script>"""


def page(slug, title, description, rail, body, og_type="website"):
    """Assemble one HTML file."""
    canonical = f"{SITE}/{'' if slug == 'index.html' else slug}"
    full_title = title if slug == "index.html" else f"{title} — Ni90ty"
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{full_title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">

<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Ni90ty">
<meta property="og:title" content="{full_title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" href="assets/img/icon-buyer.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta name="theme-color" content="#201E1D">

<link rel="preload" href="assets/fonts/source-serif-4-var-roman-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
{masthead(slug, rail)}
<main id="main">
{body}
</main>
{footer()}
{NAV_JS}
</body>
</html>
"""
    with open(os.path.join(OUT, slug), "w", encoding="utf-8") as fh:
        fh.write(html)
    return slug


# ---------------------------------------------------------------------------
# reusable blocks
# ---------------------------------------------------------------------------

PROMISE = """<section class="section">
  <div class="wrap">
    <div class="promise">
      <div>
        <span class="figure">15</span>
        <p class="label" style="margin-block-start:.9rem">Minutes</p>
        <p>Suppliers respond with stock, photographs and price, or they drop out of the job.</p>
      </div>
      <div>
        <span class="figure">30</span>
        <p class="label" style="margin-block-start:.9rem">Minutes</p>
        <p>Anonymous offers are back with the buyer, supplier identity stripped.</p>
      </div>
      <div>
        <span class="figure">90</span>
        <p class="label" style="margin-block-start:.9rem">Minutes</p>
        <p>A courier has the part at the door. The number the company is named after.</p>
      </div>
    </div>
  </div>
</section>"""

BUYER_SCREEN = """<div class="screen">
  <div class="screen__head">
    <span class="lockup" style="--lockup-w:86px"><img src="assets/img/logo-primary.svg" alt="" width="86" height="27"></span>
    <span class="screen__ref">Request 4471</span>
  </div>
  <p class="label">Offers close in</p>
  <p class="screen__clock">08:14</p>
  <div class="clock-bar" aria-hidden="true"><span style="width:46%"></span></div>
  <div style="margin-block-start:1.6rem">
    <div class="screen__offer">
      <strong>Offer A &middot; used, excellent<span>Delivered by 14:20</span></strong>
      <span class="screen__price">AED 420</span>
    </div>
    <div class="screen__offer">
      <strong>Offer B &middot; used, good<span>Delivered by 14:05</span></strong>
      <span class="screen__price">AED 335</span>
    </div>
  </div>
  <p class="action" role="presentation" aria-hidden="true">Accept offer B</p>
  <p class="screen__note">Suppliers are not named. Payment is taken when a courier collects.</p>
</div>"""

TERMINAL_SCREEN = """<div class="screen screen--terminal">
  <div class="screen__head">
    <span class="label" style="margin:0">Terminal &middot; Sharjah</span>
    <span class="screen__ref">New request</span>
  </div>
  <h3>Rear right tail lamp</h3>
  <p style="margin-block-end:1.6rem">Nissan Patrol &middot; 2019 &middot; 5.6 SE</p>
  <p class="label">Respond within</p>
  <p class="screen__clock">13:02</p>
  <div class="screen__actions" aria-hidden="true">
    <span class="is-primary">I have it</span>
    <span>Pass</span>
  </div>
</div>"""


def register_form(kind, action="contact.php"):
    """The one filled shape on the view is the action (CI section 09)."""
    if kind == "supplier":
        heading = "Put your yard on the network"
        intro = (
            "Tell us what you break and where you are. We will come to you, install the "
            "terminal, configure your stock profile and run a live test request before "
            "you are counted as live."
        )
        fields = """
      <div class="field">
        <label for="yard">Yard or business name</label>
        <input type="text" id="yard" name="business" autocomplete="organization" required>
      </div>
      <div class="field">
        <label for="contact">Your name</label>
        <input type="text" id="contact" name="name" autocomplete="name" required>
      </div>
      <div class="field--inline">
        <div class="field">
          <label for="phone">Phone</label>
          <input type="tel" id="phone" name="phone" autocomplete="tel" required>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" autocomplete="email">
        </div>
      </div>
      <div class="field">
        <label for="area">Where is the yard</label>
        <select id="area" name="area" required>
          <option value="">Choose an area</option>
          <option>Sharjah Industrial Area</option>
          <option>Al Sajaa, Sharjah</option>
          <option>Ras Al Khor, Dubai</option>
          <option>Al Aweer, Dubai</option>
          <option>Mussafah, Abu Dhabi</option>
          <option>Johannesburg</option>
          <option>Cape Town</option>
          <option>Durban</option>
          <option>Somewhere else</option>
        </select>
      </div>
      <div class="field">
        <label for="stock">What do you break</label>
        <textarea id="stock" name="stock" placeholder="Makes, model years and part categories you hold"></textarea>
        <p class="hint">Rough is fine. We configure the detail on the tablet.</p>
      </div>"""
        note = (
            "No joining fee, no subscription, no monthly minimum, and no cost to receive "
            "a request, to quote or to decline. A commission on the sale is deducted at "
            "payout, and only when the part sells."
        )
        subject = "Scrapyard registration"
        button = "Register the yard"
    else:
        heading = "Get early access"
        intro = (
            "Workshops, body shops and fleet operators go on first. Tell us where you "
            "are and what you buy, and we will contact you before the market opens."
        )
        fields = """
      <div class="field">
        <label for="business">Workshop or company name</label>
        <input type="text" id="business" name="business" autocomplete="organization" required>
      </div>
      <div class="field">
        <label for="bname">Your name</label>
        <input type="text" id="bname" name="name" autocomplete="name" required>
      </div>
      <div class="field--inline">
        <div class="field">
          <label for="bphone">Phone</label>
          <input type="tel" id="bphone" name="phone" autocomplete="tel" required>
        </div>
        <div class="field">
          <label for="bemail">Email</label>
          <input type="email" id="bemail" name="email" autocomplete="email">
        </div>
      </div>
      <div class="field">
        <label for="city">Where do you work</label>
        <select id="city" name="area" required>
          <option value="">Choose a city</option>
          <option>Dubai</option>
          <option>Sharjah</option>
          <option>Abu Dhabi</option>
          <option>Johannesburg</option>
          <option>Cape Town</option>
          <option>Durban</option>
          <option>Somewhere else</option>
        </select>
      </div>
      <div class="field">
        <label for="volume">What do you buy in a normal week</label>
        <textarea id="volume" name="stock" placeholder="Vehicle makes you work on, and roughly how many used parts a week"></textarea>
      </div>"""
        note = (
            "You post the part, you see anonymous offers, and you pay when you accept "
            "one. A service fee is added on fulfilled orders and shown before you accept."
        )
        subject = "Buyer early access"
        button = "Request early access"

    return f"""<section class="section" id="register">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <h2>{heading}</h2>
        <p>{intro}</p>
        <p class="muted" style="font-size:1rem">{note}</p>
      </div>
      <div>
        <form method="post" action="{action}" novalidate>
          <input type="hidden" name="form" value="{subject}">
          <p class="visually-hidden" aria-hidden="true">
            <label for="{kind}-company-url">Leave this field empty</label>
            <input type="text" id="{kind}-company-url" name="company_url" tabindex="-1" autocomplete="off">
          </p>
{fields}
          <button class="action" type="submit">{button}</button>
          <p class="form-note">We use what you send here to contact you about Ni90ty and
            for nothing else. See <a href="privacy.html">Privacy</a>.</p>
        </form>
      </div>
    </div>
  </div>
</section>"""


# ---------------------------------------------------------------------------
# pages
# ---------------------------------------------------------------------------

def build_index():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div>
        <h1>The part you need, found in thirty minutes and delivered in ninety.</h1>
      </div>
      <div style="align-self:end">
        <p class="lede">Ni90ty is a reverse marketplace for second-hand car parts, with an
          enforced clock and its own logistics. You post the part you need. Every relevant
          scrapyard sees it at once. Neither side ever sees the other.</p>
        <div class="actions">
          <a class="action" href="for-buyers.html#register">Get early access</a>
          <a class="action-quiet" href="for-suppliers.html#register">Put your yard on the network</a>
        </div>
      </div>
    </div>
  </div>
</section>

{PROMISE}

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The problem</p>
        <h2>The part was on a shelf eight kilometres away.</h2>
      </div>
      <div class="stack">
        <p>A panel beater in Sharjah has a 2019 Patrol on a lift with a smashed rear lamp.
          The car is occupying a bay, and the bay costs money every hour it is occupied.</p>
        <p>So they start phoning. Six yards in Sharjah Industrial Area. Three say they will
          check and call back, and do not. One has it, at a price nobody can benchmark. Two
          days later the car is still on the lift.</p>
        <p>The part existed the whole time. There was simply no fast way to find out which
          shelf it was on. This is a matching and speed problem, not a supply problem —
          supply is abundant and badly indexed.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The loop</p>
        <h2>Seven steps, one clock.</h2>
      </div>
      <div>
    <ol class="steps">
      <li>
        <div>
          <h3>The buyer posts a request</h3>
          <p>Vehicle, part, a photograph of the damage and a map pin. Under 60 seconds on a
            workshop floor.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>The request fans out</h3>
          <p>Not a noticeboard someone might browse. A direct alert on a terminal beside the
            counter, at every yard that holds that make, model year and part category.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Suppliers have 15 minutes</h3>
          <p>Photograph the part on the shelf, set a price, state condition, warranty and how
            soon it is ready. Miss the window and you are out of that job. There are no
            extensions.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Offers come back anonymised</h3>
          <p>Lettered A, B, C in the order received, with price, condition, warranty and
            photographs. No names, no addresses, no phone numbers.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>The buyer picks one</h3>
          <p>The card is authorised, not charged. The money is ring-fenced until the part
            arrives.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>A courier collects and delivers</h3>
          <p>Every available courier is quoted in parallel and chosen on arrival time rather
            than price. The parcel carries Ni90ty packaging. The driver gets the yard's
            address; the buyer never does.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Delivery, then the money moves</h3>
          <p>The card is captured on confirmed delivery, and the yard is paid on the next
            payout run. If delivery fails, the authorisation is voided and nobody is charged.</p>
        </div>
      </li>
    </ol>
    <div class="actions">
      <a class="action-quiet" href="how-it-works.html">The whole loop in detail</a>
    </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The buyer app</p>
        <h2>The clock is the interface.</h2>
        <p>Exactly one figure is set at display size: the clock that is currently running.
          Offers are lettered, never named. No distances that give a direction, no map of
          the driver, no pickup address in any screen, notification or receipt.</p>
        <p><a href="for-buyers.html">What a workshop gets</a></p>
      </div>
      <div>{BUYER_SCREEN}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="split split--even">
      <div>
        <p class="label">The supplier terminal</p>
        <h2>Readable across a yard.</h2>
        <p>A shared screen in a dusty workshop, seen at two metres by someone holding a
          part. Two actions and no more: have it, or pass. Price, photographs and condition
          come after the yard has claimed the job.</p>
        <p>It is a web page, so a yard can use its own phone or tablet immediately. The free
          hardware exists to remove friction, not to create a dependency.</p>
        <p><a href="for-suppliers.html">What a yard gets</a></p>
      </div>
      <div>{TERMINAL_SCREEN}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The model</p>
        <h2>Neither side ever sees the other.</h2>
      </div>
      <div class="stack">
        <p>This is the business model, not a privacy setting. If a buyer learns which yard
          supplied the part, the second deal happens on WhatsApp and Ni90ty earns nothing.
          That is precisely how the operators already in this market leak the value they
          create.</p>
        <p>The blind does three things at once. It keeps the second transaction, and the
          third. It forces competition on price and speed rather than on relationships. And
          it makes Ni90ty the counterparty to both sides, which is what permits a margin and
          a guarantee on the part.</p>
        <p>It is enforced in code rather than in terms and conditions: one serialiser with
          no access to identity fields, photograph metadata stripped on upload, contact
          details rejected in free text, no live map of the driver, and Ni90ty packaging on
          every parcel.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="empty-result">
      <p class="label">When nobody has the part</p>
      <p class="consequence" style="font-size:1.35rem;color:var(--ink)">Nobody within range has
        this part today.</p>
      <p>At 15 minutes with no offers the search widens — a bigger radius, more yards — and
        the buyer is told plainly that it is still looking. At 45 minutes with still nothing
        the request closes and the miss is logged. A product that cannot fail honestly does
        not get used twice.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Where it runs</p>
        <h2>Dubai and Sharjah first.</h2>
      </div>
      <div class="stack">
        <p>Sharjah is the country's used-parts capital. Al Sajaa holds the largest cluster of
          used auto parts yards in the UAE, and Sharjah Industrial Area is where workshops
          across the Emirates go in preference to Dubai. Dubai contributes Ras Al Khor and
          Al Aweer, and most of the demand.</p>
        <p>The two are roughly 25 km apart: one contiguous 90-minute delivery zone with
          supply concentrated on one side and demand on the other. Abu Dhabi follows through
          Mussafah, then Johannesburg, Cape Town and Durban.</p>
        <p><a href="markets.html">The market sequence, and what changes per country</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <h2>It costs a scrapyard nothing.</h2>
        <p>No joining fee. No subscription. No monthly minimum. No cost to receive a
          request, to quote, or to decline. A free terminal, delivered and set up, configured
          to the stock you actually hold. A commission on the sale, deducted at payout, and
          only when something sells.</p>
        <div class="actions">
          <a class="action" href="for-suppliers.html#register">Put your yard on the network</a>
        </div>
      </div>
      <div>
        <h2>Workshops go first.</h2>
        <p>Body shops, panel beaters and fleet operators buy parts weekly, and a car on a
          lift costs money every hour. That is who Ni90ty is built for, and who gets access
          first.</p>
        <div class="actions">
          <a class="action-quiet" href="for-buyers.html#register">Get early access</a>
        </div>
      </div>
    </div>
  </div>
</section>"""
    return page(
        "index.html",
        "Ni90ty — offers in 30 minutes, delivered in 90",
        "A reverse marketplace for second-hand car parts. Post the part you need, "
        "see anonymous offers in 30 minutes, and have it delivered in 90. "
        "Suppliers are not named.",
        ["Reverse marketplace", "Second-hand car parts", "Dubai &middot; Sharjah"],
        body,
    )


def build_how_it_works():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>How it works</h1></div>
      <div style="align-self:end">
        <p class="lede">You post the part you need. You get anonymous offers in 30 minutes.
          It is at your door in 90. Everything below is how that happens.</p>
      </div>
    </div>
  </div>
</section>

{PROMISE}

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <ol class="steps" style="margin-block-start:2.5rem">
      <li>
        <div>
          <h3>The buyer posts a request</h3>
          <p>A workshop opens the app and enters the vehicle — make, model and year, or a
            scan of the chassis number — the part, picked from a category list, a photograph
            of the damaged part, and where to deliver it as a map pin rather than a typed
            address.</p>
          <p>It takes under 60 seconds. The request gets a reference, and a clock starts.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>The request fans out</h3>
          <p>Ni90ty pushes that request to every relevant scrapyard terminal at once — a
            direct alert on a screen beside the counter, with a sound loud enough to hear
            across a yard.</p>
          <p>Relevant is the operative word. Each yard has told us which makes it breaks,
            which model years, which part categories and how far it will travel. A Patrol
            tail lamp does not ping a yard that only breaks European cars. A yard that gets
            irrelevant alerts stops watching the screen, and a terminal nobody watches breaks
            the promise for everyone.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Suppliers have 15 minutes</h3>
          <p>Each yard sees the request with a countdown. It can pass in two taps, or respond
            in under 90 seconds: photograph the actual part on the shelf, set a price, state
            the condition and any warranty, and say how soon it is ready.</p>
          <p>Miss the 15 minutes and you are out of that job. There are no extensions. This
            is the one mechanic that separates Ni90ty from every competitor, all of whom let
            suppliers reply whenever they feel like it.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Offers come back anonymised</h3>
          <p>Offers do not go straight to the buyer. They come to Ni90ty, which strips
            everything identifying the yard and presents what is left: a letter, a price, a
            condition, a warranty, how soon it is ready, and the photographs.</p>
          <p>Names, addresses and phone numbers never appear. Where a distance is shown, a
            direction is not — distance plus direction locates a yard on a map in about four
            seconds.</p>
          <p>The buyer sees all of this within 30 minutes of posting, and the offers land
            live as they arrive.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>The buyer picks one</h3>
          <p>They tap an offer. The card is authorised: the money is ring-fenced, and not
            yet taken. The breakdown — part, delivery, service fee, tax, total — is shown
            before anything is authorised.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>A courier collects and delivers</h3>
          <p>Ni90ty quotes every available courier in parallel, picks on arrival time rather
            than price, and dispatches. Two providers per city, with automatic failover.</p>
          <p>The driver gets the yard's address. The buyer never does. The parcel carries
            Ni90ty packaging, sealed at the yard, with no business card, invoice or contact
            detail inside it.</p>
        </div>
      </li>
      <li>
        <div>
          <h3>Delivery, then the money moves</h3>
          <p>The buyer confirms the part arrived, and only then is the card captured. Ni90ty
            pays the yard on its payout run, minus commission. If the buyer says nothing for
            24 hours, it auto-confirms. If delivery fails, the authorisation is voided and
            nobody is charged.</p>
        </div>
      </li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The honest case</p>
        <h2>When nobody has the part.</h2>
      </div>
      <div class="stack">
        <div class="empty-result">
          <p class="consequence" style="font-size:1.35rem;color:var(--ink)">Nobody within
            range has this part today.</p>
        </div>
        <p>This matters as much as the happy path. At 15 minutes with no offers, the search
          widens to a bigger radius and more yards, and the buyer is told plainly that it is
          still looking. At 45 minutes with still nothing, the request closes, says so, and
          the miss is logged.</p>
        <p>There are no apology graphics and no promise that something will turn up. A
          product that cannot fail honestly does not get used a second time.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The blind</p>
        <h2>Why the two sides never meet.</h2>
      </div>
      <div class="stack">
        <p>Suppliers are not named. It is the business model rather than a privacy nicety,
          and it is enforced in code rather than in terms and conditions.</p>
        <p>A single serialiser produces every buyer-facing view of an offer, and it has no
          access to supplier identity fields at all. Photograph metadata, GPS especially, is
          stripped on upload in both directions. Phone numbers, emails and messaging handles
          in free text are rejected with an explanation rather than quietly altered. There is
          no live map of the driver, because a moving dot traces a line straight back to the
          yard. The courier is the only physical link between the two sides.</p>
        <p>The supplier sees a request, a vehicle, a part and a rough distance. Never the
          buyer's name, business, phone, address, or what any other yard quoted.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The promise</p>
        <h2>Ninety minutes, said honestly.</h2>
      </div>
      <div class="stack">
        <p>The internal targets are 15, 30 and 90 — supplier response, offers to buyer, part
          delivered. Publicly the wording is this: offers in 30 minutes, delivered in 90,
          typically, and up to 3 hours in peak traffic.</p>
        <p>Dubai to Sharjah off-peak is a comfortable run. Johannesburg at 17:00 is not. The
          90 minutes is executed by a third-party driver, which is why there are two courier
          providers in every city and why the wording says what it says.</p>
        <p class="consequence">A promise you break is worse than a slower promise you keep.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <h2>For workshops</h2>
        <p>Post the part, see anonymous offers, pay when you accept one, and have it
          delivered.</p>
        <div class="actions"><a class="action" href="for-buyers.html">What a workshop gets</a></div>
      </div>
      <div>
        <h2>For scrapyards</h2>
        <p>A free terminal, no fees of any kind, and money only when you sell something.</p>
        <div class="actions"><a class="action-quiet" href="for-suppliers.html">What a yard gets</a></div>
      </div>
    </div>
  </div>
</section>"""
    return page(
        "how-it-works.html",
        "How it works",
        "The Ni90ty loop, step by step: a request fans out to every relevant scrapyard, "
        "suppliers have 15 minutes, offers come back anonymised in 30, and a courier "
        "delivers in 90.",
        ["How it works", "The loop, step by step", "15 &middot; 30 &middot; 90"],
        body,
    )


def build_buyers():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>For workshops and fleets</h1></div>
      <div style="align-self:end">
        <p class="lede">A car on a lift costs money every hour it is there. Post the part,
          see what it costs across every yard in range, and have it delivered the same
          morning.</p>
        <div class="actions"><a class="action" href="#register">Get early access</a></div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <p class="label">What you do</p>
        <h2>Post in under a minute.</h2>
        <p>Enter the vehicle — make, model and year, or scan the chassis number — pick the
          part, photograph the damage, and drop a pin where it should go. Chassis scanning is
          a convenience rather than a source of truth: GCC-spec vehicles, grey imports and
          re-exports make automated decoding unreliable, so the system leans on make, model,
          year and the photograph.</p>
        <p>The delivery location is a map pin, never a typed address. UAE street addressing
          is weak, and pins are how people actually navigate.</p>
        <p>Repeat orders are one tap. Workshops buy the same parts over and over, and the
          history screen is built for that.</p>
      </div>
      <div>{BUYER_SCREEN}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="cols cols--3" style="padding-block-start:2.5rem">
      <div>
        <h3>Offers land live</h3>
        <p>You watch them arrive rather than waiting for a batch. Default sort is price,
          ascending. You can also sort by soonest, or by closest.</p>
      </div>
      <div>
        <h3>You are never upsold into a ranking</h3>
        <p>Offers are never ordered by supplier score, and advertising never affects which
          offers you see or how they rank. The moment a paid placement outranks a cheaper
          part, the price competition is gone.</p>
      </div>
      <div>
        <h3>The card is authorised, not charged</h3>
        <p>Money is ring-fenced when you accept, captured when you confirm the part arrived,
          and voided in full if delivery fails.</p>
      </div>
      <div>
        <h3>The part is guaranteed by us</h3>
        <p>Ni90ty is the counterparty, so a wrong, damaged or misdescribed part is our
          problem to resolve, not a dispute with a yard you cannot name.</p>
      </div>
      <div>
        <h3>Arabic and English, from the first screen</h3>
        <p>Both apps ship in Arabic and English with full right-to-left layout. The interface
          mirrors; it is not an English app with a translation layer over it.</p>
      </div>
      <div>
        <h3>It works on the phone you have</h3>
        <p>Built for a mid-range Android handset on a workshop floor, which is what this
          market actually carries.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">What you never see</p>
        <h2>And why that is the point.</h2>
      </div>
      <div class="stack">
        <p>You will not see a supplier's name, business name, address, precise location,
          direction or score, and nothing in a photograph's metadata survives upload. There
          is no live map of the driver, and no pickup address in any screen, notification or
          receipt.</p>
        <p>That is what keeps the yards competing on price and speed instead of on who knows
          whom, and it is what lets Ni90ty stand behind the part.</p>
        <p class="consequence">If you could see the yard, the next deal would happen on
          WhatsApp and the price you are being quoted would drift back up within a year.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">What it costs</p>
        <h2>The price you accept, plus delivery, plus a service fee.</h2>
      </div>
      <div class="stack">
        <p>The full breakdown — part, delivery, service fee and tax — is shown before you
          authorise anything. There is no subscription and no cost to post a request that
          nobody fills.</p>
        <p>If nobody in range has the part, you are told so plainly, the request closes, and
          you are not charged.</p>
      </div>
    </div>
  </div>
</section>

{register_form("buyer")}"""
    return page(
        "for-buyers.html",
        "For workshops",
        "Post a used car part in under a minute, see anonymous offers within 30 minutes, "
        "and have it delivered in 90. Built for body shops, panel beaters and fleet "
        "operators.",
        ["For workshops", "Body shops &middot; Fleets", "Get early access"],
        body,
    )


def build_suppliers():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>For scrapyards and dismantlers</h1></div>
      <div style="align-self:end">
        <p class="lede">You pay nothing to join, nothing to receive a request, nothing to
          quote and nothing to decline. We take a commission when the part sells, and not
          before.</p>
        <div class="actions"><a class="action" href="#register">Put your yard on the network</a></div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The terminal</p>
        <h2>Two taps to answer.</h2>
        <p>A request arrives on a screen beside your counter, loud enough to hear across the
          yard. You have it, or you pass. Price, photographs and condition come after you
          have claimed the job.</p>
        <p>It assumes gloves, noise, poor light, dusty screens and interruption. Tap targets
          are large, every field but the photograph and the price is a preset, a half-finished
          response survives the tablet locking, and a quote submitted with no signal is queued
          and sent when the connection returns.</p>
        <p>It is a web page, not an app you have to install, so you can use your own phone or
          tablet from the day you sign.</p>
      </div>
      <div>{TERMINAL_SCREEN}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">What it costs</p>
      <h2 class="measure-narrow">Nothing, until you sell something.</h2>
    </div>
    <ul class="list-plain" style="margin-block-start:1.5rem">
      <li><strong>No joining fee, no subscription, no monthly minimum.</strong> Your current
        alternative is answering the phone all day, for nothing, for callers who mostly do
        not buy.</li>
      <li><strong>A free terminal.</strong> Delivered, installed and configured to the stock
        you actually hold. It stays ours, on a signed loan agreement, and it is replaced if
        it breaks.</li>
      <li><strong>No cost to receive a request, to quote, or to decline.</strong> Passing on
        a job costs you nothing and is not held against you.</li>
      <li><strong>A commission on the sale, deducted at payout.</strong> The terminal shows
        your net figure before you submit a price, so you always quote knowing what you
        keep.</li>
      <li><strong>You get paid automatically.</strong> No chasing the customer, no bad debt
        and no cash handling.</li>
      <li><strong>We handle the delivery.</strong> You pack the part in our packaging; a
        driver arrives.</li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The clock</p>
        <h2>Fifteen minutes, and fast yards earn more.</h2>
      </div>
      <div class="stack">
        <p>Every request carries a countdown computed from our clock, not the tablet's. Reply
          inside the window or you are out of that job. There are no extensions, and that is
          the rule that makes the whole thing work — a buyer who is promised offers in 30
          minutes has to get them.</p>
        <p>Response speed and fulfilment quality feed a score you can see. Yards scoring
          above the threshold receive requests first. We are not asking you to be fast; we
          are making fast yards richer.</p>
        <p>You are only sent requests that match what you break: the makes, the model years,
          the part categories and the distance you are willing to travel. A yard that gets
          irrelevant alerts stops watching the screen, which is the one outcome nobody
          wants.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">What you never see</p>
        <h2>And what the buyer never sees.</h2>
      </div>
      <div class="stack">
        <p>You will not see the buyer's name, business, phone, email or exact address. You
          will not see what other yards quoted, how many were asked, or whether you were
          undercut. Competitive pricing depends on you quoting your own number rather than
          reacting to someone else's.</p>
        <p>The buyer, in turn, never learns which yard supplied the part. That is what stops
          the second deal happening off the platform, and it is what keeps the price
          competition honest for everybody who is playing straight.</p>
        <p>It reaches the parcel too. Pack in Ni90ty packaging, with no business card, no
          invoice and no contact detail inside. The parcel is the last place anonymity can
          leak, and it usually leaks through habit rather than intent.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Joining</p>
      <h2 class="measure-narrow">Four stages, and only the last one counts.</h2>
    </div>
    <ol class="steps" style="margin-block-start:2rem">
      <li><div><h3>Signed</h3><p>A short agreement covering commission, the terminal loan and
        the anonymity rules.</p></div></li>
      <li><div><h3>Terminal installed</h3><p>We come to the yard, mount it where your counter
        staff will actually see it, and leave a plate above it.</p></div></li>
      <li><div><h3>Stock profile configured</h3><p>Which makes you break, which model years,
        which part categories, and how far you will travel.</p></div></li>
      <li><div><h3>Live test request passed</h3><p>We send a real request and watch you answer
        it. Until that happens you are not counted as live, because a terminal nobody
        watches is worse than no terminal at all.</p></div></li>
    </ol>
  </div>
</section>

{register_form("supplier")}"""
    return page(
        "for-suppliers.html",
        "For scrapyards",
        "Scrapyards pay nothing to join Ni90ty. A free terminal, no fees to receive a "
        "request or to quote, and a commission only when the part sells.",
        ["For scrapyards", "No fees &middot; Free terminal", "Paid on the sale"],
        body,
    )


def build_markets():
    body = """<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Where it runs</h1></div>
      <div style="align-self:end">
        <p class="lede">One platform, two countries, six cities. Currency, language,
          addressing, tax, payment and courier providers are configuration per market, never
          code.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Market one</p>
        <h2>Dubai and Sharjah, together.</h2>
      </div>
      <div class="stack">
        <p>Sharjah is the UAE's used-parts capital, not Dubai and not Abu Dhabi. Al Sajaa on
          Sharjah's eastern edge holds the largest cluster of used auto parts yards in the
          country, and Sharjah Industrial Area is where workshops across the Emirates go in
          preference to Dubai. Dubai contributes Ras Al Khor and Al Aweer, and most of the
          demand.</p>
        <p>The two are roughly 25 km apart. That is one contiguous 90-minute delivery zone
          with supply concentrated on one side and demand on the other, which is close to an
          ideal launch geography.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="split">
      <div>
        <p class="label">Then</p>
        <h2>Abu Dhabi, through Mussafah.</h2>
      </div>
      <div class="stack">
        <p>Abu Dhabi's parts trade runs through Mussafah, with Sharjah as its deep bench for
          used stock. It is roughly 140 km from Dubai, so it cannot share a delivery window
          with it. Same entity, same payments, same couriers, separate delivery zone — a
          second city rather than a co-launch.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="split">
      <div>
        <p class="label">Then</p>
        <h2>Johannesburg, Cape Town and Durban.</h2>
      </div>
      <div class="stack">
        <p>South Africa follows on a proven playbook. Gauteng alone has over 200 scrapyards,
          and the three metros are entered together.</p>
        <p class="consequence">Three cities at once is the largest execution risk in the
          plan, and it is named as such: a cold start is per city, not per country, which
          means three parallel supply teams and three separate fill-rate problems.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Multi-country by design</p>
      <h2 class="measure-narrow">Nothing about a country is hard-coded.</h2>
      <p class="measure-narrow">Currency, language, chassis versus VIN, address model,
        payment provider, courier providers, tax treatment, commission rates, delivery
        targets, legal entity and business calendar are all per-market configuration.</p>
    </div>
    <div class="table-scroll" style="margin-block-start:2rem">
      <table>
        <caption>What differs between the two launch markets</caption>
        <thead>
          <tr><th scope="col">&nbsp;</th><th scope="col">United Arab Emirates</th><th scope="col">South Africa</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Currency</th><td>AED</td><td>ZAR</td></tr>
          <tr><th scope="row">Languages</th><td>Arabic and English, full right-to-left from day one</td><td>English</td></tr>
          <tr><th scope="row">Vehicle identity</th><td>Chassis number. Decoding is unreliable on GCC-spec and grey imports, so the system leans on make, model, year and photographs</td><td>17-character VIN</td></tr>
          <tr><th scope="row">Delivery address</th><td>A map pin. Street addressing is weak and pins are how people navigate</td><td>Street addressing</td></tr>
          <tr><th scope="row">Tax</th><td>VAT at 5%</td><td>VAT at 15%</td></tr>
          <tr><th scope="row">Payouts</th><td>Local payment provider</td><td>Local bank EFT</td></tr>
          <tr><th scope="row">Data protection</th><td>Stricter data-residency expectations</td><td>POPIA</td></tr>
          <tr><th scope="row">Operating conditions</th><td>Peak-traffic congestion between the emirates</td><td>Load-shedding as a routine condition</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Language</p>
        <h2>Arabic is a launch requirement.</h2>
      </div>
      <div class="stack">
        <p>Market one is the UAE, and much of the used-parts trade there operates in Arabic.
          Both apps ship in Arabic and English from the first day, with full right-to-left
          layout — which mirrors the interface, flips directional icons, and changes number,
          date and currency formatting.</p>
        <p>It is not a translation layer applied to an English app. Every system-generated
          message is looked up by locale rather than written as English text in code.
          Retrofitting that later would mean touching every screen and every endpoint.</p>
      </div>
    </div>
  </div>
</section>"""
    return page(
        "markets.html",
        "Where it runs",
        "Ni90ty launches in Dubai and Sharjah, then Abu Dhabi, then Johannesburg, Cape "
        "Town and Durban. One platform; currency, language, tax and logistics are "
        "configuration per market.",
        ["Where it runs", "UAE &middot; South Africa", "Six cities"],
        body,
    )


def build_company():
    body = """<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Company</h1></div>
      <div style="align-self:end">
        <p class="lede">Ni90ty is instant sourcing for fragmented supply. Second-hand car
          parts is the beachhead, not the boundary.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">What we are building</p>
        <h2>Three things stacked, not one.</h2>
      </div>
      <div class="stack">
        <p>The reverse-request idea is not new, and we do not claim it. Operators already run
          request-for-part services over WhatsApp in the UAE, and South Africa has several
          quote boards. What is defensible is the combination.</p>
        <p><strong>Enforced time.</strong> A hard 15-minute window with a consequence.
          Everyone else is passive and lets suppliers reply whenever they feel like it.</p>
        <p><strong>True double-blind.</strong> Nobody else structurally prevents
          disintermediation, so nobody else keeps the second transaction.</p>
        <p><strong>Owned logistics.</strong> Nobody else in this market delivers the part.</p>
        <p>Any one of the three is copyable. The three together, plus demand data that
          compounds from the first request, is a business.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The asset</p>
        <h2>Every request, filled and unfilled.</h2>
      </div>
      <div class="stack">
        <p>Each request records which part, for which vehicle, in which area, at what time,
          at what price, and whether anyone could supply it. Nobody in either market holds
          that data today. It compounds, and it cannot be copied by launching the same
          app.</p>
        <p>The unfilled requests are the most valuable records in the business. Once you know
          which parts are asked for weekly and routinely go unfilled, you can stock those
          yourself — which is the opposite of the guesswork that closes most parts
          warehouses.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Stated plainly</p>
      <h2 class="measure-narrow">What is honestly hard about this.</h2>
      <p class="measure-narrow">We would rather say it first than have it found.</p>
    </div>
    <div class="cols cols--2" style="margin-block-start:2.5rem">
      <div>
        <h3>The cold start</h3>
        <p>A 15-minute clock means nothing if no yard is watching. Suppliers onboard first,
          in volume, before a single buyer is invited, and both sides open on one announced
          date.</p>
      </div>
      <div>
        <h3>The ninety minutes is executed by someone else</h3>
        <p>A third-party driver carries the promise. Two providers in every city with
          automatic failover, and public wording that says typically 90 minutes, up to 3
          hours in peak traffic.</p>
      </div>
      <div>
        <h3>Disintermediation</h3>
        <p>The whole model rests on the blind holding. It is enforced in code, in the
          packaging and in the courier arrangement, not in a clause nobody reads.</p>
      </div>
      <div>
        <h3>Stolen parts</h3>
        <p>A used-parts platform attracts illicit stock, and our brand carries the
          consequence. Supplier verification, chassis-level traceability on high-value
          components, and a documented cooperation policy with law enforcement.</p>
        <p class="muted" style="font-size:1rem">This is usually the first hard question in
          the room, and it should be.</p>
      </div>
      <div>
        <h3>Three South African cities at once</h3>
        <p>A cold start is per city. Three metros means three supply teams and three separate
          fill-rate problems in the same quarter. It is defensible only because the playbook
          will be proven by then.</p>
      </div>
      <div>
        <h3>Terminal fleet economics</h3>
        <p>Hardware given away gets lost, broken and occasionally resold. Cheap devices,
          rugged cases, remote lock, and a signed loan agreement rather than a gift. A
          terminal that stops being watched is a dead terminal, and we count only the yards
          that have passed a live test request.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Where this goes</p>
        <h2>Broker, network, inventory.</h2>
      </div>
      <div class="stack">
        <p>Phase one is the broker: match, anonymise, deliver. Asset-light, thin margin, fast
          to prove.</p>
        <p>Phase two is the network: more cities, supplier scores, a second country. Still
          asset-light.</p>
        <p>Phase three is inventory. The demand data names the recurring parts, so we stock
          those ourselves. Delivery gets faster because there is no yard to coordinate with,
          and quality becomes ours to control.</p>
        <p>Then new parts, to the same buyers over the same logistics — and after that, any
          fragmented second-hand supply where the problem is the same one: the stock exists,
          and nobody can find it quickly.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split split--even" style="padding-block-start:2.5rem">
      <div>
        <h2>Talk to us</h2>
        <p>Scrapyards, workshops, fleet operators, courier partners and press all reach us
          the same way.</p>
        <div class="actions"><a class="action" href="contact.html">Contact</a></div>
      </div>
      <div>
        <h2>Brand and press</h2>
        <p>The mark, the ink, the type and the rules for using them, with the artwork ready
          to download.</p>
        <div class="actions"><a class="action-quiet" href="brand.html">Brand assets</a></div>
      </div>
    </div>
  </div>
</section>"""
    return page(
        "company.html",
        "Company",
        "What Ni90ty is building, the data asset behind it, and a plain account of what "
        "is honestly hard about the business.",
        ["Company", "What we are building", "And what is hard"],
        body,
    )


def build_contact():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Contact</h1></div>
      <div style="align-self:end">
        <p class="lede">Tell us who you are and what you need. We answer during business
          hours in the UAE and South Africa.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="cols cols--3" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Scrapyards and dismantlers</p>
        <h3>Put your yard on the network</h3>
        <p>Free terminal, no fees, commission only on a sale.</p>
        <p><a href="for-suppliers.html#register">Register the yard</a></p>
      </div>
      <div>
        <p class="label">Workshops and fleets</p>
        <h3>Get early access</h3>
        <p>Buyers are invited in the order they registered, by city.</p>
        <p><a href="for-buyers.html#register">Request access</a></p>
      </div>
      <div>
        <p class="label">Everything else</p>
        <h3>Couriers, partners, press</h3>
        <p>Courier providers, commercial partners and media enquiries.</p>
        <p><a href="#general">The form below</a></p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="general">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <h2>General enquiries</h2>
        <p>If you are a courier operator in Dubai, Sharjah, Abu Dhabi, Johannesburg, Cape
          Town or Durban, say so in the message. We run two providers per city and are
          talking to operators in all six.</p>
        <p class="muted" style="font-size:1rem">Direct:<br>
          <a href="mailto:{HELLO_MAIL}">{HELLO_MAIL}</a> — general<br>
          <a href="mailto:{SUPPLY_MAIL}">{SUPPLY_MAIL}</a> — scrapyard supply<br>
          <a href="mailto:{BRAND_MAIL}">{BRAND_MAIL}</a> — brand artwork and press</p>
      </div>
      <div>
        <form method="post" action="contact.php" novalidate>
          <input type="hidden" name="form" value="General enquiry">
          <p class="visually-hidden" aria-hidden="true">
            <label for="g-company-url">Leave this field empty</label>
            <input type="text" id="g-company-url" name="company_url" tabindex="-1" autocomplete="off">
          </p>
          <div class="field">
            <label for="gname">Your name</label>
            <input type="text" id="gname" name="name" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="gbusiness">Company</label>
            <input type="text" id="gbusiness" name="business" autocomplete="organization">
          </div>
          <div class="field--inline">
            <div class="field">
              <label for="gemail">Email</label>
              <input type="email" id="gemail" name="email" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="gphone">Phone</label>
              <input type="tel" id="gphone" name="phone" autocomplete="tel">
            </div>
          </div>
          <div class="field">
            <label for="gmessage">Message</label>
            <textarea id="gmessage" name="message" required></textarea>
          </div>
          <button class="action" type="submit">Send</button>
          <p class="form-note">We use what you send here to answer you and for nothing else.
            See <a href="privacy.html">Privacy</a>.</p>
        </form>
      </div>
    </div>
  </div>
</section>"""
    return page(
        "contact.html",
        "Contact",
        "Contact Ni90ty: scrapyard registration, buyer early access, courier partnerships "
        "and press enquiries.",
        ["Contact", "UAE &middot; South Africa", "We answer in business hours"],
        body,
    )


def build_brand():
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Brand and press</h1></div>
      <div style="align-self:end">
        <p class="lede">The mark, the ink and the type, with the artwork ready to use. The
          wordmark is artwork, not live text: please place the supplied files rather than
          setting the name yourself.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">The mark</p>
        <h2>The zero is a dial.</h2>
      </div>
      <div class="stack">
        <p>The name is set as written, with the 90 inside it. The zero is replaced by a drawn
          dial, hands standing at ninety past. Nothing is added beside the word; the idea is
          cut into it.</p>
        <p>The ring's stroke is one tenth of its outside diameter, and that diameter equals
          the wordmark's x-height plus one stroke, so the dial sits optically level with the
          9 and the t. The two hands are three quarters of the ring stroke in weight and meet
          at the centre with no pivot dot. Both are cyan.</p>
        <p>Give it clear space on all four sides equal to the dial's outside diameter.
          Nothing enters that space: no rule, no photograph edge, no second logo.</p>
      </div>
    </div>
    <div style="margin-block-start:3rem;background:#EDECEB;padding:clamp(2rem,6vw,4rem)">
      {lockup("primary", 380)}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Lockups</p>
      <h2 class="measure-narrow">Five versions, and no others.</h2>
    </div>
    <div class="cols cols--2" style="margin-block-start:2rem">
      <div>
        <div style="background:#EDECEB;padding:2.25rem">{lockup("primary", 230)}</div>
        <h3 style="margin-block-start:1rem">Primary</h3>
        <p>Two-colour on paper or near-white. The default everywhere it fits.
          <a href="assets/img/logo-primary.svg" download>Download SVG</a></p>
      </div>
      <div>
        <div style="background:#201E1D;padding:2.25rem">{lockup("reversed", 230, alt="Ni90ty, reversed")}</div>
        <h3 style="margin-block-start:1rem">Reversed</h3>
        <p>On near-black only. The hands step one shade lighter to hold their weight.
          <a href="assets/img/logo-reversed.svg" download>Download SVG</a></p>
      </div>
      <div>
        <div style="background:#EDECEB;padding:2.25rem">{lockup("one-ink", 230, alt="Ni90ty, one ink")}</div>
        <h3 style="margin-block-start:1rem">One ink</h3>
        <p>Stamps, embroidery, invoices and fax-grade print. The hands drop to the text ink.
          <a href="assets/img/logo-one-ink.svg" download>Download SVG</a></p>
      </div>
      <div>
        <div style="background:#EDECEB;padding:2.25rem;text-align:center">
          <span class="lockup" style="--lockup-w:120px"><img src="assets/img/logo-stacked.svg" alt="Ni90ty, stacked" width="120"></span>
        </div>
        <h3 style="margin-block-start:1rem">Stacked</h3>
        <p>Narrow spaces: courier bags, crate labels, an app splash. Dial above, name below.
          <a href="assets/img/logo-stacked.svg" download>Download SVG</a></p>
      </div>
      <div>
        <div style="background:#EDECEB;padding:2.25rem;text-align:center">
          <span class="lockup" style="--lockup-w:88px"><img src="assets/img/dial.svg" alt="The Ni90ty dial" width="88"></span>
        </div>
        <h3 style="margin-block-start:1rem">Dial alone</h3>
        <p>Only where the name is already present or unambiguous: app icon, favicon, loading
          state, vehicle door, embroidery. Never as decoration on a page that also shows the
          full lockup. <a href="assets/img/dial.svg" download>Download SVG</a></p>
      </div>
      <div>
        <div style="background:#EDECEB;padding:2.25rem;display:flex;gap:1.25rem;align-items:center;justify-content:center">
          <img src="assets/img/icon-buyer.svg" alt="Buyer app icon" width="88" height="88" style="width:88px">
          <img src="assets/img/icon-terminal.svg" alt="Supplier terminal icon" width="88" height="88" style="width:88px">
        </div>
        <h3 style="margin-block-start:1rem">App icons</h3>
        <p>Two tiles only: near-black for the buyer app, cyan for the terminal. A yard should
          never confuse the two on a shared device.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Ink</p>
      <h2 class="measure-narrow">Paper, ink, and two spots.</h2>
      <p class="measure-narrow">Ninety-five percent of every surface is paper and text ink.
        Cyan is the only interactive colour and the colour of the clock. Magenta appears
        rarely, and never in the same small component as cyan.</p>
    </div>
    <div class="table-scroll" style="margin-block-start:2rem">
      <table>
        <thead><tr><th scope="col">Ink</th><th scope="col">Value</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          <tr><th scope="row">Paper</th><td>#F3F2F2</td><td>The default ground</td></tr>
          <tr><th scope="row">Text ink</th><td>#201E1D</td><td>All body copy, rules and the ring</td></tr>
          <tr><th scope="row">Cyan</th><td>#0088B0</td><td>The clock, actions, live states</td></tr>
          <tr><th scope="row">Magenta</th><td>#D6006C</td><td>Expiry, failure, the empty result</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div>
        <p class="label">Type</p>
        <h2>One family, Source Serif 4.</h2>
      </div>
      <div class="stack">
        <p>Headings, interface chrome, numbers and body copy are all set in Source Serif 4.
          There is no second face and no sans-serif for the interface. The serif is the
          chrome.</p>
        <p>Flush left, ragged right, everywhere. Body measure caps at 70 characters, and
          there is no justified text and no centred paragraph. Times, prices and counters are
          set at display weight and size, larger than the copy around them — a countdown is
          never smaller than the label beside it.</p>
        <p>The true italic marks the sentence that tells someone something did not happen. It
          is not used for emphasis inside a running paragraph.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="label">Misuse</p>
      <h2 class="measure-narrow">Six things that break it.</h2>
    </div>
    <ul class="list-plain" style="margin-block-start:1.5rem">
      <li>Do not stretch, condense or re-letterspace the wordmark.</li>
      <li>Do not reset the name in another face. The wordmark is artwork, not live text.</li>
      <li>Do not recolour the dial or move the hands. Ninety past, cyan, always.</li>
      <li>Do not place it on a gradient, a busy photograph or a mid-tone.</li>
      <li>Do not add shadows, outlines, pills or containers of any kind.</li>
      <li>Do not lock the mark to a supplier, partner or courier name. The blind holds in the
        artwork too.</li>
    </ul>
    <p style="margin-block-start:2rem">Artwork and queries:
      <a href="mailto:{BRAND_MAIL}">{BRAND_MAIL}</a></p>
  </div>
</section>"""
    return page(
        "brand.html",
        "Brand and press",
        "The Ni90ty mark, ink and type, with the approved lockups available to download "
        "and the rules for using them.",
        ["Brand and press", "The mark &middot; Ink &middot; Type", "Artwork to download"],
        body,
    )


def build_privacy():
    updated = datetime.date.today().strftime("%d %B %Y")
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Privacy</h1></div>
      <div style="align-self:end">
        <p class="lede">What we collect on this website, why, and how long we keep it.</p>
        <p class="muted" style="font-size:1rem">Last updated {updated}</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div><p class="label">In short</p></div>
      <div class="stack">
        <p>This website collects nothing unless you fill in a form. There is no analytics
          script, no advertising pixel, no third-party font and no cookie set by us.</p>
        <p>When you register a yard, request early access or send a general enquiry, we
          receive what you typed into that form and use it to contact you about Ni90ty. We do
          not sell it and we do not pass it to anyone outside Ni90ty except the hosting and
          email providers that carry the message.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">What we collect</p></div>
      <div class="stack">
        <p><strong>What you send us.</strong> Your name, business name, phone number, email
          address, city or area, and anything you write in a message field.</p>
        <p><strong>Server logs.</strong> Our hosting provider records the usual request
          information — IP address, date and time, the page requested, and your browser's
          user-agent string — as part of running and securing the server.</p>
        <p>We do not collect special categories of personal information through this site,
          and we do not ask for payment details here.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">Why, and for how long</p></div>
      <div class="stack">
        <p>We use what you send to answer you, to assess whether your yard or workshop fits a
          market we are opening, and to tell you when that market opens. That is the whole
          purpose.</p>
        <p>We keep registration and enquiry records for as long as we are still in
          conversation with you, and for a reasonable period afterwards so that we can pick
          the conversation back up. Ask us to delete your record and we will.</p>
        <p>Server logs are retained for the period set by our hosting provider.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">Your rights</p></div>
      <div class="stack">
        <p>You can ask us what we hold about you, ask us to correct it, ask us to delete it,
          or object to us using it. Write to <a href="mailto:{HELLO_MAIL}">{HELLO_MAIL}</a>
          and we will respond.</p>
        <p>In South Africa these rights sit under the Protection of Personal Information Act.
          In the United Arab Emirates they sit under the applicable federal data protection
          law and, where relevant, the rules of the free zone in which the operating entity
          is registered.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">Anonymity in the product</p></div>
      <div class="stack">
        <p>The Ni90ty marketplace is double-blind by design. Buyers are never shown a
          supplier's identity, and suppliers are never shown a buyer's. That is enforced in
          the software rather than promised in a policy, and it extends to photograph
          metadata, which is stripped on upload.</p>
        <p>This page covers the website. The apps have their own notice, published with
          them.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="consequence">This notice is written for a website that is not yet trading. It
        must be reviewed by counsel in both markets, and the operating entity named, before
        Ni90ty accepts a payment or opens a market.</p>
    </div>
  </div>
</section>"""
    return page(
        "privacy.html",
        "Privacy",
        "What the Ni90ty website collects, why, how long it is kept, and how to have it "
        "deleted.",
        ["Privacy", "Website notice", f"Updated {updated}"],
        body,
    )


def build_terms():
    updated = datetime.date.today().strftime("%d %B %Y")
    body = f"""<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Terms</h1></div>
      <div style="align-self:end">
        <p class="lede">The terms on which you use this website.</p>
        <p class="muted" style="font-size:1rem">Last updated {updated}</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="split" style="padding-block-start:2.5rem">
      <div><p class="label">What this site is</p></div>
      <div class="stack">
        <p>This website describes a marketplace that is not yet trading. Nothing on it is an
          offer to sell, an offer to buy, or a binding commitment to supply a service on any
          date.</p>
        <p>Registering a yard or requesting early access places you on a list. It does not
          create an agreement between us, and it does not guarantee that you will be
          onboarded.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">The service, when it opens</p></div>
      <div class="stack">
        <p>Delivery times quoted here are targets, not guarantees. The published wording is
          the accurate one: offers in 30 minutes, delivered in 90 typically, and up to 3
          hours in peak traffic. Delivery is carried out by third-party courier operators.</p>
        <p>Commission rates, service fees and delivery charges are set per market and will be
          stated in the supplier agreement and shown in the buyer app before you accept an
          offer. Where a figure appears on this website it is descriptive, and the agreement
          governs.</p>
        <p>The marketplace is double-blind. Attempting to identify a counterparty, or to take
          a transaction introduced by Ni90ty off the platform, will end your access.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">Content and the mark</p></div>
      <div class="stack">
        <p>The text, layout, photography and the Ni90ty mark on this site belong to Ni90ty.
          The mark may be reproduced for press and partner use in the forms published on the
          <a href="brand.html">brand page</a>, unaltered, and not locked to another
          organisation's name.</p>
        <p>Source Serif 4 is used under the SIL Open Font License, version 1.1.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thin">
    <div class="split" style="padding-block-start:2rem">
      <div><p class="label">Liability</p></div>
      <div class="stack">
        <p>This site is provided as it is. We take reasonable care over what is published
          here, but we do not warrant that every statement will remain accurate as the
          business develops, and we are not liable for a decision taken solely on the basis
          of a page on this website.</p>
        <p>Nothing here limits a liability that cannot lawfully be limited.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p class="consequence">These terms are written for a website that is not yet trading.
        The operating entity, governing law and forum must be settled and inserted by counsel
        in both markets before Ni90ty accepts a payment or opens a market.</p>
      <p style="margin-block-start:1.5rem">Questions:
        <a href="mailto:{HELLO_MAIL}">{HELLO_MAIL}</a></p>
    </div>
  </div>
</section>"""
    return page(
        "terms.html",
        "Terms",
        "The terms on which you use the Ni90ty website, and what is and is not promised "
        "before the marketplace opens.",
        ["Terms", "Website terms", f"Updated {updated}"],
        body,
    )


def build_thanks():
    body = """<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>Received.</h1></div>
      <div style="align-self:end">
        <p class="lede">We have what you sent. Somebody will come back to you during business
          hours in your market.</p>
        <div class="actions">
          <a class="action" href="index.html">Back to the start</a>
          <a class="action-quiet" href="how-it-works.html">How it works</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div style="padding-block-start:2.5rem">
      <p>Yards are onboarded by area, and buyers are invited by city in the order they
        registered. We will tell you which round you are in when we contact you.</p>
    </div>
  </div>
</section>"""
    return page(
        "thank-you.html",
        "Received",
        "Your message has reached Ni90ty.",
        ["Received", "We have your details", "We will be in touch"],
        body,
    )


def build_404():
    body = """<section class="section">
  <div class="wrap">
    <div class="split">
      <div><h1>That page is not here.</h1></div>
      <div style="align-self:end">
        <p class="consequence" style="font-size:1.35rem;color:var(--ink)">The address you
          followed does not match a page on this site.</p>
        <div class="actions">
          <a class="action" href="/">Back to the start</a>
          <a class="action-quiet" href="/contact.html">Contact</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <hr class="rule-thick">
    <div class="cols cols--3" style="padding-block-start:2.5rem">
      <div><h3><a href="/how-it-works.html">How it works</a></h3><p>The loop, step by step.</p></div>
      <div><h3><a href="/for-buyers.html">For workshops</a></h3><p>Post a part, see offers, take delivery.</p></div>
      <div><h3><a href="/for-suppliers.html">For scrapyards</a></h3><p>Free terminal, no fees, paid on the sale.</p></div>
    </div>
  </div>
</section>"""
    # The 404 is served from any depth, so its links and assets are absolute.
    slug = page(
        "404.html",
        "Page not found",
        "That page is not here.",
        ["Not found", "404", "Try one of these"],
        body,
    )
    path = os.path.join(OUT, slug)
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    html = re.sub(r'\b(href|src)="(?!https?:|mailto:|#|/)', r'\1="/', html)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)
    return slug


# ---------------------------------------------------------------------------
# sitemap
# ---------------------------------------------------------------------------

def build_sitemap(slugs):
    today = datetime.date.today().isoformat()
    skip = {"404.html", "thank-you.html"}
    urls = []
    for slug in slugs:
        if slug in skip:
            continue
        loc = f"{SITE}/" if slug == "index.html" else f"{SITE}/{slug}"
        priority = "1.0" if slug == "index.html" else "0.7"
        urls.append(
            f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{today}</lastmod>\n"
            f"    <priority>{priority}</priority>\n  </url>"
        )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    with open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(xml)


def main():
    os.makedirs(OUT, exist_ok=True)
    slugs = [
        build_index(),
        build_how_it_works(),
        build_buyers(),
        build_suppliers(),
        build_markets(),
        build_company(),
        build_contact(),
        build_brand(),
        build_privacy(),
        build_terms(),
        build_thanks(),
        build_404(),
    ]
    build_sitemap(slugs)
    for slug in slugs:
        size = os.path.getsize(os.path.join(OUT, slug))
        print(f"  {slug:<22} {size / 1024:6.1f} kB")
    print(f"  {'sitemap.xml':<22} {os.path.getsize(os.path.join(OUT, 'sitemap.xml')) / 1024:6.1f} kB")


if __name__ == "__main__":
    main()
