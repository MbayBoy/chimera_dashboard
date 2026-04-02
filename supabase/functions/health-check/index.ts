import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { corsHeaders, validateJWT, checkRateLimit, logInvocation } from '../_shared/middleware.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

serve(async (req) => {
  if (req?.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  let userId: string | null = null;
  let serviceSupabase: any = null;

  try {
    const auth = await validateJWT(req);
    if ('error' in auth) return auth.error;
    userId = auth.userId;
    serviceSupabase = auth.serviceSupabase;

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'health-check');
    if (rateLimitResponse) return rateLimitResponse;

    const { data: servers, error: serversError } = await serviceSupabase?.from('servers')?.select('id, name, ip_address, purpose, server_status, reputation_score, sent_today, daily_limit, blacklist_status, health_last_checked')?.order('created_at', { ascending: false });
    if (serversError) throw serversError;

    const { data: recentLogs, error: logsError } = await serviceSupabase?.from('system_logs')?.select('id, log_level, source, message, log_timestamp, server_id')?.in('log_level', ['CRITICAL', 'ERROR', 'WARN'])?.order('log_timestamp', { ascending: false })?.limit(20);
    if (logsError) throw logsError;

    const statusCounts = { Active: 0, Quarantined: 0, Warming: 0, Burnt: 0 };
    (servers || [])?.forEach((s: any) => { if (statusCounts?.[s?.server_status] !== undefined) statusCounts[s.server_status]++; });

    const activeServers = (servers || [])?.filter((s: any) => s?.server_status !== 'Burnt' && s?.server_status !== 'Provisioning');
    const avgReputation = activeServers?.length ? Math.round(activeServers?.reduce((sum: number, s: any) => sum + (s?.reputation_score || 0), 0) / activeServers?.length) : 0;

    const mappedServers = (servers || [])?.map((s: any) => ({ id: s?.id, name: s?.name, ip: s?.ip_address, purpose: s?.purpose, status: s?.server_status, reputationScore: s?.reputation_score, sentToday: s?.sent_today, dailyLimit: s?.daily_limit, blacklistCount: s?.blacklist_status?.count || 0, hasCriticalBlacklist: false }));
    const mappedAlerts = (recentLogs || [])?.map((l: any) => ({ id: l?.id, level: l?.log_level, source: l?.source, message: l?.message, timestamp: l?.log_timestamp, serverId: l?.server_id }));

    await logInvocation(serviceSupabase, 'health-check', userId, Date.now() - startTime, 'ok');

    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), servers: mappedServers, alerts: mappedAlerts, fleet: { totalServers: servers?.length || 0, statusCounts, avgReputation, totalCampaignsSentToday: (servers || []).reduce((sum: number, s: any) => sum + (s.sent_today || 0), 0), avgDeliverability: 0 } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'health-check', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
