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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'anomaly-remediate');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req?.json();
    const { anomalyId, action } = body;

    if (!anomalyId) {
      return new Response(JSON.stringify({ error: 'anomalyId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: anomaly, error: fetchError } = await serviceSupabase?.from('anomalies')?.select('*')?.eq('id', anomalyId)?.single();
    if (fetchError) throw fetchError;

    await serviceSupabase?.from('anomalies')?.update({ is_resolved: true, remediation_action: action || 'auto-remediated', resolved_at: new Date()?.toISOString() })?.eq('id', anomalyId);
    await serviceSupabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'AnomalyRemediate', message: `Anomaly ${anomalyId} remediated: ${action || 'auto-remediated'}` });

    await logInvocation(serviceSupabase, 'anomaly-remediate', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, anomalyId, action: action || 'auto-remediated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'anomaly-remediate', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
