import { supabase } from '../lib/supabase';

// ============================================================
// SERVERS SERVICE
// ============================================================
export const serversService = {
  async getAll() {
    const { data, error } = await supabase?.from('servers')?.select('*')?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(s => ({
      id: s?.id,
      name: s?.name,
      ip: s?.ip_address,
      hostname: s?.hostname,
      status: s?.server_status,
      purpose: s?.purpose,
      reputation: s?.reputation_score,
      dailyLimit: s?.daily_limit,
      dailySent: s?.sent_today,
      warmupDay: s?.warmup_day,
      blacklistCount: s?.blacklist_status?.count || 0,
      region: s?.region,
      healthLastChecked: s?.health_last_checked,
      agentPort: s?.agent_port,
      createdAt: s?.created_at,
    })) || [];
  },

  async create(serverData) {
    const { data, error } = await supabase?.from('servers')?.insert({
        name: serverData?.name,
        ip_address: serverData?.ip,
        hostname: serverData?.hostname,
        server_status: serverData?.status || 'Provisioning',
        purpose: serverData?.purpose || 'Production',
        daily_limit: serverData?.dailyLimit || 50000,
        region: serverData?.region || 'US-East',
        agent_port: serverData?.agentPort || 8080,
      })?.select()?.single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const dbUpdates = {};
    if (updates?.status !== undefined) dbUpdates.server_status = updates?.status;
    if (updates?.reputation !== undefined) dbUpdates.reputation_score = updates?.reputation;
    if (updates?.dailyLimit !== undefined) dbUpdates.daily_limit = updates?.dailyLimit;
    if (updates?.sentToday !== undefined) dbUpdates.sent_today = updates?.sentToday;
    const { data, error } = await supabase?.from('servers')?.update(dbUpdates)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase?.from('servers')?.delete()?.eq('id', id);
    if (error) throw error;
  },

  subscribeToChanges(callback) {
    return supabase?.channel('servers_realtime')?.on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, callback)?.subscribe();
  },
};

// ============================================================
// CAMPAIGNS SERVICE
// ============================================================
export const campaignsService = {
  async getAll() {
    const { data, error } = await supabase?.from('campaigns')?.select('*, domains(domain_name), servers(name)')?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(c => ({
      id: c?.id,
      name: c?.name,
      subject: c?.subject,
      status: c?.campaign_status,
      riskProfile: c?.risk_profile,
      riskScore: c?.risk_score,
      contentScore: c?.content_score,
      predictedInboxRate: c?.predicted_inbox_rate,
      canaryStatus: c?.campaign_canary_status,
      sent: c?.sent_count,
      delivered: c?.delivered_count,
      opens: c?.open_count,
      clicks: c?.click_count,
      bounces: c?.bounce_count,
      complaints: c?.complaint_count,
      totalRecipients: c?.total_recipients,
      scheduledFor: c?.scheduled_for,
      createdAt: c?.created_at,
      fromDomain: c?.domains?.domain_name,
      assignedServer: c?.servers?.name,
    })) || [];
  },

  async create(campaignData) {
    const { data, error } = await supabase?.from('campaigns')?.insert({
        name: campaignData?.name,
        subject: campaignData?.subject,
        body_html: campaignData?.bodyHtml,
        body_text: campaignData?.bodyText,
        campaign_status: campaignData?.status || 'Draft',
        risk_profile: campaignData?.riskProfile,
        risk_score: campaignData?.riskScore || 0,
        content_score: campaignData?.contentScore || 0,
        scheduled_for: campaignData?.scheduledFor,
      })?.select()?.single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const dbUpdates = {};
    if (updates?.status !== undefined) dbUpdates.campaign_status = updates?.status;
    if (updates?.canaryStatus !== undefined) dbUpdates.campaign_canary_status = updates?.canaryStatus;
    if (updates?.riskScore !== undefined) dbUpdates.risk_score = updates?.riskScore;
    const { data, error } = await supabase?.from('campaigns')?.update(dbUpdates)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase?.from('campaigns')?.delete()?.eq('id', id);
    if (error) throw error;
  },

  subscribeToChanges(callback) {
    return supabase?.channel('campaigns_realtime')?.on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, callback)?.subscribe();
  },
};

// ============================================================
// CONTACTS SERVICE
// ============================================================
export const contactsService = {
  async getByList(listId) {
    const { data, error } = await supabase?.from('contacts')?.select('*')?.eq('list_id', listId)?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(c => ({
      id: c?.id,
      email: c?.email,
      status: c?.contact_status,
      tier: c?.tier,
      engagementScore: c?.engagement_score,
      lastOpenDate: c?.last_open_date,
      bounceCount: c?.bounce_count,
      totalSent: c?.total_sent,
      predictedLtv: c?.predicted_ltv,
      churnProbability: c?.churn_probability,
      optimalSendTimeHour: c?.optimal_send_time_hour,
      createdAt: c?.created_at,
    })) || [];
  },

  async delete(id) {
    const { error } = await supabase?.from('contacts')?.delete()?.eq('id', id);
    if (error) throw error;
  },

  async deleteMany(ids) {
    const { error } = await supabase?.from('contacts')?.delete()?.in('id', ids);
    if (error) throw error;
  },

  async deleteByStatus(listId, status) {
    const { error } = await supabase?.from('contacts')?.delete()?.eq('list_id', listId)?.eq('contact_status', status);
    if (error) throw error;
  },

  async checkDuplicate(email) {
    const { data, error } = await supabase?.from('contacts')?.select('id, email, list_id')?.eq('email', email)?.maybeSingle();
    if (error) throw error;
    return data;
  },
};

// ============================================================
// CONTACT LISTS SERVICE
// ============================================================
export const contactListsService = {
  async getAll() {
    const { data, error } = await supabase?.from('contact_lists')?.select('*')?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(l => ({
      id: l?.id,
      name: l?.name,
      status: l?.list_status,
      totalContacts: l?.total_contacts,
      platinumCount: l?.platinum_count,
      goldCount: l?.gold_count,
      silverCount: l?.silver_count,
      bronzeCount: l?.bronze_count,
      leadCount: l?.lead_count,
      avgEngagement: l?.average_engagement_score,
      predictedLtv: l?.predicted_ltv,
      churnRiskScore: l?.churn_risk_score,
      highRiskCount: l?.high_risk_count,
      createdAt: l?.created_at,
    })) || [];
  },

  async create(listData) {
    const { data, error } = await supabase?.from('contact_lists')?.insert({ name: listData?.name, list_status: 'Building' })?.select()?.single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase?.from('contact_lists')?.delete()?.eq('id', id);
    if (error) throw error;
  },

  subscribeToChanges(callback) {
    return supabase?.channel('contact_lists_realtime')?.on('postgres_changes', { event: '*', schema: 'public', table: 'contact_lists' }, callback)?.subscribe();
  },
};

// ============================================================
// SYSTEM LOGS SERVICE
// ============================================================
export const systemLogsService = {
  async getRecent(limit = 50) {
    const { data, error } = await supabase?.from('system_logs')?.select('*')?.order('log_timestamp', { ascending: false })?.limit(limit);
    if (error) throw error;
    return data?.map(l => ({
      id: l?.id,
      timestamp: l?.log_timestamp,
      level: l?.log_level,
      source: l?.source,
      message: l?.message,
      serverId: l?.server_id,
      campaignId: l?.related_campaign_id,
    })) || [];
  },

  async insert(level, source, message, serverId = null, campaignId = null) {
    const { error } = await supabase?.from('system_logs')?.insert({
      log_level: level,
      source,
      message,
      server_id: serverId,
      related_campaign_id: campaignId,
    });
    if (error) console.error('Log insert error:', error);
  },

  subscribeToNewLogs(callback) {
    return supabase?.channel('system_logs_realtime')?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, callback)?.subscribe();
  },
};

// ============================================================
// ANOMALIES SERVICE
// ============================================================
export const anomaliesService = {
  async getAll() {
    const { data, error } = await supabase?.from('anomalies')?.select('*')?.order('detected_at', { ascending: false });
    if (error) throw error;
    return data?.map(a => ({
      id: a?.id,
      detectedAt: a?.detected_at,
      type: a?.anomaly_type,
      severity: a?.severity,
      title: a?.title,
      description: a?.description,
      affectedEntity: a?.affected_entity,
      metricValue: a?.metric_value,
      baselineValue: a?.baseline_value,
      deviationPercent: a?.deviation_percent,
      isResolved: a?.is_resolved,
      remediationAction: a?.remediation_action,
      resolvedAt: a?.resolved_at,
    })) || [];
  },

  async resolve(id, remediationAction) {
    const { data, error } = await supabase?.from('anomalies')?.update({ is_resolved: true, remediation_action: remediationAction, resolved_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
    if (error) throw error;
    return data;
  },

  subscribeToChanges(callback) {
    return supabase?.channel('anomalies_realtime')?.on('postgres_changes', { event: '*', schema: 'public', table: 'anomalies' }, callback)?.subscribe();
  },
};

// ============================================================
// CAMPAIGN QUEUE SERVICE
// ============================================================
export const campaignQueueService = {
  async getByCampaign(campaignId) {
    const { data, error } = await supabase?.from('campaign_queue')?.select('*')?.eq('campaign_id', campaignId)?.order('scheduled_for', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getStats() {
    const { data, error } = await supabase?.from('campaign_queue')?.select('queue_status');
    if (error) throw error;
    const stats = { queued: 0, sent: 0, failed: 0, bounced: 0 };
    data?.forEach(item => {
      const key = item?.queue_status?.toLowerCase();
      if (stats?.[key] !== undefined) stats[key]++;
    });
    return stats;
  },

  subscribeToChanges(callback) {
    return supabase?.channel('campaign_queue_realtime')?.on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_queue' }, callback)?.subscribe();
  },
};

// ============================================================
// DOMAINS SERVICE
// ============================================================
export const domainsService = {
  async getAll() {
    const { data, error } = await supabase?.from('domains')?.select('*, servers(name, ip_address)')?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(d => ({
      id: d?.id,
      domainName: d?.domain_name,
      serverId: d?.server_id,
      serverName: d?.servers?.name,
      serverIp: d?.servers?.ip_address,
      status: d?.domain_status,
      healthScore: d?.health_score,
      spfStatus: d?.spf_status,
      dkimStatus: d?.dkim_status,
      dmarcStatus: d?.dmarc_status,
      dmarcPolicy: d?.dmarc_policy,
      createdAt: d?.created_at,
    })) || [];
  },
};

// ============================================================
// COSTS SERVICE
// ============================================================
export const costsService = {
  async getAll() {
    const { data, error } = await supabase?.from('costs')?.select('*')?.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(c => ({
      id: c?.id,
      serviceName: c?.service_name,
      monthlyBudget: c?.monthly_budget,
      currentSpend: c?.current_spend,
      costMonth: c?.cost_month,
      notes: c?.notes,
    })) || [];
  },
};

// ============================================================
// RETRY UTILITY
// ============================================================
export const withRetry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};
