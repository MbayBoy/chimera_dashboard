const supabase = require('../config/supabase');
const logger = require('../utils/logger');

async function bounceProcessor() {
  if (process.env.BOUNCE_IMAP_HOST && process.env.BOUNCE_IMAP_USER) {
    await processBounceMailbox();
  }

  if (process.env.FBL_IMAP_HOST && process.env.FBL_IMAP_USER) {
    await processFBLMailbox();
  }

  const now = new Date();
  if (now?.getHours() === 0 && now?.getMinutes() < 10) {
    await resetDailyCounters();
  }

  await logToSystem('INFO', 'Bounce_Processor', 'Bounce processing cycle completed');
}

async function processBounceMailbox() {
  try {
    const imapSimple = require('imap-simple');
    const { simpleParser } = require('mailparser');

    const config = {
      imap: {
        user: process.env.BOUNCE_IMAP_USER,
        password: process.env.BOUNCE_IMAP_PASSWORD,
        host: process.env.BOUNCE_IMAP_HOST,
        port: parseInt(process.env.BOUNCE_IMAP_PORT || '993'),
        tls: true,
        authTimeout: 5000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    const connection = await imapSimple?.connect(config);
    await connection?.openBox('INBOX');
    const messages = await connection?.search(['UNSEEN'], { bodies: [''], markSeen: true });

    logger?.info('[Bounce Processor] Processing ' + messages?.length + ' bounce emails');

    for (const item of messages) {
      try {
        const all = item?.parts?.find(p => p?.which === '');
        if (!all) continue;
        const parsed = await simpleParser(all?.body);
        await processBounceEmail(parsed);
      } catch (parseErr) {
        logger?.warn('[Bounce Processor] Parse error: ' + parseErr?.message);
      }
    }

    connection?.end();
  } catch (err) {
    logger?.error('[Bounce Processor] IMAP connection failed: ' + err?.message);
  }
}

async function processBounceEmail(parsed) {
  const text = parsed?.text || parsed?.html || '';
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text?.match(emailRegex) || [];
  const recipient = emails?.find(e => !e?.includes('mailer-daemon') && !e?.includes('postmaster'));
  if (!recipient) return;

  const smtpMatch = text?.match(/([45]\d{2})\s/);
  const smtpCode = smtpMatch ? smtpMatch?.[1] : null;

  const { data: contact } = await supabase?.from('contacts')?.select('id, email, bounce_count, ip_address_sent_last, status')?.eq('email', recipient?.toLowerCase())?.single();

  if (!contact) return;

  const isHardBounce = smtpCode && smtpCode?.startsWith('5');
  const isPolicyBlock = text?.toLowerCase()?.includes('spam') || text?.toLowerCase()?.includes('policy') || text?.toLowerCase()?.includes('blocked');

  if (isPolicyBlock) {
    await supabase?.from('contacts')?.update({ status: 'Complained' })?.eq('id', contact?.id);
    if (contact?.ip_address_sent_last) {
      const { data: server } = await supabase?.from('servers')?.select('id, name')?.eq('ip_address', contact?.ip_address_sent_last)?.single();
      if (server) {
        await supabase?.from('servers')?.update({ status: 'Quarantined', last_strategy_change: 'Policy block detected for ' + recipient })?.eq('id', server?.id);
        await logToSystem('CRITICAL', 'Bounce_Processor', 'Server ' + server?.name + ' quarantined: policy block for ' + recipient, server?.id);
      }
    }
  } else if (isHardBounce) {
    await supabase?.from('contacts')?.update({ status: 'Bounced', bounce_count: (contact?.bounce_count || 0) + 1 })?.eq('id', contact?.id);
    await logToSystem('INFO', 'Bounce_Processor', 'Hard bounce: ' + recipient + ' (SMTP ' + smtpCode + ')');
  } else {
    const newCount = (contact?.bounce_count || 0) + 1;
    await supabase?.from('contacts')?.update({ bounce_count: newCount, status: newCount >= 3 ? 'Bounced' : contact?.status })?.eq('id', contact?.id);
  }
}

async function processFBLMailbox() {
  try {
    const imapSimple = require('imap-simple');
    const { simpleParser } = require('mailparser');

    const config = {
      imap: {
        user: process.env.FBL_IMAP_USER,
        password: process.env.FBL_IMAP_PASSWORD,
        host: process.env.FBL_IMAP_HOST,
        port: parseInt(process.env.FBL_IMAP_PORT || '993'),
        tls: true,
        authTimeout: 5000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    const connection = await imapSimple?.connect(config);
    await connection?.openBox('INBOX');
    const messages = await connection?.search(['UNSEEN'], { bodies: [''], markSeen: true });

    for (const item of messages) {
      try {
        const all = item?.parts?.find(p => p?.which === '');
        if (!all) continue;
        const parsed = await simpleParser(all?.body);
        const text = parsed?.text || '';
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = text?.match(emailRegex) || [];
        const recipient = emails?.[0];
        if (!recipient) continue;

        const { data: contact } = await supabase?.from('contacts')?.select('id, email')?.eq('email', recipient?.toLowerCase())?.single();
        if (contact) {
          await supabase?.from('contacts')?.update({ status: 'Complained' })?.eq('id', contact?.id);
          await supabase?.from('complaint_reports')?.insert({
            contact_email: contact?.email,
            source_isp: parsed?.from && parsed?.from?.value && parsed?.from?.value?.[0] ? parsed?.from?.value?.[0]?.address?.split('@')?.[1] : 'unknown',
            report_type: 'FBL',
            raw_report: text?.substring(0, 1000),
            timestamp: new Date()?.toISOString()
          });
          await logToSystem('WARN', 'Bounce_Processor', 'FBL complaint: ' + contact?.email);
        }
      } catch (err) {
        logger?.warn('[Bounce Processor] FBL parse error: ' + err?.message);
      }
    }

    connection?.end();
  } catch (err) {
    logger?.error('[Bounce Processor] FBL IMAP failed: ' + err?.message);
  }
}

async function resetDailyCounters() {
  const { error } = await supabase?.from('servers')?.update({ sent_today: 0 })?.neq('status', 'Burnt');
  if (!error) logger?.info('[Bounce Processor] Daily sent counters reset');
}

async function logToSystem(level, source, message, serverId) {
  try {
    await supabase?.from('system_logs')?.insert({
      log_level: level,
      source: source,
      message: message,
      server_id: serverId || null,
      log_timestamp: new Date()?.toISOString()
    });
  } catch (err) {
    logger?.error('Failed to write system log:', err?.message);
  }
}

module.exports = bounceProcessor;
