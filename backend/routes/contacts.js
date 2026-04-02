const express = require('express');
const router = express?.Router();
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router?.use(authenticateToken);

// GET /api/contacts - List contacts (paginated)
router?.get('/', asyncHandler(async (req, res) => {
  const { list_id, status, tier, page = 1, limit = 100, search } = req?.query;
  const offset = (page - 1) * limit;

  let query = supabase?.from('contacts')?.select('*', { count: 'exact' })?.order('engagement_score', { ascending: false })?.range(offset, offset + parseInt(limit) - 1);

  if (list_id) query = query?.eq('list_id', list_id);
  if (status) query = query?.eq('contact_status', status);
  if (tier) query = query?.eq('tier', tier);
  if (search) query = query?.ilike('email', `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  res?.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
}));

// GET /api/contacts/:id - Get contact details
router?.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase?.from('contacts')?.select('*, contact_lists(name)')?.eq('id', req?.params?.id)?.single();

  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Contact not found' });

  res?.json(data);
}));

// POST /api/contacts - Add contact
router?.post('/', asyncHandler(async (req, res) => {
  const { email, list_id, status } = req?.body;

  if (!email || !list_id) {
    return res?.status(400)?.json({ error: 'email and list_id are required' });
  }

  const { data, error } = await supabase?.from('contacts')?.insert({
      email: email?.toLowerCase()?.trim(),
      list_id,
      contact_status: status || 'Active',
      tier: 'Lead',
      engagement_score: 0,
      bounce_count: 0,
      total_sent: 0,
      created_at: new Date()?.toISOString()
    })?.select()?.single();

  if (error) {
    if (error?.code === '23505') {
      return res?.status(409)?.json({ error: 'Email already exists' });
    }
    throw error;
  }

  res?.status(201)?.json(data);
}));

// PUT /api/contacts/:id - Update contact
router?.put('/:id', asyncHandler(async (req, res) => {
  const allowedFields = ['contact_status', 'tier', 'engagement_score', 'list_id',
    'optimal_send_time_hour', 'predicted_ltv', 'churn_probability'];

  const updates = {};
  allowedFields?.forEach(field => {
    if (req?.body?.[field] !== undefined) updates[field] = req?.body?.[field];
  });
  // Support legacy 'status' field from frontend
  if (req?.body?.status !== undefined && req?.body?.contact_status === undefined) updates.contact_status = req?.body?.status;

  const { data, error } = await supabase?.from('contacts')?.update(updates)?.eq('id', req?.params?.id)?.select()?.single();

  if (error) throw error;
  if (!data) return res?.status(404)?.json({ error: 'Contact not found' });

  res?.json(data);
}));

// DELETE /api/contacts/:id - Delete contact
router?.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase?.from('contacts')?.delete()?.eq('id', req?.params?.id);

  if (error) throw error;

  res?.json({ success: true });
}));

// POST /api/contacts/bulk-delete - Bulk delete by criteria
router?.post('/bulk-delete', asyncHandler(async (req, res) => {
  const { status, list_id, tier, ids } = req?.body;

  if (ids && Array.isArray(ids)) {
    const { error } = await supabase?.from('contacts')?.delete()?.in('id', ids);
    if (error) throw error;
    return res?.json({ success: true, deleted: ids?.length });
  }

  let query = supabase?.from('contacts')?.delete();
  if (status) query = query?.eq('contact_status', status);
  if (list_id) query = query?.eq('list_id', list_id);
  if (tier) query = query?.eq('tier', tier);

  const { error, count } = await query;
  if (error) throw error;

  res?.json({ success: true, deleted: count });
}));

// POST /api/contacts/import - Import contacts from array
router?.post('/import', asyncHandler(async (req, res) => {
  const { contacts, list_id } = req?.body;

  if (!contacts || !Array.isArray(contacts) || !list_id) {
    return res?.status(400)?.json({ error: 'contacts array and list_id required' });
  }

  const entries = contacts?.map(c => ({
    email: (c?.email || c)?.toLowerCase()?.trim(),
    list_id,
    contact_status: 'Active',
    tier: 'Lead',
    engagement_score: 0,
    bounce_count: 0,
    total_sent: 0,
    created_at: new Date()?.toISOString()
  }));

  let imported = 0;
  let skipped = 0;

  // Insert in batches of 500, ignore duplicates
  for (let i = 0; i < entries?.length; i += 500) {
    const batch = entries?.slice(i, i + 500);
    const { data, error } = await supabase?.from('contacts')?.upsert(batch, { onConflict: 'email', ignoreDuplicates: true })?.select();

    if (error) throw error;
    imported += data?.length || 0;
    skipped += batch?.length - (data?.length || 0);
  }

  res?.json({ success: true, imported, skipped, total: contacts?.length });
}));

module.exports = router;
