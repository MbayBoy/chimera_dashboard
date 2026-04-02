-- ============================================================
-- Edge Function Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  request_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_function_logs_function_name ON public.edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at ON public.edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_user_id ON public.edge_function_logs(user_id);

-- ============================================================
-- Edge Function Rate Limits Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, function_name, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_fn ON public.edge_function_rate_limits(user_id, function_name, window_start);

-- ============================================================
-- RLS: edge_function_logs
-- ============================================================
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edge_function_logs' AND policyname = 'authenticated_read_logs'
  ) THEN
    CREATE POLICY authenticated_read_logs ON public.edge_function_logs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edge_function_logs' AND policyname = 'service_insert_logs'
  ) THEN
    CREATE POLICY service_insert_logs ON public.edge_function_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: edge_function_rate_limits
-- ============================================================
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edge_function_rate_limits' AND policyname = 'service_manage_rate_limits'
  ) THEN
    CREATE POLICY service_manage_rate_limits ON public.edge_function_rate_limits
      FOR ALL WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: servers — authenticated users can access all servers
-- (servers table has no user_id column)
-- ============================================================
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'servers' AND policyname = 'users_own_servers'
  ) THEN
    CREATE POLICY users_own_servers ON public.servers
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: campaigns — authenticated users can access all campaigns
-- (campaigns table has no user_id column)
-- ============================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'users_own_campaigns'
  ) THEN
    CREATE POLICY users_own_campaigns ON public.campaigns
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: contacts — authenticated users can access all contacts
-- (contacts table has no user_id column)
-- ============================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'users_own_contacts'
  ) THEN
    CREATE POLICY users_own_contacts ON public.contacts
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: contact_lists — authenticated users can access all lists
-- (contact_lists table has no user_id column)
-- ============================================================
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_lists' AND policyname = 'users_own_contact_lists'
  ) THEN
    CREATE POLICY users_own_contact_lists ON public.contact_lists
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: system_logs — authenticated read, service write
-- ============================================================
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'authenticated_read_system_logs'
  ) THEN
    CREATE POLICY authenticated_read_system_logs ON public.system_logs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'service_insert_system_logs'
  ) THEN
    CREATE POLICY service_insert_system_logs ON public.system_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: anomalies
-- ============================================================
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anomalies' AND policyname = 'authenticated_read_anomalies'
  ) THEN
    CREATE POLICY authenticated_read_anomalies ON public.anomalies
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anomalies' AND policyname = 'service_manage_anomalies'
  ) THEN
    CREATE POLICY service_manage_anomalies ON public.anomalies
      FOR ALL WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RLS: campaign_queue
-- ============================================================
ALTER TABLE public.campaign_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'campaign_queue' AND policyname = 'service_manage_campaign_queue'
  ) THEN
    CREATE POLICY service_manage_campaign_queue ON public.campaign_queue
      FOR ALL WITH CHECK (true);
  END IF;
END $$;
