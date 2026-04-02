-- Incidents table for Incident Response screen
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('P1', 'P2', 'P3', 'P4')),
  status TEXT NOT NULL DEFAULT 'Detected' CHECK (status IN ('Detected', 'Investigating', 'Mitigating', 'Resolved')),
  affected_components TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  assigned_team TEXT,
  runbook_id TEXT,
  timeline JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalation_count INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'incidents_select'
  ) THEN
    CREATE POLICY incidents_select ON public.incidents FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'incidents_insert'
  ) THEN
    CREATE POLICY incidents_insert ON public.incidents FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'incidents_update'
  ) THEN
    CREATE POLICY incidents_update ON public.incidents FOR UPDATE USING (true);
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_incidents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_updated_at ON public.incidents;
CREATE TRIGGER incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_incidents_updated_at();
