-- ============================================================
-- Uptime Alerts & Threshold Rules Schema
-- ============================================================

-- Function alert tracking table (prevents duplicate alerts)
CREATE TABLE IF NOT EXISTS public.function_alert_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL UNIQUE,
  last_error_rate numeric DEFAULT 0,
  last_avg_execution_ms numeric DEFAULT 0,
  alert_sent_at timestamptz,
  alert_type text, -- 'error_rate' | 'execution_time' | 'unreachable'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User-customizable threshold rules
CREATE TABLE IF NOT EXISTS public.user_threshold_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('error_rate', 'execution_time_ms')),
  warning_threshold numeric NOT NULL,
  critical_threshold numeric NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, function_name, metric)
);

-- Uptime snapshots for 24h graphs
CREATE TABLE IF NOT EXISTS public.uptime_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_hour timestamptz NOT NULL,
  service_name text NOT NULL, -- 'supabase_api' | 'database' | 'realtime' | function name
  response_time_ms numeric,
  availability_pct numeric DEFAULT 100,
  request_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(snapshot_hour, service_name)
);

-- RLS Policies
ALTER TABLE public.function_alert_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_threshold_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_snapshots ENABLE ROW LEVEL SECURITY;

-- function_alert_state: service role only (managed by edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'function_alert_state' AND policyname = 'Service role manages alert state'
  ) THEN
    CREATE POLICY "Service role manages alert state" ON public.function_alert_state
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- user_threshold_rules: users manage their own rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_threshold_rules' AND policyname = 'Users manage own threshold rules'
  ) THEN
    CREATE POLICY "Users manage own threshold rules" ON public.user_threshold_rules
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- uptime_snapshots: authenticated users can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'uptime_snapshots' AND policyname = 'Authenticated users read uptime snapshots'
  ) THEN
    CREATE POLICY "Authenticated users read uptime snapshots" ON public.uptime_snapshots
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'uptime_snapshots' AND policyname = 'Service role inserts uptime snapshots'
  ) THEN
    CREATE POLICY "Service role inserts uptime snapshots" ON public.uptime_snapshots
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_uptime_snapshots_hour ON public.uptime_snapshots(snapshot_hour DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_snapshots_service ON public.uptime_snapshots(service_name);
CREATE INDEX IF NOT EXISTS idx_function_alert_state_fn ON public.function_alert_state(function_name);
CREATE INDEX IF NOT EXISTS idx_user_threshold_rules_user ON public.user_threshold_rules(user_id);

-- ============================================================
-- pg_cron: monitor-alerts job (every 5 minutes)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-monitor-alerts') THEN
    PERFORM cron.schedule(
      'chimera-monitor-alerts',
      '*/5 * * * *',
      $cron$
      DO $body$
      DECLARE
        fn_rec RECORD;
        err_rate numeric;
        avg_exec numeric;
        alert_state RECORD;
        cooldown_minutes integer := 30;
        window_minutes integer := 15;
        threshold_error_rate numeric := 5.0;
        alert_email text := current_setting('app.alert_email', true);
      BEGIN
        -- Loop through each function and check metrics in last 15 minutes
        FOR fn_rec IN
          SELECT
            function_name,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'error') AS errors,
            AVG(execution_time_ms) AS avg_ms
          FROM public.edge_function_logs
          WHERE created_at >= NOW() - (window_minutes || ' minutes')::interval
          GROUP BY function_name
        LOOP
          err_rate := CASE WHEN fn_rec.total > 0 THEN (fn_rec.errors::numeric / fn_rec.total) * 100 ELSE 0 END;
          avg_exec := COALESCE(fn_rec.avg_ms, 0);

          -- Get or create alert state for this function
          SELECT * INTO alert_state FROM public.function_alert_state WHERE function_name = fn_rec.function_name;

          IF NOT FOUND THEN
            INSERT INTO public.function_alert_state (function_name, last_error_rate, last_avg_execution_ms)
            VALUES (fn_rec.function_name, err_rate, avg_exec);
            CONTINUE;
          END IF;

          -- Check if cooldown has passed (30 minutes)
          IF alert_state.alert_sent_at IS NOT NULL AND
             NOW() - alert_state.alert_sent_at < (cooldown_minutes || ' minutes')::interval THEN
            -- Still in cooldown, update metrics but don't alert
            UPDATE public.function_alert_state
            SET last_error_rate = err_rate, last_avg_execution_ms = avg_exec, updated_at = NOW()
            WHERE function_name = fn_rec.function_name;
            CONTINUE;
          END IF;

          -- Check error rate threshold
          IF err_rate > threshold_error_rate THEN
            -- Log alert trigger
            INSERT INTO public.system_logs (log_level, source, message, log_timestamp)
            VALUES (
              'CRITICAL',
              'MonitorAlerts',
              format('Function %s error rate %.1f%% exceeds threshold %.1f%% (last %s min, %s/%s errors)',
                fn_rec.function_name, err_rate, threshold_error_rate, window_minutes, fn_rec.errors, fn_rec.total),
              NOW()
            );

            -- Update alert state
            UPDATE public.function_alert_state
            SET last_error_rate = err_rate,
                last_avg_execution_ms = avg_exec,
                alert_sent_at = NOW(),
                alert_type = 'error_rate',
                updated_at = NOW()
            WHERE function_name = fn_rec.function_name;
          ELSE
            -- No alert needed, just update metrics
            UPDATE public.function_alert_state
            SET last_error_rate = err_rate, last_avg_execution_ms = avg_exec, updated_at = NOW()
            WHERE function_name = fn_rec.function_name;
          END IF;
        END LOOP;

        -- Log monitor run
        INSERT INTO public.system_logs (log_level, source, message, log_timestamp)
        VALUES ('INFO', 'MonitorAlerts', 'Monitor alerts check completed', NOW());
      END;
      $body$ LANGUAGE plpgsql;
      $cron$
    );
  END IF;
END $$;

-- ============================================================
-- pg_cron: uptime snapshot collector (every hour)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-uptime-snapshots') THEN
    PERFORM cron.schedule(
      'chimera-uptime-snapshots',
      '0 * * * *',
      $cron$
      INSERT INTO public.uptime_snapshots (snapshot_hour, service_name, response_time_ms, availability_pct, request_count, error_count)
      SELECT
        date_trunc('hour', NOW()) AS snapshot_hour,
        function_name AS service_name,
        AVG(execution_time_ms) AS response_time_ms,
        CASE WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE status != 'error')::numeric / COUNT(*)) * 100
        ELSE 100 END AS availability_pct,
        COUNT(*) AS request_count,
        COUNT(*) FILTER (WHERE status = 'error') AS error_count
      FROM public.edge_function_logs
      WHERE created_at >= date_trunc('hour', NOW()) - interval '1 hour'
        AND created_at < date_trunc('hour', NOW())
      GROUP BY function_name
      ON CONFLICT (snapshot_hour, service_name) DO UPDATE
        SET response_time_ms = EXCLUDED.response_time_ms,
            availability_pct = EXCLUDED.availability_pct,
            request_count = EXCLUDED.request_count,
            error_count = EXCLUDED.error_count;
      $cron$
    );
  END IF;
END $$;
