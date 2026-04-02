const dns = require('dns')?.promises;
const net = require('net');
const logger = require('../utils/logger');

/**
 * Verify email format with regex
 */
function validateFormat(email) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex?.test(email);
}

/**
 * Check if domain has valid MX records
 */
async function checkMXRecords(domain) {
  try {
    const records = await dns?.resolveMx(domain);
    if (!records || records?.length === 0) {
      return { valid: false, records: [], error: 'No MX records found' };
    }
    // Sort by priority
    records?.sort((a, b) => a?.priority - b?.priority);
    return { valid: true, records, primaryMX: records?.[0]?.exchange };
  } catch (error) {
    return { valid: false, records: [], error: error?.message };
  }
}

/**
 * Check if domain exists via A/AAAA record
 */
async function checkDomainExists(domain) {
  try {
    await dns?.resolve(domain);
    return true;
  } catch {
    return false;
  }
}

/**
 * SMTP verification - connect to mail server and check if mailbox exists
 * Uses RCPT TO command without actually sending email
 */
async function smtpVerify(email, mxHost) {
  return new Promise((resolve) => {
    const timeout = 10000; // 10 second timeout
    let resolved = false;

    const socket = net.createConnection(25, mxHost);
    socket.setTimeout(timeout);

    const done = (result) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(result);
      }
    };

    let step = 0;
    let buffer = '';

    socket.on('timeout', () => done({ valid: null, error: 'SMTP timeout' }));
    socket.on('error', (err) => done({ valid: null, error: err.message }));

    socket.on('data', (data) => {
      buffer += data.toString();

      if (!buffer.includes('\r\n')) return;

      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      for (const line of lines) {
        const code = parseInt(line.substring(0, 3));

        if (step === 0 && code === 220) {
          // Server ready - send HELO
          socket.write(`EHLO chimera-verifier.local\r\n`);
          step = 1;
        } else if (step === 1 && (code === 250 || code === 220)) {
          // EHLO accepted - send MAIL FROM
          socket.write(`MAIL FROM:<verify@chimera-verifier.local>\r\n`);
          step = 2;
        } else if (step === 2 && code === 250) {
          // MAIL FROM accepted - send RCPT TO
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else if (step === 3) {
          if (code === 250 || code === 251) {
            done({ valid: true, code });
          } else if (code === 550 || code === 551 || code === 553) {
            done({ valid: false, code, error: 'Mailbox does not exist' });
          } else if (code === 421 || code === 450 || code === 451 || code === 452) {
            done({ valid: null, code, error: 'Temporary failure - try later' });
          } else {
            done({ valid: null, code, error: `Unexpected response: ${line}` });
          }
        } else if (code >= 400) {
          done({ valid: null, code, error: line });
        }
      }
    });

    setTimeout(() => done({ valid: null, error: 'Connection timeout' }), timeout);
  });
}

/**
 * Check if email is a known disposable/temporary email domain
 */
function isDisposable(domain) {
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
    'guerrillamail.org', 'spam4.me', 'trashmail.com', 'trashmail.me',
    'dispostable.com', 'mailnull.com', 'spamgourmet.com', 'maildrop.cc'
  ];
  return disposableDomains?.includes(domain?.toLowerCase());
}

/**
 * Full email verification pipeline
 * @param {string} email - Email address to verify
 * @returns {object} Verification result with verdict and score
 */
async function verifyEmail(email) {
  const result = {
    email,
    verdict: 'unknown',
    score: 0,
    checks: {}
  };

  // 1. Format check
  result.checks.format = validateFormat(email);
  if (!result?.checks?.format) {
    result.verdict = 'invalid';
    result.score = 0;
    return result;
  }

  const [localPart, domain] = email?.split('@');

  // 2. Disposable check
  result.checks.disposable = isDisposable(domain);
  if (result?.checks?.disposable) {
    result.verdict = 'invalid';
    result.score = 0.1;
    return result;
  }

  // 3. Domain existence check
  result.checks.domainExists = await checkDomainExists(domain);
  if (!result?.checks?.domainExists) {
    result.verdict = 'invalid';
    result.score = 0.1;
    return result;
  }

  // 4. MX record check
  const mxResult = await checkMXRecords(domain);
  result.checks.hasMX = mxResult?.valid;
  result.checks.mxRecords = mxResult?.records;

  if (!mxResult?.valid) {
    result.verdict = 'invalid';
    result.score = 0.2;
    return result;
  }

  // 5. SMTP verification (optional - some servers block this)
  try {
    const smtpResult = await smtpVerify(email, mxResult?.primaryMX);
    result.checks.smtp = smtpResult;

    if (smtpResult?.valid === true) {
      result.verdict = 'valid';
      result.score = 0.95;
    } else if (smtpResult?.valid === false) {
      result.verdict = 'invalid';
      result.score = 0.05;
    } else {
      // SMTP inconclusive - mark as risky but has MX
      result.verdict = 'risky';
      result.score = 0.6;
    }
  } catch (err) {
    // SMTP check failed - still has valid MX
    result.checks.smtp = { valid: null, error: err?.message };
    result.verdict = 'risky';
    result.score = 0.6;
  }

  return result;
}

module.exports = { verifyEmail, checkMXRecords, validateFormat, isDisposable };