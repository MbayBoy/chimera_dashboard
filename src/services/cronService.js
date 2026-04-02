/**
 * Chimera Cron Service
 * Simulates Node-cron scheduling in the browser using setInterval/setTimeout.
 * All workflows log to System_Logs table with try-catch error handling.
 * CRITICAL errors trigger alert escalation.
 */
import { supabase } from '../lib/supabase';

// ============================================================
// SYSTEM LOG HELPER
// ============================================================
const logToSystem = async (workflow, level, message, details = null) => {
  try {
    await supabase?.from('system_logs')?.insert({
      log_level: level,
      source: workflow,
      message,
      details: details ? JSON.stringify(details) : null,
      created_at: new Date()?.toISOString(),
    });
  } catch (err) {
    console.error('[CronService] Failed to write system log:', err);
  }
};

const escalateAlert = async (workflow, error) => {
  console.error(`[CRITICAL ALERT] ${workflow}:`, error?.message || error);
  await logToSystem(workflow, 'CRITICAL', `Alert escalation: ${error?.message || String(error)}`, {
    stack: error?.stack,
    escalatedAt: new Date()?.toISOString(),
    escalatedTo: 'admin',
  });
};

// ============================================================
// HEALTH MONITOR (every 5 minutes)
// ============================================================
const runHealthMonitor = async () => {
  const WORKFLOW = 'HealthMonitor';
  try {
    await logToSystem(WORKFLOW, 'INFO', 'Health monitor cycle started');

    const { data: servers, error: serversError } = await supabase?.from('servers')?.select('id, name, reputation_score, server_status, blacklist_status');
    if (serversError) throw serversError;

    let checked = 0;
    let quarantined = 0;

    for (const server of (servers || [])) {
      try {
        const reputation = server?.reputation_score || 100;
        const blacklistCount = server?.blacklist_status?.count || 0;

        // Auto-quarantine if reputation < 40 or blacklist count > 3
        if ((reputation < 40 || blacklistCount > 3) && server?.server_status !== 'Quarantined') {
          await supabase?.from('servers')?.update({
            server_status: 'Quarantined',
            health_last_checked: new Date()?.toISOString(),
          })?.eq('id', server?.id);

          await logToSystem(WORKFLOW, 'WARNING',
            `Server ${server?.name} auto-quarantined: reputation=${reputation}, blacklists=${blacklistCount}`,
            { serverId: server?.id }
          );
          quarantined++;
        } else {
          await supabase?.from('servers')?.update({
            health_last_checked: new Date()?.toISOString(),
          })?.eq('id', server?.id);
        }
        checked++;
      } catch (serverErr) {
        await logToSystem(WORKFLOW, 'ERROR', `Failed to check server ${server?.name}: ${serverErr?.message}`);
      }
    }

    await logToSystem(WORKFLOW, 'INFO',
      `Health monitor cycle complete: ${checked} servers checked, ${quarantined} quarantined`);
  } catch (err) {
    await logToSystem(WORKFLOW, 'ERROR', `Health monitor failed: ${err?.message}`);
    await escalateAlert(WORKFLOW, err);
  }
};

// ============================================================
// AI GOVERNOR (daily at 2 AM)
// ============================================================
const runAIGovernor = async () => {
  const WORKFLOW = 'AIGovernor';
  try {
    await logToSystem(WORKFLOW, 'INFO', 'AI Governor daily analysis started');

    const { data: domains, error: domainsError } = await supabase?.from('domains')?.select('id, domain_name, health_score, domain_status, warmup_day');
    if (domainsError) throw domainsError;

    let retired = 0;
    let adjusted = 0;

    for (const domain of (domains || [])) {
      try {
        const healthScore = domain?.health_score || 100;

        // Retire burnt domains (health < 20)
        if (healthScore < 20 && domain?.domain_status !== 'Retired') {
          await supabase?.from('domains')?.update({ domain_status: 'Retired' })?.eq('id', domain?.id);
          await logToSystem(WORKFLOW, 'WARNING',
            `Domain ${domain?.domain_name} retired: health_score=${healthScore}`,
            { domainId: domain?.id }
          );
          retired++;
        }
        // Adjust warmup schedule for struggling domains (health 20-60)
        else if (healthScore >= 20 && healthScore < 60 && domain?.warmup_day > 1) {
          const newWarmupDay = Math.max(1, (domain?.warmup_day || 1) - 2);
          await supabase?.from('domains')?.update({ warmup_day: newWarmupDay })?.eq('id', domain?.id);
          await logToSystem(WORKFLOW, 'INFO',
            `Domain ${domain?.domain_name} warmup adjusted: day ${domain?.warmup_day} → ${newWarmupDay}`,
            { domainId: domain?.id }
          );
          adjusted++;
        }
      } catch (domainErr) {
        await logToSystem(WORKFLOW, 'ERROR', `Failed to govern domain ${domain?.domain_name}: ${domainErr?.message}`);
      }
    }

    await logToSystem(WORKFLOW, 'INFO',
      `AI Governor complete: ${retired} domains retired, ${adjusted} warmup schedules adjusted`);
  } catch (err) {
    await logToSystem(WORKFLOW, 'ERROR', `AI Governor failed: ${err?.message}`);
    await escalateAlert(WORKFLOW, err);
  }
};

// ============================================================
// CAMPAIGN DISPATCHER (every 1 minute)
// ============================================================
const runCampaignDispatcher = async () => {
  const WORKFLOW = 'CampaignDispatcher';
  try {
    const { data: queued, error: queueError } = await supabase?.from('campaign_queue')?.select('id, campaign_id, contact_id, scheduled_for, queue_status')?.eq('queue_status', 'Queued')?.lte('scheduled_for', new Date()?.toISOString())?.limit(50);
    if (queueError) throw queueError;

    if (!queued?.length) return;

    let dispatched = 0;
    let failed = 0;

    for (const item of queued) {
      try {
        // Check daily limits before dispatching
        const { data: campaign } = await supabase?.from('campaigns')?.select('daily_send_limit, sent_count')?.eq('id', item?.campaign_id)?.single();

        const dailyLimit = campaign?.daily_send_limit || 10000;
        const sentCount = campaign?.sent_count || 0;

        if (sentCount >= dailyLimit) {
          await logToSystem(WORKFLOW, 'INFO',
            `Campaign ${item?.campaign_id} daily limit reached (${sentCount}/${dailyLimit}), skipping`);
          continue;
        }

        // Mark as sent
        await supabase?.from('campaign_queue')?.update({
          queue_status: 'Sent',
          sent_at: new Date()?.toISOString(),
        })?.eq('id', item?.id);

        dispatched++;
      } catch (itemErr) {
        await supabase?.from('campaign_queue')?.update({ queue_status: 'Failed' })?.eq('id', item?.id);
        failed++;
      }
    }

    if (dispatched > 0 || failed > 0) {
      await logToSystem(WORKFLOW, 'INFO',
        `Dispatcher cycle: ${dispatched} sent, ${failed} failed from ${queued?.length} queued`);
    }
  } catch (err) {
    await logToSystem(WORKFLOW, 'ERROR', `Campaign dispatcher failed: ${err?.message}`);
    await escalateAlert(WORKFLOW, err);
  }
};

// ============================================================
// ENGAGEMENT SEGMENTER (nightly)
// ============================================================
const runEngagementSegmenter = async () => {
  const WORKFLOW = 'EngagementSegmenter';
  try {
    await logToSystem(WORKFLOW, 'INFO', 'Engagement segmentation started');

    const { data: contacts, error: contactsError } = await supabase?.from('contacts')?.select('id, open_rate, click_rate, bounce_count, complaint_count, engagement_tier')?.limit(1000);
    if (contactsError) throw contactsError;

    let updated = 0;
    const tierCounts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, Lead: 0 };

    for (const contact of (contacts || [])) {
      try {
        const openRate = contact?.open_rate || 0;
        const clickRate = contact?.click_rate || 0;
        const bounces = contact?.bounce_count || 0;
        const complaints = contact?.complaint_count || 0;

        // Calculate engagement score
        let score = (openRate * 0.4) + (clickRate * 0.4) - (bounces * 5) - (complaints * 10);
        score = Math.max(0, Math.min(100, score));

        // Assign tier
        let tier = 'Lead';
        if (score >= 80 && complaints === 0) tier = 'Platinum';
        else if (score >= 60) tier = 'Gold';
        else if (score >= 40) tier = 'Silver';
        else if (score >= 20) tier = 'Bronze';

        if (contact?.engagement_tier !== tier) {
          await supabase?.from('contacts')?.update({
            engagement_tier: tier,
            engagement_score: Math.round(score),
          })?.eq('id', contact?.id);
          updated++;
        }
        tierCounts[tier]++;
      } catch (contactErr) {
        // Silent fail per contact
      }
    }

    await logToSystem(WORKFLOW, 'INFO',
      `Segmentation complete: ${updated} contacts re-tiered`,
      tierCounts
    );
  } catch (err) {
    await logToSystem(WORKFLOW, 'ERROR', `Engagement segmenter failed: ${err?.message}`);
    await escalateAlert(WORKFLOW, err);
  }
};

// ============================================================
// BOUNCE PROCESSOR (every 10 minutes)
// ============================================================
const runBounceProcessor = async () => {
  const WORKFLOW = 'BounceProcessor';
  try {
    const { data: complaints, error: complaintsError } = await supabase?.from('complaint_reports')?.select('id, contact_email, server_id, report_type, campaign_id')?.limit(100);
    if (complaintsError) throw complaintsError;

    if (!complaints?.length) return;

    let processed = 0;
    let quarantined = 0;

    for (const complaint of complaints) {
      try {
        const isHardBounce = complaint?.report_type === 'Hard Bounce';
        const isPolicyBlock = complaint?.report_type === 'Policy Block';
        const isSpamComplaint = complaint?.report_type === 'Spam' || complaint?.report_type === 'FBL';

        // Update contact status by email
        if ((isHardBounce || isSpamComplaint) && complaint?.contact_email) {
          await supabase?.from('contacts')?.update({
            contact_status: isSpamComplaint ? 'Complained' : 'Bounced',
          })?.eq('email', complaint?.contact_email);
        }

        // Auto-quarantine server on policy blocks
        if (isPolicyBlock && complaint?.server_id) {
          await supabase?.from('servers')?.update({
            server_status: 'Quarantined',
          })?.eq('id', complaint?.server_id);

          await logToSystem(WORKFLOW, 'WARNING',
            `Server quarantined due to policy block complaint`,
            { serverId: complaint?.server_id, complaintId: complaint?.id }
          );
          quarantined++;
        }

        processed++;
      } catch (itemErr) {
        await logToSystem(WORKFLOW, 'ERROR', `Failed to process complaint ${complaint?.id}: ${itemErr?.message}`);
      }
    }

    if (processed > 0) {
      await logToSystem(WORKFLOW, 'INFO',
        `Bounce processor: ${processed} complaints processed, ${quarantined} servers quarantined`);
    }
  } catch (err) {
    await logToSystem(WORKFLOW, 'ERROR', `Bounce processor failed: ${err?.message}`);
    await escalateAlert(WORKFLOW, err);
  }
};

// ============================================================
// SCHEDULER (simulates node-cron in browser)
// ============================================================
const intervals = [];

export const startCronScheduler = () => {
  console.log('[CronService] Starting all scheduled workflows...');

  // Health Monitor: every 5 minutes
  runHealthMonitor();
  intervals?.push(setInterval(runHealthMonitor, 5 * 60 * 1000));

  // Campaign Dispatcher: every 1 minute
  runCampaignDispatcher();
  intervals?.push(setInterval(runCampaignDispatcher, 60 * 1000));

  // Bounce Processor: every 10 minutes
  runBounceProcessor();
  intervals?.push(setInterval(runBounceProcessor, 10 * 60 * 1000));

  // AI Governor: daily (check every hour, run if 2 AM)
  const checkAIGovernor = () => {
    const hour = new Date()?.getHours();
    if (hour === 2) runAIGovernor();
  };
  checkAIGovernor();
  intervals?.push(setInterval(checkAIGovernor, 60 * 60 * 1000));

  // Engagement Segmenter: nightly (check every hour, run if midnight)
  const checkEngagementSegmenter = () => {
    const hour = new Date()?.getHours();
    if (hour === 0) runEngagementSegmenter();
  };
  checkEngagementSegmenter();
  intervals?.push(setInterval(checkEngagementSegmenter, 60 * 60 * 1000));

  logToSystem('CronService', 'INFO', 'All 5 workflows scheduled: HealthMonitor(5m), CampaignDispatcher(1m), BounceProcessor(10m), AIGovernor(daily@2AM), EngagementSegmenter(nightly)');

  return () => {
    intervals?.forEach(clearInterval);
    console.log('[CronService] All workflows stopped.');
  };
};

export const runWorkflowNow = async (workflow) => {
  const map = {
    health: runHealthMonitor,
    governor: runAIGovernor,
    dispatcher: runCampaignDispatcher,
    segmenter: runEngagementSegmenter,
    bounce: runBounceProcessor,
  };
  const fn = map?.[workflow];
  if (fn) await fn();
};

export default { startCronScheduler, runWorkflowNow };
