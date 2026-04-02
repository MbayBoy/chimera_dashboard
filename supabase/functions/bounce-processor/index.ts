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

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'bounce-processor');
    if (rateLimitResponse) return rateLimitResponse;

    const results: Record<string, any> = {};

    const { data: bounces, error: bounceError } = await serviceSupabase.from("bounces").select("id, contact_id, server_id, bounce_type, smtp_code, reason, created_at").eq("processed", false).limit(200);

    if (!bounceError && bounces && bounces.length > 0) {
      let hardBounces = 0, softBounces = 0, complaints = 0;
      for (const bounce of bounces) {
        const isHardBounce = bounce.bounce_type === "Hard" || (bounce.smtp_code && String(bounce.smtp_code).startsWith("5"));
        const isComplaint = bounce.bounce_type === "Complaint" || (bounce.reason && bounce.reason.toLowerCase().includes("spam"));
        if (isComplaint) {
          await serviceSupabase.from("contacts").update({ status: "Complained" }).eq("id", bounce.contact_id);
          if (bounce.server_id) {
            const { data: server } = await serviceSupabase.from("servers").select("id, name, sent_today").eq("id", bounce.server_id).single();
            if (server) {
              await serviceSupabase.from("servers").update({ status: "Quarantined", last_strategy_change: `Bounce Processor: Policy block / complaint detected` }).eq("id", server.id);
              await serviceSupabase.from("system_logs").insert({ log_level: "CRITICAL", source: "Bounce_Processor", message: `Server ${server.name} quarantined: complaint/policy block`, server_id: server.id, log_timestamp: new Date().toISOString() });
            }
          }
          complaints++;
        } else if (isHardBounce) {
          const { data: contact } = await serviceSupabase.from("contacts").select("id, bounce_count").eq("id", bounce.contact_id).single();
          if (contact) await serviceSupabase.from("contacts").update({ status: "Bounced", bounce_count: (contact.bounce_count || 0) + 1 }).eq("id", contact.id);
          hardBounces++;
        } else {
          const { data: contact } = await serviceSupabase.from("contacts").select("id, bounce_count, status").eq("id", bounce.contact_id).single();
          if (contact) { const newCount = (contact.bounce_count || 0) + 1; await serviceSupabase.from("contacts").update({ bounce_count: newCount, status: newCount >= 3 ? "Bounced" : contact.status }).eq("id", contact.id); }
          softBounces++;
        }
        await serviceSupabase.from("bounces").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", bounce.id);
      }
      results.bounces = { hard: hardBounces, soft: softBounces, complaints };
    } else {
      results.bounces = { hard: 0, soft: 0, complaints: 0, note: "No unprocessed bounces" };
    }

    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 15) {
      const { error: resetError } = await serviceSupabase.from("servers").update({ sent_today: 0 }).neq("status", "Burnt");
      results.daily_reset = resetError ? "failed" : "completed";
      await serviceSupabase.from("system_logs").insert({ log_level: "INFO", source: "Bounce_Processor", message: "Daily sent counters reset", log_timestamp: new Date().toISOString() });
    } else {
      results.daily_reset = "skipped (not midnight window)";
    }

    const { data: campaigns } = await serviceSupabase.from("campaigns").select("id, name, sent_count, bounce_count").eq("status", "Running");
    let anomaliesCreated = 0;
    if (campaigns) {
      for (const campaign of campaigns) {
        if (!campaign.sent_count || campaign.sent_count < 100) continue;
        const bounceRate = (campaign.bounce_count || 0) / campaign.sent_count;
        if (bounceRate > 0.05) {
          const { data: existing } = await serviceSupabase.from("anomalies").select("id").eq("affected_entity_id", campaign.id).eq("anomaly_type", "Bounce_Spike").eq("is_resolved", false).limit(1);
          if (!existing || existing.length === 0) {
            await serviceSupabase.from("anomalies").insert({ detected_at: new Date().toISOString(), anomaly_type: "Bounce_Spike", severity: bounceRate > 0.1 ? "Critical" : "High", description: `Campaign "${campaign.name}" has ${(bounceRate * 100).toFixed(1)}% bounce rate`, affected_entity_id: campaign.id, affected_entity_type: "Campaign", is_resolved: false, remediation_status: "Pending", remediation_recommendation: "Pause campaign and clean contact list" });
            anomaliesCreated++;
          }
        }
      }
    }
    results.anomalies_created = anomaliesCreated;
    await serviceSupabase.from("system_logs").insert({ log_level: "INFO", source: "Bounce_Processor", message: `Bounce processing cycle completed. Anomalies created: ${anomaliesCreated}`, log_timestamp: new Date().toISOString() });

    await logInvocation(serviceSupabase, 'bounce-processor', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'bounce-processor', userId, Date.now() - startTime, 'error', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
