const supabase = require('../config/supabase');
const { REPUTATION } = require('../config/constants');
const logger = require('../utils/logger');

async function aiGovernor() {
  logger?.info('[AI Governor] Starting governance cycle...');

  await analyzeServerHealth();
  await analyzeDomainHealth();
  await adjustWarmupSchedules();
  await detectAnomalies();

  await logToSystem('INFO', 'AI_Governor', 'Governance cycle completed successfully');
  logger?.info('[AI Governor] Governance cycle complete');
}

async function analyzeServerHealth() {
  const { data: servers } = await supabase?.from('servers')?.select('*')?.in('status', ['Active', 'Warming']);
  if (!servers) return;

  for (const server of servers) {
    const rep = server?.reputation_score || 100;

    if (rep < REPUTATION?.QUARANTINE_THRESHOLD) {
      await supabase?.from('servers')?.update({
        status: 'Quarantined',
        last_strategy_change: 'AI Governor: Sustained low reputation (' + rep + ')'
      })?.eq('id', server?.id);
      await logToSystem('CRITICAL', 'AI_Governor', 'Server ' + server?.name + ' quarantined: reputation ' + rep, server?.id);
    } else if (rep < REPUTATION?.WARNING_THRESHOLD) {
      const reducedLimit = Math.floor((server?.daily_limit || 1000) * 0.5);
      await supabase?.from('servers')?.update({
        daily_limit: reducedLimit,
        last_strategy_change: 'AI Governor: Reduced limit due to reputation ' + rep
      })?.eq('id', server?.id);
      await logToSystem('WARN', 'AI_Governor', 'Server ' + server?.name + ' daily limit reduced to ' + reducedLimit + ' (rep: ' + rep + ')', server?.id);
    } else if (rep >= REPUTATION?.HEALTHY_THRESHOLD && server?.daily_limit < 5000) {
      let newLimit = Math.min(server?.daily_limit + 100, 5000);
      await supabase?.from('servers')?.update({ daily_limit: newLimit })?.eq('id', server?.id);
    }
  }
}

async function analyzeDomainHealth() {
  const { data: domains } = await supabase?.from('domains')?.select('*, servers(blacklist_status, reputation_score)')?.eq('status', 'Active');
  if (!domains) return;

  for (const domain of domains) {
    const server = domain?.servers;
    if (!server) continue;

    const blacklistData = typeof server?.blacklist_status === 'string' ? JSON.parse(server?.blacklist_status ||'{}')
      : (server?.blacklist_status || {});

    const criticalListings = (blacklistData?.listings || [])?.filter(l => l?.isCritical);

    if (criticalListings?.length > 0) {
      await supabase?.from('domains')?.update({ status: 'Burnt', health_score: 0 })?.eq('id', domain?.id);
      await logToSystem('CRITICAL', 'AI_Governor', 'Domain ' + domain?.domain_name + ' marked as Burnt: critical blacklist listings');
    }
  }
}

async function adjustWarmupSchedules() {
  const { data: warmingServers } = await supabase?.from('servers')?.select('*')?.eq('status', 'Warming');
  if (!warmingServers) return;

  for (const server of warmingServers) {
    const warmupDay = (server?.warmup_day || 0) + 1;
    let newLimit = server?.daily_limit || 50;
    let newStatus = 'Warming';

    if (warmupDay <= 7) {
      newLimit = warmupDay * 50;
    } else if (warmupDay <= 14) {
      newLimit = 350 + (warmupDay - 7) * 100;
    } else if (warmupDay <= 21) {
      newLimit = 1050 + (warmupDay - 14) * 200;
    } else {
      newLimit = 3000;
      newStatus = 'Active';
    }

    await supabase?.from('servers')?.update({
      warmup_day: warmupDay,
      daily_limit: newLimit,
      status: newStatus,
      last_strategy_change: 'AI Governor: Warmup day ' + warmupDay + ', limit ' + newLimit
    })?.eq('id', server?.id);

    if (newStatus === 'Active') {
      await logToSystem('INFO', 'AI_Governor', 'Server ' + server?.name + ' graduated from warmup to Active (day ' + warmupDay + ')', server?.id);
    }
  }
}

async function detectAnomalies() {
  // Check for bounce rate spikes
  const { data: campaigns } = await supabase?.from('campaigns')?.select('id, name, sent_count, bounce_count')?.eq('status', 'Running');
  if (campaigns) {
    for (const campaign of campaigns) {
      if (!campaign?.sent_count || campaign?.sent_count < 100) continue;
      const bounceRate = (campaign?.bounce_count || 0) / campaign?.sent_count;
      if (bounceRate > 0.05) {
        const { data: existing } = await supabase?.from('anomalies')?.select('id')?.eq('affected_entity_id', campaign?.id)?.eq('anomaly_type', 'Bounce_Spike')?.eq('is_resolved', false)?.limit(1);
        if (!existing || existing?.length === 0) {
          await supabase?.from('anomalies')?.insert({
            detected_at: new Date()?.toISOString(),
            anomaly_type: 'Bounce_Spike',
            severity: bounceRate > 0.10 ? 'Critical' : 'High',
            description: 'Campaign "' + campaign?.name + '" has ' + (bounceRate * 100)?.toFixed(1) + '% bounce rate',
            affected_entity_id: campaign?.id,
            affected_entity_type: 'Campaign',
            is_resolved: false,
            remediation_status: 'Pending',
            remediation_recommendation: 'Pause campaign and clean contact list'
          });
          await logToSystem('WARN', 'AI_Governor', 'Anomaly: Campaign ' + campaign?.name + ' bounce rate ' + (bounceRate * 100)?.toFixed(1) + '%');
        }
      }
    }
  }

  // Check for reputation drops
  const { data: servers } = await supabase?.from('servers')?.select('id, name, reputation_score')?.lt('reputation_score', 50)?.in('status', ['Active', 'Warming']);
  if (servers) {
    for (const server of servers) {
      const { data: existing } = await supabase?.from('anomalies')?.select('id')?.eq('server_id', server?.id)?.eq('anomaly_type', 'Reputation_Drop')?.eq('is_resolved', false)?.limit(1);
      if (!existing || existing?.length === 0) {
        await supabase?.from('anomalies')?.insert({
          detected_at: new Date()?.toISOString(),
          anomaly_type: 'Reputation_Drop',
          severity: server?.reputation_score < 30 ? 'Critical' : 'High',
          description: 'Server "' + server?.name + '" reputation dropped to ' + server?.reputation_score,
          server_id: server?.id,
          affected_entity_id: server?.id,
          affected_entity_type: 'Server',
          is_resolved: false,
          remediation_status: 'Pending',
          remediation_recommendation: 'Check blacklist status and reduce sending volume'
        });
      }
    }
  }
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

module.exports = aiGovernor;
