const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router?.use(authenticateToken);

// GET /api/lists - List all contact lists
router?.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('contact_lists')?.select('*')?.order('created_at', { ascending: false });

  if (error) throw error;
  res?.json(data);
}));

// GET /api/lists/:id - Get list details
router?.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('contact_lists')?.select('*')?.eq('id', req?.params?.id)?.single();

  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'List not found' });

  res?.json(data);
}));

// POST /api/lists - Create list
router?.post('/', asyncHandler(async (req, res) => {
  const { name } = req?.body;

  if (!name) return res?.status(400)?.json({ error: 'name is required' });

  const { data, error } = await supabase?.from('contact_lists')?.insert({
      name,
      list_status: 'Building',
      total_contacts: 0,
      average_engagement_score: 0,
      platinum_count: 0, gold_count: 0,
      silver_count: 0, bronze_count: 0, lead_count: 0,
      created_at: new Date()?.toISOString()
    })?.select()?.single();

  if (error) throw error;
  res?.status(201)?.json(data);
}));

// PUT /api/lists/:id - Update list
router?.put('/:id', asyncHandler(async (req, res) => {
  const { name, status, list_status } = req?.body;
  const updates = {};
  if (name) updates.name = name;
  if (list_status) updates.list_status = list_status;
  // Support legacy 'status' field from frontend
  if (status && !list_status) updates.list_status = status;

  const { data, error } = await supabase?.from('contact_lists')?.update(updates)?.eq('id', req?.params?.id)?.select()?.single();

  if (error) throw error;
  res?.json(data);
}));

// DELETE /api/lists/:id - Delete list
router?.delete('/:id', asyncHandler(async (req, res) => {
  // Delete contacts first
  await supabase?.from('contacts')?.delete()?.eq('list_id', req?.params?.id);

  const { error } = await supabase?.from('contact_lists')?.delete()?.eq('id', req?.params?.id);

  if (error) throw error;
  res?.json({ success: true });
}));

// POST /api/lists/:id/verify - Start verification job
router?.post('/:id/verify', asyncHandler(async (req, res) => {
  const { options = {} } = req?.body;

  // Count contacts
  const { count } = await supabase?.from('contacts')?.select('*', { count: 'exact', head: true })?.eq('list_id', req?.params?.id)?.eq('contact_status', 'Active');

  if (!count || count === 0) {
    return res?.status(400)?.json({ error: 'No active contacts to verify' });
  }

  const { data, error } = await supabase?.from('verification_jobs')?.insert({
      list_id: parseInt(req?.params?.id),
      status: 'Queued',
      total_to_verify: count,
      verified_count: 0,
      options,
      created_at: new Date()?.toISOString()
    })?.select()?.single();

  if (error) throw error;
  res?.status(201)?.json(data);
}));

// GET /api/lists/:id/contacts - Get contacts in list
router?.get('/:id/contacts', asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, status, tier } = req?.query;
  const offset = (page - 1) * limit;

  let query = supabase?.from('contacts')?.select('*', { count: 'exact' })?.eq('list_id', req?.params?.id)?.range(offset, offset + parseInt(limit) - 1);

  if (status) query = query?.eq('contact_status', status);
  if (tier) query = query?.eq('tier', tier);

  const { data, error, count } = await query;
  if (error) throw error;

  res?.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
}));

module.exports = router;
