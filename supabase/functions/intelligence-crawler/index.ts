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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'intelligence-crawler');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req?.json()?.catch(() => ({}));
    const { feedUrls = [], keywords = [] } = body;
    const results: any[] = [];

    for (const feedUrl of feedUrls?.slice(0, 5)) {
      try {
        const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
        if (!res?.ok) continue;
        const text = await res?.text();
        const titleMatches = text?.match(/<title[^>]*>([^<]+)<\/title>/gi) || [];
        const titles = titleMatches?.slice(0, 5)?.map((t: string) => t?.replace(/<[^>]+>/g, '')?.trim());
        results?.push({ url: feedUrl, titles, status: 'ok' });
      } catch (e: any) {
        results?.push({ url: feedUrl, error: e?.message, status: 'error' });
      }
    }

    await serviceSupabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'IntelligenceCrawler', message: `Crawled ${results?.length} feeds, ${results?.filter((r: any) => r?.status === 'ok')?.length} successful` });

    await logInvocation(serviceSupabase, 'intelligence-crawler', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, results, crawledAt: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'intelligence-crawler', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
