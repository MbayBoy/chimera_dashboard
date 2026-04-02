const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyEmail } = require('../services/emailVerifier');
const logger = require('../utils/logger');

router?.use(authenticateToken);

// POST /api/verification/start
router?.post('/start', asyncHandler(async (req, res) => {
  const { list_id, options = {} } = req?.body;
  if (!list_id) return res?.status(400)?.json({ error: 'list_id is required' });

  const { count } = await supabase?.from('contacts')?.select('*', { count: 'exact', head: true })?.eq('list_id', list_id)?.eq('status', 'Active');

  const { data, error } = await supabase?.from('verification_jobs')?.insert({
    list_id,
    status: 'Queued',
    total_to_verify: count || 0,
    verified_count: 0,
    options: { remove_duplicates: options?.remove_duplicates ?? true, verify_smtp: options?.verify_smtp ?? true, threshold: options?.threshold ?? 85, ...options },
    results_summary: { valid: 0, invalid: 0, risky: 0, unknown: 0 },
    created_at: new Date()?.toISOString(),
  })?.select()?.single();

  if (error) throw error;

  await supabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'Verification_Engine', message: `Verification job created for list ${list_id} (${count || 0} contacts)`, log_timestamp: new Date()?.toISOString(), metadata: { job_id: data?.id, list_id, total: count || 0 } });

  processVerificationJob(data?.id)?.catch(err => logger?.error(`Verification job ${data?.id} failed:`, err?.message));

  res?.status(201)?.json(data);
}));

// GET /api/verification/jobs
router?.get('/jobs', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('verification_jobs')?.select('*, contact_lists(name)')?.order('created_at', { ascending: false })?.limit(50);
  if (error) throw error;
  res?.json(data);
}));

// GET /api/verification/:jobId
router?.get('/:jobId', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('verification_jobs')?.select('*')?.eq('id', req?.params?.jobId)?.single();
  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Job not found' });

  const progress = data?.total_to_verify > 0 ? Math.round((data?.verified_count / data?.total_to_verify) * 100) : 0;

  let currentStage = 'Queued';
  if (data?.status === 'Running') {
    if (progress < 25) currentStage = 'Stage 1: Syntax Validation';
    else if (progress < 50) currentStage = 'Stage 2: DNS/MX Lookup';
    else if (progress < 75) currentStage = 'Stage 3: SMTP Verification';
    else currentStage = 'Stage 4: ML Scoring';
  } else if (data?.status === 'Completed') {
    currentStage = 'Completed';
  } else if (data?.status === 'Failed') {
    currentStage = 'Cancelled';
  }

  res?.json({ ...data, progress, current_stage: currentStage });
}));

// POST /api/verification/cancel/:jobId
router?.post('/cancel/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req?.params;
  const { data, error } = await supabase?.from('verification_jobs')?.update({ status: 'Failed', completed_at: new Date()?.toISOString() })?.eq('id', jobId)?.in('status', ['Queued', 'Running'])?.select()?.single();
  if (error) throw error;
  if (!data) return res?.status(400)?.json({ error: 'Job cannot be cancelled (not running or queued)' });

  await supabase?.from('system_logs')?.insert({ log_level: 'WARN', source: 'Verification_Engine', message: `Verification job ${jobId} cancelled by user`, log_timestamp: new Date()?.toISOString(), metadata: { job_id: jobId, cancelled_by: req?.user?.id } });

  res?.json({ success: true, job: data });
}));

// POST /api/verification/single
router?.post('/single', asyncHandler(async (req, res) => {
  const { email } = req?.body;
  if (!email) return res?.status(400)?.json({ error: 'email is required' });
  const result = await verifyEmail(email);
  res?.json(result);
}));

// ─── Background Job Processor ─────────────────────────────────────────────────
async function processVerificationJob(jobId) {
  await supabase?.from('verification_jobs')?.update({ status: 'Running', started_at: new Date()?.toISOString() })?.eq('id', jobId);

  const { data: job } = await supabase?.from('verification_jobs')?.select('*')?.eq('id', jobId)?.single();
  if (!job) return;

  const { data: contacts } = await supabase?.from('contacts')?.select('id, email')?.eq('list_id', job?.list_id)?.eq('status', 'Active');

  if (!contacts || contacts?.length === 0) {
    await supabase?.from('verification_jobs')?.update({ status: 'Completed', completed_at: new Date()?.toISOString(), results_summary: { valid: 0, invalid: 0, risky: 0, unknown: 0 } })?.eq('id', jobId);
    return;
  }

  const results = { valid: 0, invalid: 0, risky: 0, unknown: 0 };
  let processed = 0;

  for (const contact of contacts) {
    const { data: currentJob } = await supabase?.from('verification_jobs')?.select('status')?.eq('id', jobId)?.single();
    if (currentJob?.status === 'Failed') {
      logger?.info(`Verification job ${jobId} was cancelled, stopping processing`);
      return;
    }

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex?.test(contact?.email)) {
        await supabase?.from('contacts')?.update({ verification_verdict: 'invalid', verification_score: 0, last_verified: new Date()?.toISOString() })?.eq('id', contact?.id);
        results.invalid++;
        processed++;
        continue;
      }

      const result = await verifyEmail(contact?.email);
      await supabase?.from('contacts')?.update({ verification_verdict: result?.verdict, verification_score: result?.score, last_verified: new Date()?.toISOString() })?.eq('id', contact?.id);

      const verdict = result?.verdict || 'unknown';
      results[verdict] = (results?.[verdict] || 0) + 1;
      processed++;

      if (processed % 25 === 0) {
        await supabase?.from('verification_jobs')?.update({ verified_count: processed, results_summary: { ...results } })?.eq('id', jobId);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      logger?.error(`Verification error for ${contact?.email}:`, err?.message);
      results.unknown++;
      processed++;
    }
  }

  await supabase?.from('verification_jobs')?.update({ status: 'Completed', verified_count: processed, completed_at: new Date()?.toISOString(), results_summary: results })?.eq('id', jobId);

  await supabase?.from('system_logs')?.insert({ log_level: 'INFO', source: 'Verification_Engine', message: `Verification job ${jobId} completed: ${processed} contacts processed`, log_timestamp: new Date()?.toISOString(), metadata: { job_id: jobId, results } });

  logger?.info(`Verification job ${jobId} completed: ${JSON.stringify(results)}`);
}

module.exports = router;
