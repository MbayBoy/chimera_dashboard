import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get(key: string): string | undefined } };

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthResult {
  userId: string;
  supabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
}

/**
 * Validates JWT from Authorization header and returns user id + supabase clients.
 * Returns a Response with 401 if invalid, or null if valid.
 */
export async function validateJWT(req: Request): Promise<{ error: Response } | { userId: string; supabase: SupabaseClient; serviceSupabase: SupabaseClient }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // Create user-scoped client to verify JWT
  const userSupabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    return {
      error: new Response(JSON.stringify({ error: 'Invalid or expired JWT token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const serviceSupabase = createClient(supabaseUrl, serviceKey);

  return { userId: user.id, supabase: userSupabase, serviceSupabase };
}

/**
 * Rate limiting: 100 requests per minute per user per function.
 * Returns a Response with 429 if exceeded, or null if allowed.
 */
export async function checkRateLimit(
  serviceSupabase: SupabaseClient,
  userId: string,
  functionName: string
): Promise<Response | null> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

  try {
    const { data: existing } = await serviceSupabase
      .from('edge_function_rate_limits')
      .select('id, request_count')
      .eq('user_id', userId)
      .eq('function_name', functionName)
      .eq('window_start', windowStart)
      .single();

    if (existing) {
      if (existing.request_count >= 100) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded: 100 requests per minute' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
        });
      }
      await serviceSupabase
        .from('edge_function_rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('id', existing.id);
    } else {
      await serviceSupabase
        .from('edge_function_rate_limits')
        .insert({ user_id: userId, function_name: functionName, request_count: 1, window_start: windowStart });
    }
  } catch (_e) {
    // Non-blocking: if rate limit table fails, allow request
  }

  return null;
}

/**
 * Logs edge function invocation to edge_function_logs table.
 */
export async function logInvocation(
  serviceSupabase: SupabaseClient,
  functionName: string,
  userId: string | null,
  executionTimeMs: number,
  status: 'ok' | 'error',
  errorMessage?: string
): Promise<void> {
  try {
    await serviceSupabase.from('edge_function_logs').insert({
      function_name: functionName,
      user_id: userId,
      execution_time_ms: executionTimeMs,
      status,
      error_message: errorMessage || null,
      created_at: new Date().toISOString(),
    });
  } catch (_e) {
    // Non-blocking
  }
}
