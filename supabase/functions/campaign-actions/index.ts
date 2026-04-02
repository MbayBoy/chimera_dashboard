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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'campaign-actions');
    if (rateLimitResponse) return rateLimitResponse;

    const url = new URL(req.url);
    const pathParts = url?.pathname?.split('/');
    const campaignId = pathParts?.[pathParts?.length - 2];
    const action = pathParts?.[pathParts?.length - 1];

    if (action === 'queue') {
      const body = await req?.json()?.catch(() => ({}));
      const listId = body?.list_id;
      const { data: contacts, error: contactsError } = await serviceSupabase?.from('contacts')?.select('id')?.eq('list_id', listId)?.eq('contact_status', 'Active')?.limit(10000);
      if (contactsError) throw contactsError;
      const now = new Date()?.toISOString();
      const queueItems = (contacts || [])?.map((c: any) => ({ campaign_id: campaignId, contact_id: c?.id, scheduled_for: now, queue_status: 'Queued' }));
      if (queueItems?.length > 0) {
        const { error: insertError } = await serviceSupabase?.from('campaign_queue')?.insert(queueItems);
        if (insertError) throw insertError;
      }
      await serviceSupabase?.from('campaigns')?.update({ campaign_status: 'Running' })?.eq('id', campaignId);
      await serviceSupabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'CampaignActions', message: `Campaign ${campaignId} queued for ${queueItems?.length} contacts` });
      await logInvocation(serviceSupabase, 'campaign-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, queued: queueItems.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'pause') {
      await serviceSupabase?.from('campaigns')?.update({ campaign_status: 'Paused' })?.eq('id', campaignId);
      await serviceSupabase?.from('campaign_queue')?.update({ queue_status: 'Paused' })?.eq('campaign_id', campaignId)?.eq('queue_status', 'Queued');
      await logInvocation(serviceSupabase, 'campaign-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, status: 'Paused' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'resume') {
      await serviceSupabase?.from('campaigns')?.update({ campaign_status: 'Running' })?.eq('id', campaignId);
      await serviceSupabase?.from('campaign_queue')?.update({ queue_status: 'Queued' })?.eq('campaign_id', campaignId)?.eq('queue_status', 'Paused');
      await logInvocation(serviceSupabase, 'campaign-actions', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, status: 'Running' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logInvocation(serviceSupabase, 'campaign-actions', userId, Date.now() - startTime, 'error', 'Unknown action');
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'campaign-actions', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
