-- ============================================================
-- Chimera pg_cron Setup
-- Run this in your Supabase SQL Editor to enable scheduled jobs
-- ============================================================

-- Enable pg_cron extension (requires Supabase Pro or above)
-- If you're on Free tier, the browser-based cronService.js handles scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- CRON JOB: Health Monitor (every 5 minutes)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-health-monitor') THEN
    PERFORM cron.schedule(
      'chimera-health-monitor',
      '*/5 * * * *',
      $body$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/health-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := '{}'::jsonb
      );
      $body$
    );
  END IF;
END $$;

-- ============================================================
-- CRON JOB: Campaign Dispatcher (every 1 minute)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-campaign-dispatcher') THEN
    PERFORM cron.schedule(
      'chimera-campaign-dispatcher',
      '* * * * *',
      $body$
      -- Run campaign dispatcher logic directly in DB
      UPDATE campaign_queue
      SET queue_status = 'Sent', sent_at = NOW()
      WHERE queue_status = 'Queued'
        AND scheduled_for <= NOW()
        AND id IN (
          SELECT cq.id FROM campaign_queue cq
          JOIN campaigns c ON c.id = cq.campaign_id
          WHERE cq.queue_status = 'Queued'
            AND cq.scheduled_for <= NOW()
            AND c.sent_count < COALESCE(c.daily_send_limit, 10000)
          LIMIT 50
        );
      $body$
    );
  END IF;
END $$;

-- ============================================================
-- CRON JOB: Bounce Processor (every 10 minutes)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-bounce-processor') THEN
    PERFORM cron.schedule(
      'chimera-bounce-processor',
      '*/10 * * * *',
      $body$
      -- Mark hard bounced contacts
      UPDATE contacts c
      SET contact_status = 'Bounced'
      FROM complaint_reports cr
      WHERE cr.contact_email = c.email
        AND cr.report_type = 'Hard Bounce'
        AND c.contact_status = 'Active';

      -- Mark spam complained contacts
      UPDATE contacts c
      SET contact_status = 'Complained'
      FROM complaint_reports cr
      WHERE cr.contact_email = c.email
        AND cr.report_type IN ('Spam', 'FBL')
        AND c.contact_status = 'Active';

      -- Auto-quarantine servers with policy blocks
      UPDATE servers s
      SET server_status = 'Quarantined'
      FROM complaint_reports cr
      WHERE cr.server_id = s.id
        AND cr.report_type = 'Policy Block'
        AND s.server_status = 'Active';
      $body$
    );
  END IF;
END $$;

-- ============================================================
-- CRON JOB: AI Governor (daily at 2 AM)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-ai-governor') THEN
    PERFORM cron.schedule(
      'chimera-ai-governor',
      '0 2 * * *',
      $body$
      -- Retire burnt domains (health < 20)
      UPDATE domains
      SET domain_status = 'Retired'
      WHERE health_score < 20
        AND domain_status != 'Retired';

      -- Adjust warmup for struggling domains (health 20-60)
      UPDATE domains
      SET warmup_day = GREATEST(1, warmup_day - 2)
      WHERE health_score >= 20
        AND health_score < 60
        AND warmup_day > 1
        AND domain_status = 'Active';

      -- Log AI Governor run
      INSERT INTO system_logs (log_level, source, message, log_timestamp)
      VALUES ('INFO', 'AIGovernor', 'Daily AI Governor analysis complete', NOW());
      $body$
    );
  END IF;
END $$;

-- ============================================================
-- CRON JOB: Engagement Segmenter (nightly at midnight)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chimera-engagement-segmenter') THEN
    PERFORM cron.schedule(
      'chimera-engagement-segmenter',
      '0 0 * * *',
      $body$
      -- Update engagement tiers based on open/click rates
      UPDATE contacts
      SET engagement_tier = CASE
        WHEN (COALESCE(open_rate, 0) * 0.4 + COALESCE(click_rate, 0) * 0.4 - COALESCE(bounce_count, 0) * 5 - COALESCE(complaint_count, 0) * 10) >= 80
          AND COALESCE(complaint_count, 0) = 0 THEN 'Platinum'
        WHEN (COALESCE(open_rate, 0) * 0.4 + COALESCE(click_rate, 0) * 0.4 - COALESCE(bounce_count, 0) * 5 - COALESCE(complaint_count, 0) * 10) >= 60 THEN 'Gold'
        WHEN (COALESCE(open_rate, 0) * 0.4 + COALESCE(click_rate, 0) * 0.4 - COALESCE(bounce_count, 0) * 5 - COALESCE(complaint_count, 0) * 10) >= 40 THEN 'Silver'
        WHEN (COALESCE(open_rate, 0) * 0.4 + COALESCE(click_rate, 0) * 0.4 - COALESCE(bounce_count, 0) * 5 - COALESCE(complaint_count, 0) * 10) >= 20 THEN 'Bronze'
        ELSE 'Lead'
      END;

      -- Log segmenter run
      INSERT INTO system_logs (log_level, source, message, log_timestamp)
      VALUES ('INFO', 'EngagementSegmenter', 'Nightly engagement segmentation complete', NOW());
      $body$
    );
  END IF;
END $$;

-- ============================================================
-- View current cron jobs
-- ============================================================
-- SELECT * FROM cron.job;

-- ============================================================
-- To unschedule a job:
-- SELECT cron.unschedule('chimera-health-monitor');
-- ============================================================
