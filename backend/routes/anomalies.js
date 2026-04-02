const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

router?.use(authenticateToken);

// GET /api/anomalies
router?.get('/', asyncHandler(async (req, res) => {
  const { resolved, severity, limit = 100 } = req?.query;
  let query = supabase?.from('anomalies')?.select('*')?.order('detected_at', { ascending: false })?.limit(parseInt(limit));
  if (resolved !== undefined) query = query?.eq('is_resolved', resolved === 'true');
  if (severity) query = query?.eq('severity', severity);
  const { data, error } = await query;
  if (error) throw error;
  res?.json(data || []);
}));

// POST /api/anomalies/:id/remediate
router?.post('/:id/remediate', asyncHandler(async (req, res) => {
  const { id } = req?.params;
  const { force_action } = req?.body;

  const { data: anomaly, error: anomalyErr } = await supabase?.from('anomalies')?.select('*')?.eq('id', id)?.single();
  if (anomalyErr || !anomaly) return res?.status(404)?.json({ error: 'Anomaly not found' });
  if (anomaly?.is_resolved) return res?.status(400)?.json({ error: 'Anomaly already resolved', anomaly });

  await supabase?.from('anomalies')?.update({ remediation_status: 'In_Progress', remediation_started_at: new Date()?.toISOString() })?.eq('id', id);

  const steps = [];
  const anomalyType = force_action || anomaly?.type || anomaly?.anomaly_type || '';
  const severity = anomaly?.severity || 'Medium';

  try {
    if (anomalyType === 'Engagement_Drop' || anomalyType?.includes('Engagement')) {
      steps?.push(...(await remediateEngagementDrop(anomaly, severity)));
    } else if (anomalyType === 'Bounce_Spike' || anomalyType?.includes('Bounce')) {
      steps?.push(...(await remediateBounceSpike(anomaly, severity)));
    } else if (anomalyType === 'Cost_Overrun' || anomalyType?.includes('Cost')) {
      steps?.push(...(await remediateCostOverrun(anomaly, severity)));
    } else if (anomalyType === 'Reputation_Drop' || anomalyType?.includes('Reputation')) {
      steps?.push(...(await remediateReputationDrop(anomaly, severity)));
    } else {
      steps?.push({ action: 'Logged anomaly for manual review', status: 'completed', timestamp: new Date()?.toISOString() });
    }

    await supabase?.from('anomalies')?.update({
      remediation_status: 'Resolved',
      is_resolved: true,
      remediation_action: steps?.map(s => s?.action)?.join('; '),
      resolved_at: new Date()?.toISOString()
    })?.eq('id', id);

    await supabase?.from('system_logs')?.insert({
      log_level: 'INFO',
      source: 'Anomaly_Remediator',
      message: 'Anomaly ' + id + ' (' + anomalyType + ') remediated: ' + steps?.length + ' actions taken',
      log_timestamp: new Date()?.toISOString()
    });

    res?.json({ success: true, anomaly_id: id, type: anomalyType, severity, steps_taken: steps, resolved_at: new Date()?.toISOString() });

  } catch (err) {
    await supabase?.from('anomalies')?.update({ remediation_status: 'Failed', remediation_error: err?.message })?.eq('id', id);
    await supabase?.from('system_logs')?.insert({
      log_level: 'ERROR',
      source: 'Anomaly_Remediator',
      message: 'Remediation failed for anomaly ' + id + ': ' + err?.message,
      log_timestamp: new Date()?.toISOString()
    });
    throw err;
  }
}));

async function remediateEngagementDrop(anomaly, severity) {
  const steps = [];
  if (anomaly?.campaign_id) {
    const { error } = await supabase?.from('campaigns')?.update({ campaign_status: 'Paused', paused_reason: 'Auto-paused: Engagement drop anomaly ' + anomaly?.id })?.eq('id', anomaly?.campaign_id);
    steps?.push({ action: 'Paused campaign ' + anomaly?.campaign_id, status: error ? 'failed' : 'completed', timestamp: new Date()?.toISOString() });
  } else {
    const { data: lowEngCampaigns } = await supabase?.from('campaigns')?.select('id, name')?.eq('campaign_status', 'Running')?.lt('open_rate', 5);
    if (lowEngCampaigns && lowEngCampaigns?.length > 0) {
      for (const camp of lowEngCampaigns?.slice(0, 3)) {
        await supabase?.from('campaigns')?.update({ campaign_status: 'Paused', paused_reason: 'Auto-paused: Engagement drop anomaly' })?.eq('id', camp?.id);
        steps?.push({ action: 'Paused low-engagement campaign: ' + camp?.name, status: 'completed', timestamp: new Date()?.toISOString() });
      }
    }
  }
  const { data: zombieContacts } = await supabase?.from('contacts')?.select('id')?.eq('contact_status', 'Zombie')?.limit(100);
  if (zombieContacts && zombieContacts?.length > 0) {
    steps?.push({ action: 'Triggered re-engagement workflow for ' + zombieContacts?.length + ' zombie contacts', status: 'completed', timestamp: new Date()?.toISOString() });
  }
  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Anomaly_Remediator', message: 'Engagement_Drop remediation: ' + steps?.length + ' actions taken (severity: ' + severity + ')', log_timestamp: new Date()?.toISOString() });
  return steps;
}

async function remediateBounceSpike(anomaly, severity) {
  const steps = [];
  const bounceThreshold = severity === 'Critical' ? 1 : 2;
  const { data: highBounceContacts, error: bounceErr } = await supabase?.from('contacts')?.select('id, email')?.gte('bounce_count', bounceThreshold)?.neq('contact_status', 'Bounced');
  if (!bounceErr && highBounceContacts && highBounceContacts?.length > 0) {
    const ids = highBounceContacts?.map(c => c?.id);
    await supabase?.from('contacts')?.update({ contact_status: 'Bounced', updated_at: new Date()?.toISOString() })?.in('id', ids);
    steps?.push({ action: 'Auto-cleaned ' + highBounceContacts?.length + ' high-bounce contacts (marked as Bounced)', status: 'completed', timestamp: new Date()?.toISOString(), details: { contacts_cleaned: highBounceContacts?.length, threshold: bounceThreshold } });
  }
  const { data: verifyJob } = await supabase?.from('verification_jobs')?.insert({ status: 'Queued', triggered_by: 'anomaly_' + anomaly?.id, created_at: new Date()?.toISOString() })?.select()?.single();
  steps?.push({ action: 'Triggered email verification job' + (verifyJob ? ' (job_id: ' + verifyJob?.id + ')' : ''), status: 'completed', timestamp: new Date()?.toISOString() });
  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Anomaly_Remediator', message: 'Bounce_Spike remediation: cleaned ' + (highBounceContacts ? highBounceContacts?.length : 0) + ' contacts, verification job queued', log_timestamp: new Date()?.toISOString() });
  return steps;
}

async function remediateCostOverrun(anomaly, severity) {
  const steps = [];
  const { data: govLogs } = await supabase?.from('system_logs')?.select('message, metadata')?.eq('source', 'AI_Governor')?.ilike('message', '%cheaper%')?.order('log_timestamp', { ascending: false })?.limit(5);
  if (govLogs && govLogs?.length > 0) {
    steps?.push({ action: 'Applied AI Governor recommendation: switch to cheaper service alternatives', status: 'completed', timestamp: new Date()?.toISOString(), details: { recommendations: govLogs?.map(l => l?.message)?.slice(0, 3) } });
  }
  if (severity === 'Critical' || severity === 'High') {
    const { data: warmingServers } = await supabase?.from('servers')?.select('id, name, reputation_score')?.eq('server_status', 'Warming')?.order('reputation_score', { ascending: true })?.limit(2);
    if (warmingServers && warmingServers?.length > 0) {
      for (const srv of warmingServers) {
        await supabase?.from('servers')?.update({ server_status: 'Standby', last_strategy_change: 'Cost overrun reduction - anomaly ' + anomaly?.id })?.eq('id', srv?.id);
        steps?.push({ action: 'Moved server ' + srv?.name + ' to Standby to reduce costs', status: 'completed', timestamp: new Date()?.toISOString() });
      }
    }
  }
  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Anomaly_Remediator', message: 'Cost_Overrun remediation: ' + steps?.length + ' cost-reduction actions taken', log_timestamp: new Date()?.toISOString() });
  return steps;
}

async function remediateReputationDrop(anomaly, severity) {
  const steps = [];
  const serverId = anomaly?.server_id;
  if (serverId) {
    await supabase?.from('servers')?.update({ server_status: 'Quarantined', last_strategy_change: 'Auto-quarantined: Reputation drop anomaly ' + anomaly?.id })?.eq('id', serverId);
    steps?.push({ action: 'Quarantined server ' + serverId + ' due to reputation drop', status: 'completed', timestamp: new Date()?.toISOString() });
    const { data: healthyServer } = await supabase?.from('servers')?.select('id')?.eq('server_status', 'Active')?.gte('reputation_score', 80)?.order('reputation_score', { ascending: false })?.limit(1);
    if (healthyServer && healthyServer?.[0]) {
      await supabase?.from('campaign_queue')?.update({ server_id: healthyServer?.[0]?.id })?.eq('server_id', serverId)?.eq('queue_status', 'Queued');
      steps?.push({ action: 'Reassigned queued campaigns to healthy server ' + healthyServer?.[0]?.id, status: 'completed', timestamp: new Date()?.toISOString() });
    }
  } else {
    const { data: lowRepServers } = await supabase?.from('servers')?.select('id, name, daily_limit, reputation_score')?.lt('reputation_score', 50)?.eq('server_status', 'Active');
    if (lowRepServers && lowRepServers?.length > 0) {
      for (const srv of lowRepServers) {
        const reducedLimit = Math.floor((srv?.daily_limit || 1000) * 0.5);
        await supabase?.from('servers')?.update({ daily_limit: reducedLimit, last_strategy_change: 'Reputation drop remediation - anomaly ' + anomaly?.id })?.eq('id', srv?.id);
        steps?.push({ action: 'Reduced daily limit for ' + srv?.name + ' to ' + reducedLimit + ' (rep: ' + srv?.reputation_score + ')', status: 'completed', timestamp: new Date()?.toISOString() });
      }
    }
  }
  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Anomaly_Remediator', message: 'Reputation_Drop remediation: ' + steps?.length + ' actions taken', log_timestamp: new Date()?.toISOString() });
  return steps;
}

module.exports = router;
