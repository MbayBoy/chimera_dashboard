-- competitor_campaigns table for Market Intelligence Dashboard
CREATE TABLE IF NOT EXISTS public.competitor_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain TEXT NOT NULL,
  subject_line TEXT NOT NULL,
  content_preview TEXT,
  link TEXT,
  sentiment_score NUMERIC(4,3) DEFAULT 0,
  urgency_score NUMERIC(4,1) DEFAULT 0,
  campaign_type TEXT DEFAULT 'informational' CHECK (campaign_type IN ('promotional', 'informational', 'transactional', 'newsletter')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_campaigns_domain ON public.competitor_campaigns(source_domain);
CREATE INDEX IF NOT EXISTS idx_competitor_campaigns_detected ON public.competitor_campaigns(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_campaigns_type ON public.competitor_campaigns(campaign_type);

-- Add A/B test promotion columns to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ab_winner_variant TEXT,
  ADD COLUMN IF NOT EXISTS ab_test_name TEXT,
  ADD COLUMN IF NOT EXISTS ab_confidence NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ab_promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS from_name TEXT;

-- RLS
ALTER TABLE public.competitor_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitor_campaigns_select" ON public.competitor_campaigns;
CREATE POLICY "competitor_campaigns_select" ON public.competitor_campaigns
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "competitor_campaigns_insert" ON public.competitor_campaigns;
CREATE POLICY "competitor_campaigns_insert" ON public.competitor_campaigns
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
