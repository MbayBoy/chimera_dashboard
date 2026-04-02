const supabase = require('../config/supabase');
const axios = require('axios');
const logger = require('../utils/logger');

async function campaignDispatcher() {
  const now = new Date()?.toISOString();

  // Get queued jobs ready to send
  const { data: jobs, error } = await supabase?.from('campaign_queue')?.select(`
      id, campaign_id, contact_id, server_id, attempt_count,
      campaigns (id, name, subject, body_html, body_text, from_domain_id, status),
      contacts (id, email, total_sent),
      servers (id, name, ip_address, agent_port, agent_api_key, status, daily_limit, sent_today)
    `)?.eq('status', 'Queued')?.lte('scheduled_for', now)?.limit(500);

  if (error) throw error;
  if (!jobs || jobs?.length === 0) return;

  logger?.info(`[Campaign Dispatcher] Processing ${jobs?.length} queued jobs`);

  // Group by server to respect daily limits
  const jobsByServer = {};
  jobs?.forEach(job => {
    const sid = job?.server_id;
    if (!jobsByServer?.[sid]) jobsByServer[sid] = [];
    jobsByServer?.[sid]?.push(job);
  });

  for (const [serverId, serverJobs] of Object.entries(jobsByServer)) {
    const server = serverJobs?.[0]?.servers;

    if (!server || server?.status !== 'Active') {
      logger?.warn(`[Campaign Dispatcher] Skipping server ${serverId} - not active`);
      continue;
    }

    const remaining = (server?.daily_limit || 1000) - (server?.sent_today || 0);
    if (remaining <= 0) {
      logger?.info(`[Campaign Dispatcher] Server ${server?.name} reached daily limit`);
      continue;
    }

    const batch = serverJobs?.slice(0, Math.min(remaining, 100));

    for (const job of batch) {
      const campaign = job?.campaigns;
      const contact = job?.contacts;

      if (!campaign || !contact) continue;
      if (campaign?.status === 'Paused') continue;

      try {
        // Get sending domain
        const { data: domain } = await supabase?.from('domains')?.select('domain_name')?.eq('id', campaign?.from_domain_id)?.single();

        const fromAddress = domain
          ? `noreply@${domain?.domain_name}`
          : `noreply@chimera.io`;

        // Call mail server agent
        const agentUrl = `http://${server?.ip_address}:${server?.agent_port || 8080}/send`;

        await axios?.post(agentUrl, {
          to: contact?.email,
          from: fromAddress,
          subject: campaign?.subject,
          html: campaign?.body_html,
          text: campaign?.body_text,
          campaignId: campaign?.id,
          contactId: contact?.id
        }, {
          headers: { 'X-API-Key': server?.agent_api_key },
          timeout: 30000,
          signal: undefined
        });

        // Mark as sent
        await supabase?.from('campaign_queue')?.update({ status: 'Sent', sent_at: new Date()?.toISOString() })?.eq('id', job?.id);

        // Update counters (non-blocking)
        Promise.all([
          supabase?.from('servers')?.update({ sent_today: (server?.sent_today || 0) + 1 })?.eq('id', server?.id),
          supabase?.from('campaigns')?.update({ sent_count: supabase?.rpc ? undefined : undefined })?.eq('id', campaign?.id),
          supabase?.from('contacts')?.update({
              total_sent: (contact?.total_sent || 0) + 1,
              ip_address_sent_last: server?.ip_address
            })?.eq('id', contact?.id)
        ])?.catch(err => logger?.warn('Counter update failed:', err?.message));

      } catch (sendErr) {
        // Detect AbortError / timeout gracefully
        const isTimeout =
          sendErr?.code === 'ECONNABORTED' ||
          sendErr?.code === 'ERR_CANCELED' ||
          sendErr?.name === 'AbortError'|| sendErr?.message?.includes('aborted') ||
          sendErr?.message?.includes('timeout');

        if (isTimeout) {
          logger?.warn(`[Campaign Dispatcher] Agent timeout for job ${job?.id} on server ${server?.name} - will retry`);
        } else {
          logger?.warn(`[Campaign Dispatcher] Send failed for job ${job?.id}: ${sendErr?.message}`);
        }

        const newAttempts = (job?.attempt_count || 0) + 1;
        await supabase?.from('campaign_queue')?.update({
            attempt_count: newAttempts,
            status: newAttempts >= 3 ? 'Failed' : 'Queued'
          })?.eq('id', job?.id);
      }
    }
  }
}

module.exports = campaignDispatcher;
