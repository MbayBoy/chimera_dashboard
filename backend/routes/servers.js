const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkAllRBLs } = require('../services/rblChecker');
const { validateDNS } = require('../services/dnsValidator');
const logger = require('../utils/logger');

router?.use(authenticateToken);

// GET /api/servers
router?.get('/', asyncHandler(async (req, res) => {
  const { status, purpose } = req?.query;
  let query = supabase?.from('servers')?.select('*')?.order('reputation_score', { ascending: false });
  if (status) query = query?.eq('status', status);
  if (purpose) query = query?.eq('purpose', purpose);
  const { data, error } = await query;
  if (error) throw error;
  res?.json(data);
}));

// GET /api/servers/:id
router?.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('servers')?.select('*, domains(*)')?.eq('id', req?.params?.id)?.single();
  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Server not found' });
  res?.json(data);
}));

// POST /api/servers
router?.post('/', asyncHandler(async (req, res) => {
  const { name, ip_address, hostname, purpose, daily_limit, agent_port, agent_api_key } = req?.body;
  if (!name || !ip_address) return res?.status(400)?.json({ error: 'name and ip_address are required' });

  const { data, error } = await supabase?.from('servers')?.insert({
    name, ip_address, hostname,
    purpose: purpose || 'Production',
    daily_limit: daily_limit || 1000,
    agent_port: agent_port || 8080,
    agent_api_key: agent_api_key || null,
    server_status: 'Provisioning',
    reputation_score: 100,
    sent_today: 0,
    warmup_day: 0,
    created_at: new Date()?.toISOString()
  })?.select()?.single();

  if (error) throw error;

  await supabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'Server_Management', message: 'Server added: ' + name + ' (' + ip_address + ')', server_id: data?.id, log_timestamp: new Date()?.toISOString() });

  logger?.info('Server added: ' + data?.id + ' - ' + name + ' (' + ip_address + ')');
  res?.status(201)?.json(data);
}));

// PUT /api/servers/:id
router?.put('/:id', asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'hostname', 'purpose', 'daily_limit', 'agent_port', 'agent_api_key', 'server_status', 'warmup_day'];
  const updates = {};
  allowedFields?.forEach(field => { if (req?.body?.[field] !== undefined) updates[field] = req?.body?.[field]; });
  // Support legacy 'status' field from frontend
  if (req?.body?.status !== undefined && req?.body?.server_status === undefined) updates.server_status = req?.body?.status;
  const { data, error } = await supabase?.from('servers')?.update(updates)?.eq('id', req?.params?.id)?.select()?.single();
  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Server not found' });
  res?.json(data);
}));

// DELETE /api/servers/:id
router?.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase?.from('servers')?.delete()?.eq('id', req?.params?.id);
  if (error) throw error;
  res?.json({ success: true, message: 'Server removed' });
}));

// POST /api/servers/:id/quarantine
router?.post('/:id/quarantine', asyncHandler(async (req, res) => {
  const { reason } = req?.body;
  const { data, error } = await supabase?.from('servers')?.update({ server_status: 'Quarantined', last_strategy_change: reason || 'Manual quarantine' })?.eq('id', req?.params?.id)?.select()?.single();
  if (error) throw error;

  const { data: activeServers } = await supabase?.from('servers')?.select('id')?.eq('server_status', 'Active')?.order('reputation_score', { ascending: false })?.limit(1);
  if (activeServers && activeServers?.length > 0) {
    await supabase?.from('campaign_queue')?.update({ server_id: activeServers?.[0]?.id })?.eq('server_id', req?.params?.id)?.eq('queue_status', 'Queued');
  }

  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Manual_Action', message: 'Server ' + req?.params?.id + ' manually quarantined: ' + (reason || 'No reason given'), server_id: parseInt(req?.params?.id), log_timestamp: new Date()?.toISOString() });
  res?.json({ success: true, server: data });
}));

// POST /api/servers/:id/restore
router?.post('/:id/restore', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('servers')?.update({ server_status: 'Active', last_strategy_change: 'Manually restored from quarantine' })?.eq('id', req?.params?.id)?.select()?.single();
  if (error) throw error;
  await supabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'Manual_Action', message: 'Server ' + req?.params?.id + ' manually restored from quarantine', server_id: parseInt(req?.params?.id), log_timestamp: new Date()?.toISOString() });
  res?.json({ success: true, server: data });
}));

// POST /api/servers/:id/check-health
router?.post('/:id/check-health', asyncHandler(async (req, res) => {
  const { data: server, error } = await supabase?.from('servers')?.select('*')?.eq('id', req?.params?.id)?.single();
  if (error || !server) return res?.status(404)?.json({ error: 'Server not found' });

  const rblResults = await checkAllRBLs(server?.ip_address);
  const { data: domains } = await supabase?.from('domains')?.select('*')?.eq('server_id', server?.id)?.limit(1);
  let dnsStatus = null;
  if (domains && domains?.length > 0) dnsStatus = await validateDNS(domains?.[0]);

  await supabase?.from('servers')?.update({
    blacklist_status: { lastChecked: new Date()?.toISOString(), totalListed: rblResults?.listedCount, listings: rblResults?.listings },
    health_last_checked: new Date()?.toISOString()
  })?.eq('id', server?.id);

  res?.json({ server: server?.name, ip: server?.ip_address, rbl: rblResults, dns: dnsStatus, checkedAt: new Date()?.toISOString() });
}));

// GET /api/servers/:id/logs
router?.get('/:id/logs', asyncHandler(async (req, res) => {
  const { limit = 100, level } = req?.query;
  let query = supabase?.from('system_logs')?.select('*')?.eq('server_id', req?.params?.id)?.order('log_timestamp', { ascending: false })?.limit(parseInt(limit));
  if (level) query = query?.eq('log_level', level);
  const { data, error } = await query;
  if (error) throw error;
  res?.json(data);
}));

// GET /api/servers/:id/autopsy
router?.get('/:id/autopsy', asyncHandler(async (req, res) => {
  const serverId = req?.params?.id;
  const { data: server, error: serverErr } = await supabase?.from('servers')?.select('*')?.eq('id', serverId)?.single();
  if (serverErr || !server) return res?.status(404)?.json({ error: 'Server not found' });

  const { data: allLogs } = await supabase?.from('system_logs')?.select('*')?.eq('server_id', serverId)?.order('log_timestamp', { ascending: true });
  const logs = allLogs || [];

  const timeline = logs?.map(log => ({
    id: log?.id,
    timestamp: log?.log_timestamp,
    event_type: inferEventType(log?.source, log?.message, log?.log_level),
    description: log?.message,
    severity: log?.log_level,
    source: log?.source,
    metadata: log?.metadata || null
  }));

  const blacklistStatus = server?.blacklist_status || {};

  res?.json({
    server: {
      id: server?.id, name: server?.name, ip_address: server?.ip_address, hostname: server?.hostname,
      status: server?.status, reputation_score: server?.reputation_score, purpose: server?.purpose,
      quarantined_at: server?.quarantined_at || null, quarantine_reason: server?.last_strategy_change || null,
      blacklist_count: blacklistStatus?.totalListed || 0
    },
    timeline,
    blacklist_history: buildBlacklistHistory(blacklistStatus, logs),
    reputation_trajectory: buildReputationTrajectory(logs, server?.reputation_score),
    rehabilitation_progress: buildRehabilitationProgress(server, logs),
    contact_zero: await findContactZero(serverId, logs),
    generated_at: new Date()?.toISOString()
  });
}));

function inferEventType(source, message, level) {
  const msg = (message || '')?.toLowerCase();
  const src = (source || '')?.toLowerCase();
  if (msg?.includes('quarantine') || src?.includes('quarantine')) return 'quarantine';
  if (msg?.includes('blacklist') || msg?.includes('rbl') || msg?.includes('listed')) return 'blacklist_detected';
  if (msg?.includes('reputation') || msg?.includes('score')) return 'reputation_change';
  if (msg?.includes('campaign') || msg?.includes('sent') || msg?.includes('dispatch')) return 'campaign_sent';
  if (src?.includes('health') || msg?.includes('health')) return 'health_check';
  if (level === 'CRITICAL' || level === 'ERROR') return 'critical_event';
  return 'system_event';
}

function buildBlacklistHistory(blacklistStatus, logs) {
  const history = [];
  logs?.filter(l => l?.message && (l?.message?.toLowerCase()?.includes('blacklist') || l?.message?.toLowerCase()?.includes('rbl') || l?.message?.toLowerCase()?.includes('listed')))?.forEach(log => {
    history?.push({ timestamp: log?.log_timestamp, event: log?.message, severity: log?.log_level });
  });
  if (blacklistStatus?.listings && blacklistStatus?.listings?.length > 0) {
    blacklistStatus?.listings?.forEach(listing => {
      history?.push({ timestamp: listing?.detectedAt || new Date()?.toISOString(), event: 'Listed on ' + listing?.rbl + (listing?.reason ? ': ' + listing?.reason : ''), severity: listing?.isCritical ? 'CRITICAL' : 'WARN', rbl: listing?.rbl, delistUrl: listing?.delistUrl });
    });
  }
  return history?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function buildReputationTrajectory(logs, currentScore) {
  const trajectory = [];
  logs?.filter(l => l?.message && l?.message?.toLowerCase()?.includes('reputation'))?.forEach(log => {
    const match = log?.message?.match(/reputation[:\s]+(\d+)/i);
    if (match) trajectory?.push({ timestamp: log?.log_timestamp, score: parseInt(match?.[1]), event: log?.message });
  });
  trajectory?.push({ timestamp: new Date()?.toISOString(), score: currentScore, event: 'Current reputation score' });
  return trajectory?.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function buildRehabilitationProgress(server, logs) {
  const steps = [
    { step: 'Identify root cause', completed: logs?.some(l => l?.message && l?.message?.toLowerCase()?.includes('quarantine')) },
    { step: 'Remove from blacklists', completed: (server?.blacklist_status && server?.blacklist_status?.totalListed || 0) === 0 },
    { step: 'Fix DNS records', completed: false },
    { step: 'Reduce sending volume', completed: (server?.daily_limit || 1000) < 500 },
    { step: 'Monitor reputation recovery', completed: (server?.reputation_score || 0) > 50 },
    { step: 'Restore to active', completed: server?.status === 'Active' }
  ];
  const completedCount = steps?.filter(s => s?.completed)?.length;
  return { steps, progress: Math.round((completedCount / steps?.length) * 100), completedSteps: completedCount, totalSteps: steps?.length };
}

async function findContactZero(serverId, logs) {
  try {
    const { data: complaints } = await supabase?.from('complaint_reports')?.select('*')?.order('timestamp', { ascending: true })?.limit(1);
    if (complaints && complaints?.length > 0) {
      return { email: complaints?.[0]?.contact_email, timestamp: complaints?.[0]?.timestamp, source: complaints?.[0]?.source_isp, type: complaints?.[0]?.report_type };
    }
    const firstCritical = logs?.find(l => l?.log_level === 'CRITICAL');
    if (firstCritical) return { email: null, timestamp: firstCritical?.log_timestamp, event: firstCritical?.message, type: 'system_event' };
    return null;
  } catch (err) {
    return null;
  }
}

module.exports = router;
