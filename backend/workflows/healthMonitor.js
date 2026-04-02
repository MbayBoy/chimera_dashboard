const supabase = require('../config/supabase');
const { checkAllRBLs } = require('../services/rblChecker');
const { validateDNS } = require('../services/dnsValidator');
const { REPUTATION } = require('../config/constants');
const logger = require('../utils/logger');

async function healthMonitor() {
  const { data: servers, error } = await supabase?.from('servers')?.select('*')?.not('status', 'in', '("Provisioning","Burnt")');

  if (error) throw error;
  if (!servers || servers?.length === 0) {
    logger?.info('[Health Monitor] No servers to check');
    return;
  }

  logger?.info('[Health Monitor] Checking ' + servers?.length + ' servers...');

  for (const server of servers) {
    try {
      const rblResults = await checkAllRBLs(server?.ip_address);

      const { data: domains } = await supabase?.from('domains')?.select('*')?.eq('server_id', server?.id)?.limit(1);

      let dnsStatus = null;
      if (domains && domains?.length > 0) {
        try {
          dnsStatus = await validateDNS(domains?.[0]);
        } catch (dnsErr) {
          logger?.warn('DNS check failed for ' + domains?.[0]?.domain_name + ': ' + dnsErr?.message);
        }
      }

      let reputationScore = server?.reputation_score || 100;

      if (rblResults?.hasCriticalListing) {
        reputationScore = Math.max(0, reputationScore - 30);
      } else if (rblResults?.listedCount > 0) {
        reputationScore = Math.max(0, reputationScore - (rblResults?.listedCount * 10));
      } else if (reputationScore < 100) {
        reputationScore = Math.min(100, reputationScore + 1);
      }

      await supabase?.from('servers')?.update({
        reputation_score: reputationScore,
        blacklist_status: {
          lastChecked: new Date()?.toISOString(),
          totalListed: rblResults?.listedCount,
          isClean: rblResults?.isClean,
          listings: rblResults?.listings?.map(l => ({
            rbl: l?.rbl,
            reason: l?.reason || '',
            isCritical: l?.isCritical || false,
            delistUrl: l?.delistUrl || null,
            detectedAt: l?.checkedAt
          }))
        },
        health_last_checked: new Date()?.toISOString()
      })?.eq('id', server?.id);

      if (dnsStatus && domains && domains?.length > 0) {
        await supabase?.from('domains')?.update({
          spf_status: dnsStatus?.spf?.valid ? 'Valid' : 'Invalid',
          dkim_status: dnsStatus?.dkim?.valid ? 'Valid' : 'Invalid',
          dmarc_status: dnsStatus?.dmarc?.valid ? 'Valid' : 'Invalid',
          health_score: dnsStatus?.overallHealth
        })?.eq('id', domains?.[0]?.id);
      }

      if (server?.status === 'Active' && (rblResults?.hasCriticalListing || reputationScore < REPUTATION?.QUARANTINE_THRESHOLD)) {
        await quarantineServer(server?.id, server?.name, 'Listed on ' + rblResults?.listedCount + ' blacklists (score: ' + reputationScore + ')');
      }

    } catch (serverErr) {
      logger?.error('[Health Monitor] Error checking server ' + server?.name + ': ' + serverErr?.message);
    }
  }

  await logToSystem('INFO', 'Health_Monitor', 'Health check completed for ' + servers?.length + ' servers');
}

async function quarantineServer(serverId, serverName, reason) {
  await supabase?.from('servers')?.update({
    status: 'Quarantined',
    last_strategy_change: reason
  })?.eq('id', serverId);

  const { data: activeServers } = await supabase?.from('servers')?.select('id')?.eq('status', 'Active')?.eq('purpose', 'Production')?.order('reputation_score', { ascending: false })?.limit(1);

  if (activeServers && activeServers?.length > 0) {
    await supabase?.from('campaign_queue')?.update({ server_id: activeServers?.[0]?.id })?.eq('server_id', serverId)?.eq('status', 'Queued');
  }

  await logToSystem('CRITICAL', 'Health_Monitor', 'Server ' + serverName + ' auto-quarantined: ' + reason, serverId);
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

module.exports = healthMonitor;
