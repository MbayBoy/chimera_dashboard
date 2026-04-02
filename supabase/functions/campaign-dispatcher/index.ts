import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders, validateJWT, checkRateLimit, logInvocation } from '../_shared/middleware.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  let userId: string | null = null;
  let serviceSupabase: any = null;

  try {
    const auth = await validateJWT(req);
    if ('error' in auth) return auth.error;
    userId = auth.userId;
    serviceSupabase = auth.serviceSupabase;

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'campaign-dispatcher');
    if (rateLimitResponse) return rateLimitResponse;

    const now = new Date().toISOString();
    const { data: jobs, error } = await serviceSupabase
      .from("campaign_queue")
      .select(`id, campaign_id, contact_id, server_id, attempt_count, campaigns (id, name, subject, body_html, body_text, from_domain_id, status), contacts (id, email, total_sent), servers (id, name, ip_address, agent_port, agent_api_key, status, daily_limit, sent_today)`)
      .eq("status", "Queued")
      .lte("scheduled_for", now)
      .limit(500);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      await serviceSupabase.from("system_logs").insert({ log_level: "INFO", source: "Campaign_Dispatcher", message: "No queued jobs to process", log_timestamp: new Date().toISOString() });
      await logInvocation(serviceSupabase, 'campaign-dispatcher', userId, Date.now() - startTime, 'ok');
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No queued jobs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const jobsByServer: Record<string, typeof jobs> = {};
    jobs.forEach((job: any) => {
      const sid = job.server_id;
      if (!jobsByServer[sid]) jobsByServer[sid] = [];
      jobsByServer[sid].push(job);
    });

    let totalProcessed = 0;
    let totalFailed = 0;

    for (const [serverId, serverJobs] of Object.entries(jobsByServer)) {
      const server = (serverJobs[0] as any)?.servers;
      if (!server || server.status !== "Active") continue;
      const remaining = (server.daily_limit || 1000) - (server.sent_today || 0);
      if (remaining <= 0) continue;
      const batch = serverJobs.slice(0, Math.min(remaining, 100));

      for (const job of batch) {
        const campaign = (job as any).campaigns;
        const contact = (job as any).contacts;
        if (!campaign || !contact) continue;
        if (campaign.status === "Paused") continue;

        try {
          const { data: domain } = await serviceSupabase.from("domains").select("domain_name").eq("id", campaign.from_domain_id).single();
          const fromAddress = domain ? `noreply@${domain.domain_name}` : "noreply@chimera.io";
          const agentUrl = `http://${server.ip_address}:${server.agent_port || 8080}/send`;
          const sendResponse = await fetch(agentUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": server.agent_api_key || "" }, body: JSON.stringify({ to: contact.email, from: fromAddress, subject: campaign.subject, html: campaign.body_html, text: campaign.body_text, campaignId: campaign.id, contactId: contact.id }), signal: AbortSignal.timeout(30000) });
          if (!sendResponse.ok) throw new Error(`Agent returned ${sendResponse.status}`);
          await serviceSupabase.from("campaign_queue").update({ status: "Sent", sent_at: new Date().toISOString() }).eq("id", job.id);
          await Promise.allSettled([serviceSupabase.from("servers").update({ sent_today: (server.sent_today || 0) + 1 }).eq("id", server.id), serviceSupabase.from("contacts").update({ total_sent: (contact.total_sent || 0) + 1, ip_address_sent_last: server.ip_address }).eq("id", contact.id)]);
          totalProcessed++;
        } catch (sendErr: any) {
          const newAttempts = (job.attempt_count || 0) + 1;
          await serviceSupabase.from("campaign_queue").update({ attempt_count: newAttempts, status: newAttempts >= 3 ? "Failed" : "Queued" }).eq("id", job.id);
          totalFailed++;
        }
      }
    }

    await serviceSupabase.from("system_logs").insert({ log_level: "INFO", source: "Campaign_Dispatcher", message: `Dispatch cycle complete: ${totalProcessed} sent, ${totalFailed} failed`, log_timestamp: new Date().toISOString() });
    await logInvocation(serviceSupabase, 'campaign-dispatcher', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, processed: totalProcessed, failed: totalFailed, total_queued: jobs.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'campaign-dispatcher', userId, Date.now() - startTime, 'error', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
