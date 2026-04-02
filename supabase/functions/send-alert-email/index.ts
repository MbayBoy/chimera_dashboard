import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { corsHeaders, validateJWT, checkRateLimit, logInvocation } from '../_shared/middleware.ts';

declare const Deno: any;

const RESEND_API_KEY = Deno?.env?.get('RESEND_API_KEY') || 're_HxdTktTu_AqzGCUohsrr17S8LWLvfoBAk';

serve(async (req) => {
  if (req?.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });

  const startTime = Date.now();
  let userId: string | null = null;
  let serviceSupabase: any = null;

  try {
    const auth = await validateJWT(req);
    if ('error' in auth) return auth.error;
    userId = auth.userId;
    serviceSupabase = auth.serviceSupabase;

    const rateLimitResponse = await checkRateLimit(serviceSupabase, userId, 'send-alert-email');
    if (rateLimitResponse) return rateLimitResponse;

    const { to, subject, message, severity, source, timestamp } = await req?.json();
    if (!to || !subject) throw new Error("Missing required fields: to, subject");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const severityColor = severity === "CRITICAL" || severity === "Critical" ? "#ef4444" : severity === "ERROR" || severity === "High" ? "#f97316" : "#f59e0b";
    const htmlBody = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;"><div style="background: ${severityColor}; padding: 20px 24px;"><h1 style="margin: 0; font-size: 20px; color: white;">🚨 Chimera Alert: ${severity}</h1><p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${source || 'System'}</p></div><div style="padding: 24px;"><div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px;"><p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">${message}</p></div><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><tr><td style="padding: 6px 0; color: #64748b;">Severity</td><td style="color: ${severityColor}; font-weight: bold;">${severity}</td></tr><tr><td style="padding: 6px 0; color: #64748b;">Source</td><td style="color: #e2e8f0;">${source || '—'}</td></tr><tr><td style="padding: 6px 0; color: #64748b;">Timestamp</td><td style="color: #e2e8f0;">${timestamp ? new Date(timestamp)?.toLocaleString() : new Date()?.toLocaleString()}</td></tr></table></div><div style="padding: 16px 24px; background: #1e293b; text-align: center;"><p style="margin: 0; font-size: 12px; color: #475569;">Chimera Email Intelligence Platform — Automated Alert System</p></div></div>`;

    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "alerts@leadsconsult.co.za", to: [to], subject, html: htmlBody }) });
    const result = await response?.json();
    if (!response?.ok) throw new Error(result?.message || "Resend API error");

    await logInvocation(serviceSupabase, 'send-alert-email', userId, Date.now() - startTime, 'ok');
    return new Response(JSON.stringify({ success: true, id: result?.id }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error: any) {
    if (serviceSupabase) await logInvocation(serviceSupabase, 'send-alert-email', userId, Date.now() - startTime, 'error', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
