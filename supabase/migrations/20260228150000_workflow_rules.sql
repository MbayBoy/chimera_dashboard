-- Create workflow_rules table
CREATE TABLE IF NOT EXISTS public.workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  trigger_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Users can manage their own workflow rules'
  ) THEN
    CREATE POLICY "Users can manage their own workflow rules"
      ON public.workflow_rules
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add notification_settings column to user_profiles if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN notification_settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_workflow_rules_user_id ON public.workflow_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_enabled ON public.workflow_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger_type ON public.workflow_rules(trigger_type);
