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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'verification-worker');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req?.json()?.catch(() => ({}));
    const { listId, limit = 100 } = body;

    let query = serviceSupabase?.from('contacts')?.select('id, email, contact_status')?.eq('contact_status', 'Unverified')?.limit(limit);
    if (listId) query = query?.eq('list_id', listId);

    const { data: contacts, error } = await query;
    if (error) throw error;

    let verified = 0;
    let invalid = 0;

    for (const contact of contacts || []) {
      const email = contact?.email;
      const isValid = email && email?.includes('@') && email?.split('@')?.[1]?.includes('.');
      const newStatus = isValid ? 'Active' : 'Invalid';
      await serviceSupabase?.from('contacts')?.update({ contact_status: newStatus })?.eq('id', contact?.id);
      if (isValid) verified++;
      else invalid++;
    }

    await serviceSupabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'VerificationWorker', message: `Verification job complete: ${verified} verified, ${invalid} invalid from ${contacts?.length || 0} contacts` });

    await logInvocation(serviceSupabase, 'verification-worker', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, processed: contacts?.length || 0, verified, invalid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'verification-worker', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
