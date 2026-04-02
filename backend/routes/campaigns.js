const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// All campaign routes require authentication
router?.use(authenticateToken);

// GET /api/campaigns - List all campaigns
router?.get('/', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req?.query;
  const offset = (page - 1) * limit;

  let query = supabase?.from('campaigns')?.select('*, domains(domain_name), servers(name, ip_address)', { count: 'exact' })?.order('created_at', { ascending: false })?.range(offset, offset + parseInt(limit) - 1);

  if (status) query = query?.eq('campaign_status', status);

  const { data, error, count } = await query;
  if (error) throw error;

  res?.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
}));

// GET /api/campaigns/:id - Get campaign details
router?.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('campaigns')?.select('*, domains(*), servers(*)')?.eq('id', req?.params?.id)?.single();

  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Campaign not found' });

  res?.json(data);
}));

// POST /api/campaigns - Create campaign
router?.post('/', asyncHandler(async (req, res) => {
  const { name, subject, body_html, body_text, from_domain_id, assigned_server_id, scheduled_for } = req?.body;

  if (!name || !subject || !body_html || !from_domain_id) {
    return res?.status(400)?.json({ error: 'Missing required fields: name, subject, body_html, from_domain_id' });
  }

  const { data, error } = await supabase?.from('campaigns')?.insert({
      name, subject, body_html, body_text,
      from_domain_id, assigned_server_id,
      campaign_status: 'Draft',
      scheduled_for,
      created_at: new Date()?.toISOString()
    })?.select()?.single();

  if (error) throw error;

  logger?.info(`Campaign created: ${data?.id} - ${name}`);
  res?.status(201)?.json(data);
}));

// PUT /api/campaigns/:id - Update campaign
router?.put('/:id', asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'subject', 'body_html', 'body_text',
    'from_domain_id', 'assigned_server_id', 'campaign_status', 'scheduled_for',
    'risk_profile', 'risk_score', 'content_score'];

  const updates = {};
  allowedFields?.forEach(field => {
    if (req?.body?.[field] !== undefined) updates[field] = req?.body?.[field];
  });
  // Support legacy 'status' field from frontend
  if (req?.body?.status !== undefined && req?.body?.campaign_status === undefined) updates.campaign_status = req?.body?.status;

  const { data, error } = await supabase?.from('campaigns')?.update(updates)?.eq('id', req?.params?.id)?.select()?.single();

  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Campaign not found' });

  res?.json(data);
}));

// DELETE /api/campaigns/:id - Delete campaign
router?.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase?.from('campaigns')?.delete()?.eq('id', req?.params?.id);

  if (error) throw error;

  res?.json({ success: true, message: 'Campaign deleted' });
}));

// POST /api/campaigns/:id/queue - Queue campaign for sending
router?.post('/:id/queue', asyncHandler(async (req, res) => {
  const { list_id, scheduled_for } = req?.body;

  // Get campaign
  const { data: campaign, error: campError } = await supabase?.from('campaigns')?.select('*')?.eq('id', req?.params?.id)?.single();

  if (campError || !campaign) return res?.status(404)?.json({ error: 'Campaign not found' });
  if (campaign?.campaign_status !== 'Draft' && campaign?.campaign_status !== 'Scheduled') {
    return res?.status(400)?.json({ error: 'Campaign must be in Draft or Scheduled status to queue' });
  }

  if (!list_id) return res?.status(400)?.json({ error: 'list_id is required' });

  // Get contacts from list
  const { data: contacts, error: contactError } = await supabase?.from('contacts')?.select('id')?.eq('list_id', list_id)?.eq('contact_status', 'Active');

  if (contactError) throw contactError;
  if (!contacts || contacts?.length === 0) {
    return res?.status(400)?.json({ error: 'No active contacts in list' });
  }

  // Build queue entries
  const queueEntries = contacts?.map(contact => ({
    campaign_id: req?.params?.id,
    contact_id: contact?.id,
    server_id: campaign?.assigned_server_id,
    scheduled_for: scheduled_for || new Date()?.toISOString(),
    queue_status: 'Queued',
    attempt_count: 0,
  }));

  // Insert in batches of 500
  for (let i = 0; i < queueEntries?.length; i += 500) {
    const batch = queueEntries?.slice(i, i + 500);
    const { error: queueError } = await supabase?.from('campaign_queue')?.insert(batch);
    if (queueError) throw queueError;
  }

  // Update campaign status to Running
  await supabase?.from('campaigns')?.update({ campaign_status: 'Running', total_recipients: contacts?.length })?.eq('id', req?.params?.id);

  logger?.info(`Campaign ${req?.params?.id} queued with ${contacts?.length} recipients`);
  res?.json({ success: true, queued: contacts?.length, message: `Campaign queued for ${contacts?.length} contacts` });
}));

// POST /api/campaigns/:id/pause - Pause campaign
router?.post('/:id/pause', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('campaigns')?.update({ campaign_status: 'Paused' })?.eq('id', req?.params?.id)?.in('campaign_status', ['Running', 'Scheduled'])?.select()?.single();

  if (error) throw error;
  if (!data) return res?.status(400)?.json({ error: 'Campaign is not running or scheduled' });

  logger?.info(`Campaign ${req?.params?.id} paused`);
  res?.json({ success: true, campaign: data });
}));

// POST /api/campaigns/:id/resume - Resume campaign
router?.post('/:id/resume', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('campaigns')?.update({ campaign_status: 'Running' })?.eq('id', req?.params?.id)?.eq('campaign_status', 'Paused')?.select()?.single();

  if (error) throw error;
  if (!data) return res?.status(400)?.json({ error: 'Campaign is not paused' });

  logger?.info(`Campaign ${req?.params?.id} resumed`);
  res?.json({ success: true, campaign: data });
}));

// GET /api/campaigns/:id/analytics - Get campaign analytics
router?.get('/:id/analytics', asyncHandler(async (req, res) => {
  const { data: campaign, error } = await supabase?.from('campaigns')?.select('*')?.eq('id', req?.params?.id)?.single();

  if (error) throw error;
  if (!campaign) return res?.status(404)?.json({ error: 'Campaign not found' });

  const totalSent = campaign?.sent_count || 0;
  const analytics = {
    id: campaign?.id,
    name: campaign?.name,
    status: campaign?.status,
    totalRecipients: campaign?.total_recipients || 0,
    sentCount: totalSent,
    deliveredCount: campaign?.delivered_count || 0,
    openCount: campaign?.open_count || 0,
    clickCount: campaign?.click_count || 0,
    bounceCount: campaign?.bounce_count || 0,
    complaintCount: campaign?.complaint_count || 0,
    openRate: totalSent > 0 ? ((campaign?.open_count / totalSent) * 100)?.toFixed(2) : 0,
    clickRate: totalSent > 0 ? ((campaign?.click_count / totalSent) * 100)?.toFixed(2) : 0,
    bounceRate: totalSent > 0 ? ((campaign?.bounce_count / totalSent) * 100)?.toFixed(2) : 0,
    complaintRate: totalSent > 0 ? ((campaign?.complaint_count / totalSent) * 100)?.toFixed(2) : 0
  };

  res?.json(analytics);
}));

// POST /api/campaigns/:id/promote-variant - Promote A/B test winning variant
router?.post('/:id/promote-variant', asyncHandler(async (req, res) => {
  const { variant_id, variant_subject, variant_from_name, variant_body_html, variant_body_text, ab_test_name, confidence, remaining_list_id } = req?.body;

  if (!variant_id || !variant_subject) {
    return res?.status(400)?.json({ error: 'variant_id and variant_subject are required' });
  }

  // Get campaign
  const { data: campaign, error: campError } = await supabase?.from('campaigns')?.select('*')?.eq('id', req?.params?.id)?.single();
  if (campError || !campaign) return res?.status(404)?.json({ error: 'Campaign not found' });

  // Update campaign with winning variant details
  const updates = {
    subject: variant_subject,
    status: 'Running',
    ab_winner_variant: variant_id,
    ab_test_name: ab_test_name || null,
    ab_confidence: confidence || null,
    ab_promoted_at: new Date()?.toISOString(),
  };
  if (variant_from_name) updates.from_name = variant_from_name;
  if (variant_body_html) updates.body_html = variant_body_html;
  if (variant_body_text) updates.body_text = variant_body_text;

  const { data: updatedCampaign, error: updateError } = await supabase
    ?.from('campaigns')?.update(updates)?.eq('id', req?.params?.id)?.select()?.single();
  if (updateError) throw updateError;

  // Queue remaining recipients if list_id provided
  let queuedCount = 0;
  if (remaining_list_id) {
    const { data: contacts, error: contactError } = await supabase
      ?.from('contacts')?.select('id')?.eq('list_id', remaining_list_id)?.eq('status', 'Active');

    if (!contactError && contacts?.length > 0) {
      const queueEntries = contacts?.map(contact => ({
        campaign_id: req?.params?.id,
        contact_id: contact?.id,
        server_id: campaign?.assigned_server_id,
        scheduled_for: new Date()?.toISOString(),
        status: 'Queued',
        attempt_count: 0,
      }));

      for (let i = 0; i < queueEntries?.length; i += 500) {
        const batch = queueEntries?.slice(i, i + 500);
        await supabase?.from('campaign_queue')?.insert(batch);
      }
      queuedCount = contacts?.length;

      await supabase?.from('campaigns')?.update({ total_recipients: (campaign?.total_recipients || 0) + queuedCount })?.eq('id', req?.params?.id);
    }
  }

  // Audit log
  await supabase?.from('system_logs')?.insert({
    log_level: 'INFO',
    source: 'ABTestPromotion',
    message: `A/B test winner promoted: Campaign "${campaign?.name}" → Variant ${variant_id} (${confidence}% confidence). ${queuedCount} contacts queued. Test: ${ab_test_name || 'N/A'}`,
    log_timestamp: new Date()?.toISOString(),
  });

  logger?.info(`[Campaigns] A/B winner promoted: ${req?.params?.id}, variant ${variant_id}, ${queuedCount} queued`);

  res?.json({
    success: true,
    campaign: updatedCampaign,
    queued: queuedCount,
    message: `Variant ${variant_id} promoted. ${queuedCount > 0 ? `${queuedCount} contacts queued for delivery.` : 'No additional contacts queued.'}`,
  });
}));

module.exports = router;
