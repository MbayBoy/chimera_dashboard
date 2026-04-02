-- Chimera v5.0 Complete Database Schema
-- Migration: 20260225212650_chimera_schema.sql

-- ============================================================
-- STEP 1: ENUM TYPES
-- ============================================================
DROP TYPE IF EXISTS public.server_status CASCADE;
CREATE TYPE public.server_status AS ENUM ('Provisioning', 'Warming', 'Active', 'Quarantined', 'Burnt', 'HotSpare', 'Warning');

DROP TYPE IF EXISTS public.server_purpose CASCADE;
CREATE TYPE public.server_purpose AS ENUM ('Production', 'Canary', 'Sanitizer', 'HotSpare', 'Verifier');

DROP TYPE IF EXISTS public.domain_status CASCADE;
CREATE TYPE public.domain_status AS ENUM ('Active', 'Warming', 'Burnt');

DROP TYPE IF EXISTS public.dns_status CASCADE;
CREATE TYPE public.dns_status AS ENUM ('Valid', 'Invalid', 'Missing');

DROP TYPE IF EXISTS public.dmarc_policy CASCADE;
CREATE TYPE public.dmarc_policy AS ENUM ('none', 'quarantine', 'reject');

DROP TYPE IF EXISTS public.contact_status CASCADE;
CREATE TYPE public.contact_status AS ENUM ('Active', 'Bounced', 'Unsubscribed', 'Complained', 'Zombie');

DROP TYPE IF EXISTS public.contact_tier CASCADE;
CREATE TYPE public.contact_tier AS ENUM ('Platinum', 'Gold', 'Silver', 'Bronze', 'Lead');

DROP TYPE IF EXISTS public.verification_verdict CASCADE;
CREATE TYPE public.verification_verdict AS ENUM ('Deliverable_High_Conf', 'Deliverable_Low_Conf', 'Undeliverable', 'Unknown_Greylisted', 'Invalid_Syntax');

DROP TYPE IF EXISTS public.list_status CASCADE;
CREATE TYPE public.list_status AS ENUM ('Active', 'Building');

DROP TYPE IF EXISTS public.campaign_status CASCADE;
CREATE TYPE public.campaign_status AS ENUM ('Draft', 'Scheduled', 'Running', 'Paused', 'Completed');

DROP TYPE IF EXISTS public.risk_profile CASCADE;
CREATE TYPE public.risk_profile AS ENUM ('Low', 'Medium', 'High');

DROP TYPE IF EXISTS public.canary_status CASCADE;
CREATE TYPE public.canary_status AS ENUM ('Not_Run', 'Passed', 'Failed');

DROP TYPE IF EXISTS public.queue_status CASCADE;
CREATE TYPE public.queue_status AS ENUM ('Queued', 'Sent', 'Failed', 'Bounced');

DROP TYPE IF EXISTS public.job_status CASCADE;
CREATE TYPE public.job_status AS ENUM ('Queued', 'Running', 'Completed', 'Failed');

DROP TYPE IF EXISTS public.log_level CASCADE;
CREATE TYPE public.log_level AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');

DROP TYPE IF EXISTS public.report_type CASCADE;
CREATE TYPE public.report_type AS ENUM ('FBL', 'DMARC', 'Manual');

-- ============================================================
-- STEP 2: CORE TABLES
-- ============================================================

-- User Profiles (auth intermediary)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Servers
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT UNIQUE NOT NULL,
  hostname TEXT NOT NULL,
  agent_api_key TEXT,
  agent_port INT DEFAULT 8080,
  server_status public.server_status DEFAULT 'Provisioning',
  purpose public.server_purpose DEFAULT 'Production',
  reputation_score DECIMAL(5,2) DEFAULT 100.00,
  daily_limit INT NOT NULL DEFAULT 50000,
  sent_today INT DEFAULT 0,
  health_last_checked TIMESTAMPTZ,
  blacklist_status JSONB DEFAULT '{}',
  last_strategy_change TEXT,
  warmup_day INT DEFAULT 0,
  region TEXT DEFAULT 'US-East',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Domains
CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT UNIQUE NOT NULL,
  server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  domain_status public.domain_status DEFAULT 'Warming',
  purpose public.server_purpose DEFAULT 'Production',
  health_score DECIMAL(5,2) DEFAULT 100.00,
  spf_record TEXT,
  spf_status public.dns_status DEFAULT 'Missing',
  dkim_selector TEXT,
  dkim_public_key TEXT,
  dkim_status public.dns_status DEFAULT 'Missing',
  dmarc_policy public.dmarc_policy DEFAULT 'none',
  dmarc_record TEXT,
  dmarc_status public.dns_status DEFAULT 'Missing',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Contact Lists
CREATE TABLE IF NOT EXISTS public.contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  list_status public.list_status DEFAULT 'Building',
  average_engagement_score DECIMAL(5,2) DEFAULT 0.00,
  platinum_count INT DEFAULT 0,
  gold_count INT DEFAULT 0,
  silver_count INT DEFAULT 0,
  bronze_count INT DEFAULT 0,
  lead_count INT DEFAULT 0,
  total_contacts INT DEFAULT 0,
  predicted_ltv DECIMAL(12,2) DEFAULT 0.00,
  churn_risk_score DECIMAL(5,2) DEFAULT 0.00,
  high_risk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  contact_status public.contact_status DEFAULT 'Active',
  tier public.contact_tier DEFAULT 'Lead',
  engagement_score DECIMAL(5,2) DEFAULT 0.00,
  last_open_date TIMESTAMPTZ,
  last_click_date TIMESTAMPTZ,
  bounce_count INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  ip_address_sent_last TEXT,
  verification_id TEXT,
  verification_verdict public.verification_verdict,
  verification_score DECIMAL(3,2),
  last_verified TIMESTAMPTZ,
  predicted_ltv DECIMAL(10,2) DEFAULT 0.00,
  churn_probability DECIMAL(3,2) DEFAULT 0.00,
  optimal_send_time_hour INT DEFAULT 9,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  from_domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
  assigned_server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  campaign_status public.campaign_status DEFAULT 'Draft',
  risk_profile public.risk_profile,
  risk_score DECIMAL(5,2) DEFAULT 0.00,
  content_score DECIMAL(5,2) DEFAULT 0.00,
  predicted_inbox_rate DECIMAL(5,2) DEFAULT 0.00,
  campaign_canary_status public.canary_status DEFAULT 'Not_Run',
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  complaint_count INT DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Queue
CREATE TABLE IF NOT EXISTS public.campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  queue_status public.queue_status DEFAULT 'Queued',
  attempt_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Verification Jobs
CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  job_status public.job_status DEFAULT 'Queued',
  total_to_verify INT DEFAULT 0,
  verified_count INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  options JSONB DEFAULT '{}',
  results_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- System Logs
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  log_level public.log_level DEFAULT 'INFO',
  source TEXT,
  message TEXT,
  server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  related_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL
);

-- Complaint Reports
CREATE TABLE IF NOT EXISTS public.complaint_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  contact_email TEXT NOT NULL,
  source_isp TEXT,
  report_type public.report_type DEFAULT 'FBL',
  raw_report TEXT,
  server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  product_id TEXT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL
);

-- Costs
CREATE TABLE IF NOT EXISTS public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  monthly_budget DECIMAL(10,2) DEFAULT 0.00,
  current_spend DECIMAL(10,2) DEFAULT 0.00,
  cost_month TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Anomaly Detection
CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium',
  title TEXT NOT NULL,
  description TEXT,
  affected_entity TEXT,
  metric_value DECIMAL(10,2),
  baseline_value DECIMAL(10,2),
  deviation_percent DECIMAL(5,2),
  is_resolved BOOLEAN DEFAULT false,
  remediation_action TEXT,
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_servers_status ON public.servers(server_status);
CREATE INDEX IF NOT EXISTS idx_servers_purpose ON public.servers(purpose);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON public.contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(contact_status);
CREATE INDEX IF NOT EXISTS idx_contacts_tier ON public.contacts(tier);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(campaign_status);
CREATE INDEX IF NOT EXISTS idx_campaign_queue_status ON public.campaign_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_campaign_queue_scheduled ON public.campaign_queue(scheduled_for, queue_status);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(log_timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON public.system_logs(source);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON public.anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON public.anomalies(is_resolved);

-- ============================================================
-- STEP 4: FUNCTIONS
-- ============================================================

-- Handle new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 5: ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: RLS POLICIES
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "users_manage_own_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- servers - authenticated users can read/write all
DROP POLICY IF EXISTS "authenticated_manage_servers" ON public.servers;
CREATE POLICY "authenticated_manage_servers" ON public.servers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- domains
DROP POLICY IF EXISTS "authenticated_manage_domains" ON public.domains;
CREATE POLICY "authenticated_manage_domains" ON public.domains
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_lists
DROP POLICY IF EXISTS "authenticated_manage_contact_lists" ON public.contact_lists;
CREATE POLICY "authenticated_manage_contact_lists" ON public.contact_lists
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contacts
DROP POLICY IF EXISTS "authenticated_manage_contacts" ON public.contacts;
CREATE POLICY "authenticated_manage_contacts" ON public.contacts
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaigns
DROP POLICY IF EXISTS "authenticated_manage_campaigns" ON public.campaigns;
CREATE POLICY "authenticated_manage_campaigns" ON public.campaigns
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaign_queue
DROP POLICY IF EXISTS "authenticated_manage_campaign_queue" ON public.campaign_queue;
CREATE POLICY "authenticated_manage_campaign_queue" ON public.campaign_queue
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- verification_jobs
DROP POLICY IF EXISTS "authenticated_manage_verification_jobs" ON public.verification_jobs;
CREATE POLICY "authenticated_manage_verification_jobs" ON public.verification_jobs
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- system_logs
DROP POLICY IF EXISTS "authenticated_manage_system_logs" ON public.system_logs;
CREATE POLICY "authenticated_manage_system_logs" ON public.system_logs
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- complaint_reports
DROP POLICY IF EXISTS "authenticated_manage_complaint_reports" ON public.complaint_reports;
CREATE POLICY "authenticated_manage_complaint_reports" ON public.complaint_reports
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- transactions
DROP POLICY IF EXISTS "authenticated_manage_transactions" ON public.transactions;
CREATE POLICY "authenticated_manage_transactions" ON public.transactions
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- costs
DROP POLICY IF EXISTS "authenticated_manage_costs" ON public.costs;
CREATE POLICY "authenticated_manage_costs" ON public.costs
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anomalies
DROP POLICY IF EXISTS "authenticated_manage_anomalies" ON public.anomalies;
CREATE POLICY "authenticated_manage_anomalies" ON public.anomalies
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 7: TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_servers_updated_at ON public.servers;
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_contact_lists_updated_at ON public.contact_lists;
CREATE TRIGGER update_contact_lists_updated_at
  BEFORE UPDATE ON public.contact_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- STEP 8: MOCK DATA
-- ============================================================
DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  server1_id UUID := gen_random_uuid();
  server2_id UUID := gen_random_uuid();
  server3_id UUID := gen_random_uuid();
  server4_id UUID := gen_random_uuid();
  server5_id UUID := gen_random_uuid();
  domain1_id UUID := gen_random_uuid();
  domain2_id UUID := gen_random_uuid();
  list1_id UUID := gen_random_uuid();
  list2_id UUID := gen_random_uuid();
  campaign1_id UUID := gen_random_uuid();
  campaign2_id UUID := gen_random_uuid();
BEGIN
  -- Auth user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@chimera.io', crypt('chimera2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Chimera Admin', 'role', 'admin'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

  -- Servers
  INSERT INTO public.servers (id, name, ip_address, hostname, server_status, purpose, reputation_score, daily_limit, sent_today, warmup_day, region)
  VALUES
    (server1_id, 'Production Mail Server 01', '192.168.1.101', 'mail1.chimera.io', 'Active', 'Production', 95.00, 50000, 45230, 0, 'US-East'),
    (server2_id, 'Production Mail Server 02', '192.168.1.102', 'mail2.chimera.io', 'Active', 'Production', 92.00, 50000, 38750, 0, 'US-West'),
    (server3_id, 'Canary Server 01', '192.168.1.201', 'canary1.chimera.io', 'Active', 'Canary', 65.00, 25000, 15200, 12, 'US-East'),
    (server4_id, 'Sanitizer Server 01', '192.168.1.301', 'sanitize1.chimera.io', 'Active', 'Sanitizer', 52.00, 10000, 5400, 0, 'US-East'),
    (server5_id, 'Verifier Server 01', '192.168.1.501', 'verify1.chimera.io', 'Active', 'Verifier', 90.00, 5000, 2100, 0, 'US-East')
  ON CONFLICT (ip_address) DO NOTHING;

  -- Domains
  INSERT INTO public.domains (id, domain_name, server_id, domain_status, spf_status, dkim_status, dmarc_status, health_score)
  VALUES
    (domain1_id, 'mail.chimera.io', server1_id, 'Active', 'Valid', 'Valid', 'Valid', 98.00),
    (domain2_id, 'news1.chimera.io', server2_id, 'Active', 'Valid', 'Invalid', 'Valid', 72.00)
  ON CONFLICT (domain_name) DO NOTHING;

  -- Contact Lists
  INSERT INTO public.contact_lists (id, name, list_status, total_contacts, platinum_count, gold_count, silver_count, bronze_count, lead_count, average_engagement_score, predicted_ltv, churn_risk_score)
  VALUES
    (list1_id, 'Golden Subscribers Q1 2026', 'Active', 45230, 8920, 15420, 12340, 6780, 1770, 78.4, 2400000.00, 3.2),
    (list2_id, 'Win-Back Campaign List', 'Building', 12450, 450, 1200, 3400, 4800, 2600, 42.1, 380000.00, 18.5)
  ON CONFLICT (id) DO NOTHING;

  -- Campaigns
  INSERT INTO public.campaigns (id, name, subject, campaign_status, risk_profile, risk_score, content_score, sent_count, delivered_count, open_count, click_count, total_recipients, campaign_canary_status)
  VALUES
    (campaign1_id, 'Spring Product Launch 2026', 'Introducing Our Revolutionary New Product Line', 'Running', 'Low', 15.00, 8.70, 45230, 44687, 10987, 2341, 50000, 'Passed'),
    (campaign2_id, 'Customer Re-engagement Campaign', 'We Miss You! Here''s 20% Off Your Next Purchase', 'Scheduled', 'Medium', 52.00, 6.20, 0, 0, 0, 0, 12450, 'Not_Run')
  ON CONFLICT (id) DO NOTHING;

  -- System Logs
  INSERT INTO public.system_logs (log_level, source, message, log_timestamp)
  VALUES
    ('CRITICAL', 'Health_Monitor', 'Server srv-canary-01 quarantined: Policy block from Gmail', now() - interval '1 minute'),
    ('WARN', 'Canary_Simulator', 'Campaign Flash Sale failed canary test. Complaint rate: 0.15%', now() - interval '5 minutes'),
    ('INFO', 'AI_Governor', 'Daily limit adjusted from 45000 to 50000 for srv-prod-01', now() - interval '10 minutes'),
    ('INFO', 'STO_Workflow', 'Send time optimization completed for 12450 contacts', now() - interval '15 minutes'),
    ('WARN', 'Anomaly_Detector', 'Platinum list open rate dropped 20% - CRITICAL alert triggered', now() - interval '20 minutes'),
    ('INFO', 'DNS_Healer', 'DKIM mismatch detected for news1.com - new keys generated and DNS updated', now() - interval '25 minutes'),
    ('INFO', 'AB_Engine', 'A/B test winner found: Subject variant C with 5.2% higher open rate', now() - interval '30 minutes'),
    ('WARN', 'Budget_Monitor', 'MXToolbox API cost 15% over projection - cheaper alternative suggested', now() - interval '35 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Anomalies
  INSERT INTO public.anomalies (anomaly_type, severity, title, description, affected_entity, metric_value, baseline_value, deviation_percent, is_resolved)
  VALUES
    ('engagement_drop', 'Critical', 'Platinum List Open Rate Drop', 'Open rate dropped 20% vs 7-day average on Platinum tier', 'Platinum List', 18.4, 24.3, -24.3, false),
    ('bounce_spike', 'High', 'Bounce Rate Spike on srv-prod-03', 'Bounce rate increased 340% above baseline', 'srv-prod-03', 4.2, 0.95, 342.1, false),
    ('reputation_change', 'Medium', 'Reputation Score Decline', 'srv-canary-01 reputation dropped 15 points in 24h', 'srv-canary-01', 65.0, 80.0, -18.75, false),
    ('cost_overrun', 'Low', 'MXToolbox API Cost Overrun', 'Monthly API spend 15% over budget projection', 'MXToolbox API', 345.00, 300.00, 15.0, false)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
