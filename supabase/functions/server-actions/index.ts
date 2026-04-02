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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'server-actions');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req?.json();
    const { action, serverId, reason } = body;

    if (!serverId) {
      return new Response(JSON.stringify({ error: 'serverId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'quarantine') {
      await serviceSupabase?.from('servers')?.update({ server_status: 'Quarantined', health_last_checked: new Date()?.toISOString() })?.eq('id', serverId);
      await serviceSupabase?.from('system_logs')?.insert({ log_level: 'WARNING', source: 'ServerActions', message: `Server ${serverId} manually quarantined. Reason: ${reason || 'Manual action'}`, server_id: serverId });
      await logInvocation(serviceSupabase, 'server-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, status: 'Quarantined' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'restore') {
      await serviceSupabase?.from('servers')?.update({ server_status: 'Active', health_last_checked: new Date()?.toISOString() })?.eq('id', serverId);
      await serviceSupabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'ServerActions', message: `Server ${serverId} restored to Active status`, server_id: serverId });
      await logInvocation(serviceSupabase, 'server-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, status: 'Active' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'autopsy') {
      const { data: server } = await serviceSupabase?.from('servers')?.select('*')?.eq('id', serverId)?.single();
      const { data: logs } = await serviceSupabase?.from('system_logs')?.select('*')?.eq('server_id', serverId)?.order('log_timestamp', { ascending: false })?.limit(50);
      await logInvocation(serviceSupabase, 'server-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, server, logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logInvocation(serviceSupabase, 'server-actions', userId, Date.now() - startTime, 'error', 'Unknown action');
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'server-actions', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
