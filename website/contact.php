<?php
/**
 * Ni90ty — form handler for Hostinger shared hosting.
 *
 * The three forms on the site (scrapyard registration, buyer early access
 * and general enquiries) post here. It validates, sends you an email and
 * sends the visitor to thank-you.html.
 *
 * ----------------------------------------------------------------------
 * SET THIS UP BEFORE YOU GO LIVE
 *
 * 1. Change MAIL_TO below to the address that should receive enquiries.
 *
 * 2. Change MAIL_FROM to an address on your own domain. Hostinger will
 *    only deliver reliably if the From address belongs to a mailbox on
 *    this domain — create it first in hPanel under Emails. Sending "from"
 *    the visitor's own address gets the message marked as spoofed and
 *    dropped, which is why the visitor's address goes in Reply-To instead.
 *
 * 3. Send yourself a test message from the live site and confirm it
 *    arrives. If it does not, set LOG_FALLBACK to true, submit again, and
 *    read contact-log.txt over FTP to see what happened. The supplied
 *    .htaccess blocks that file from the web.
 * ----------------------------------------------------------------------
 */

const MAIL_TO       = 'hello@ni90ty.com';
const MAIL_FROM     = 'website@ni90ty.com';
const MAIL_FROM_NAME = 'Ni90ty website';
const SUCCESS_URL   = 'thank-you.html';
const LOG_FALLBACK  = true;          // also append every submission to contact-log.txt
const LOG_FILE      = 'contact-log.txt';

// ---------------------------------------------------------------------

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: contact.html', true, 303);
    exit;
}

/** Collapse whitespace and strip anything that could forge a mail header. */
function clean(string $key, int $max = 2000): string
{
    $value = isset($_POST[$key]) && is_string($_POST[$key]) ? $_POST[$key] : '';
    $value = str_replace(["\r", "\0"], '', $value);
    $value = trim($value);
    return mb_substr($value, 0, $max);
}

/** A value used inside a mail header must not contain a newline. */
function header_safe(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value));
}

// Honeypot: a real person never sees this field, so anything in it is a bot.
// Answer with the success page rather than an error, so the bot learns nothing.
if (clean('company_url') !== '') {
    header('Location: ' . SUCCESS_URL, true, 303);
    exit;
}

$form     = header_safe(clean('form', 80)) ?: 'Website enquiry';
$name     = clean('name', 120);
$business = clean('business', 160);
$email    = clean('email', 160);
$phone    = clean('phone', 60);
$area     = clean('area', 120);
$stock    = clean('stock', 4000);
$message  = clean('message', 4000);

$errors = [];
if ($name === '') {
    $errors[] = 'a name';
}
if ($email === '' && $phone === '') {
    $errors[] = 'an email address or a phone number';
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'a valid email address';
}

if ($errors) {
    http_response_code(400);
    $needed = htmlspecialchars(implode(' and ', $errors), ENT_QUOTES, 'UTF-8');
    echo <<<HTML
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not sent — Ni90ty</title>
<link rel="stylesheet" href="assets/site.css"></head>
<body><main class="wrap section">
<h1>Not sent.</h1>
<p class="consequence" style="font-size:1.35rem;color:var(--ink)">The form needs {$needed}.</p>
<p>Nothing was sent. Go back, add what is missing, and submit again.</p>
<p style="margin-block-start:2rem"><a class="action" href="contact.html">Back to the form</a></p>
</main></body></html>
HTML;
    exit;
}

// ---------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------

$lines = ['Form: ' . $form, ''];
foreach ([
    'Name'     => $name,
    'Business' => $business,
    'Email'    => $email,
    'Phone'    => $phone,
    'Area'     => $area,
    'Detail'   => $stock,
    'Message'  => $message,
] as $label => $value) {
    if ($value !== '') {
        $lines[] = $label . ': ' . $value;
    }
}
$lines[] = '';
$lines[] = 'Received: ' . gmdate('Y-m-d H:i:s') . ' UTC';
$lines[] = 'From IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$lines[] = 'Page: ' . header_safe($_SERVER['HTTP_REFERER'] ?? 'unknown');

$body    = implode("\n", $lines) . "\n";
$subject = 'Ni90ty — ' . $form . ' — ' . ($business !== '' ? $business : $name);

$headers = [
    'From: ' . sprintf('%s <%s>', header_safe(MAIL_FROM_NAME), MAIL_FROM),
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    'X-Mailer: Ni90ty website',
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . header_safe($email);
}

$sent = @mail(
    MAIL_TO,
    '=?UTF-8?B?' . base64_encode(header_safe($subject)) . '?=',
    $body,
    implode("\r\n", $headers),
    '-f' . MAIL_FROM
);

if (LOG_FALLBACK) {
    @file_put_contents(
        __DIR__ . '/' . LOG_FILE,
        str_repeat('-', 60) . "\n" . ($sent ? 'MAIL OK' : 'MAIL FAILED') . "\n" . $body,
        FILE_APPEND | LOCK_EX
    );
}

if (!$sent) {
    // Say what happened, then what we are doing about it, then what it
    // costs them. Never pretend a message was delivered when it was not.
    http_response_code(500);
    $to = htmlspecialchars(MAIL_TO, ENT_QUOTES, 'UTF-8');
    echo <<<HTML
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not sent — Ni90ty</title>
<link rel="stylesheet" href="assets/site.css"></head>
<body><main class="wrap section">
<h1>Not sent.</h1>
<p class="consequence" style="font-size:1.35rem;color:var(--ink)">The server could not send
the message, so nothing reached us.</p>
<p>Email <a href="mailto:{$to}">{$to}</a> directly and we will pick it up from there.</p>
<p style="margin-block-start:2rem"><a class="action" href="contact.html">Back to the form</a></p>
</main></body></html>
HTML;
    exit;
}

header('Location: ' . SUCCESS_URL, true, 303);
exit;
