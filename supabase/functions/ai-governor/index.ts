import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, validateJWT, checkRateLimit, logInvocation } from '../_shared/middleware.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const REPUTATION = { QUARANTINE_THRESHOLD: 20, WARNING_THRESHOLD: 50, HEALTHY_THRESHOLD: 80 };

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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'ai-governor');
    if (rateLimitResponse) return rateLimitResponse;

    const results: Record<string, any> = {};

    const { data: servers } = await serviceSupabase.from("servers").select("*").in("status", ["Active", "Warming"]);
    let quarantined = 0, limitReduced = 0, limitIncreased = 0;

    if (servers) {
      for (const server of servers) {
        const rep = server.reputation_score || 100;
        if (rep < REPUTATION.QUARANTINE_THRESHOLD) {
          await serviceSupabase.from("servers").update({ status: "Quarantined", last_strategy_change: `AI Governor: Sustained low reputation (${rep})` }).eq("id", server.id);
          await serviceSupabase.from("system_logs").insert({ log_level: "CRITICAL", source: "AI_Governor", message: `Server ${server.name} quarantined: reputation ${rep}`, server_id: server.id, log_timestamp: new Date().toISOString() });
          await serviceSupabase.from("anomalies").insert({ detected_at: new Date().toISOString(), anomaly_type: "Reputation_Drop", severity: "Critical", description: `Server "${server.name}" quarantined due to reputation ${rep}`, server_id: server.id, affected_entity_id: server.id, affected_entity_type: "Server", is_resolved: false, remediation_status: "Pending", remediation_recommendation: "Investigate blacklist status and sending patterns" });
          quarantined++;
        } else if (rep < REPUTATION.WARNING_THRESHOLD) {
          const reducedLimit = Math.floor((server.daily_limit || 1000) * 0.5);
          await serviceSupabase.from("servers").update({ daily_limit: reducedLimit, last_strategy_change: `AI Governor: Reduced limit due to reputation ${rep}` }).eq("id", server.id);
          await serviceSupabase.from("system_logs").insert({ log_level: "WARN", source: "AI_Governor", message: `Server ${server.name} daily limit reduced to ${reducedLimit} (rep: ${rep})`, server_id: server.id, log_timestamp: new Date().toISOString() });
          limitReduced++;
        } else if (rep >= REPUTATION.HEALTHY_THRESHOLD && (server.daily_limit || 0) < 5000) {
          let newLimit = Math.min((server.daily_limit || 1000) + 100, 5000);
          await serviceSupabase.from("servers").update({ daily_limit: newLimit }).eq("id", server.id);
          limitIncreased++;
        }
      }
    }
    results.server_health = { quarantined, limit_reduced: limitReduced, limit_increased: limitIncreased };

    const { data: domains } = await serviceSupabase.from("domains").select("*, servers(blacklist_status, reputation_score)").eq("status", "Active");
    let domainsBurnt = 0;
    if (domains) {
      for (const domain of domains) {
        const server = (domain as any).servers;
        if (!server) continue;
        const blacklistData = typeof server.blacklist_status === "string" ? JSON.parse(server.blacklist_status || "{}") : server.blacklist_status || {};
        const criticalListings = (blacklistData.listings || []).filter((l: any) => l.isCritical);
        if (criticalListings.length > 0) {
          await serviceSupabase.from("domains").update({ status: "Burnt", health_score: 0 }).eq("id", domain.id);
          await serviceSupabase.from("system_logs").insert({ log_level: "CRITICAL", source: "AI_Governor", message: `Domain ${domain.domain_name} marked as Burnt: critical blacklist listings`, log_timestamp: new Date().toISOString() });
          domainsBurnt++;
        }
      }
    }
    results.domain_health = { domains_burnt: domainsBurnt };

    const { data: warmingServers } = await serviceSupabase.from("servers").select("*").eq("status", "Warming");
    let warmupAdvanced = 0, warmupGraduated = 0;
    if (warmingServers) {
      for (const server of warmingServers) {
        const warmupDay = (server.warmup_day || 0) + 1;
        let newLimit = server.daily_limit || 50;
        let newStatus = "Warming";
        if (warmupDay <= 7) newLimit = warmupDay * 50;
        else if (warmupDay <= 14) newLimit = 350 + (warmupDay - 7) * 100;
        else if (warmupDay <= 21) newLimit = 1050 + (warmupDay - 14) * 200;
        else { newLimit = 3000; newStatus = "Active"; }
        await serviceSupabase.from("servers").update({ warmup_day: warmupDay, daily_limit: newLimit, status: newStatus, last_strategy_change: `AI Governor: Warmup day ${warmupDay}, limit ${newLimit}` }).eq("id", server.id);
        if (newStatus === "Active") { await serviceSupabase.from("system_logs").insert({ log_level: "INFO", source: "AI_Governor", message: `Server ${server.name} graduated from warmup to Active (day ${warmupDay})`, server_id: server.id, log_timestamp: new Date().toISOString() }); warmupGraduated++; } else warmupAdvanced++;
      }
    }
    results.warmup = { advanced: warmupAdvanced, graduated: warmupGraduated };

    await logInvocation(serviceSupabase, 'ai-governor', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'ai-governor', userId, Date.now() - startTime, 'error', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
