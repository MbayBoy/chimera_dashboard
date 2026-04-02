const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  logger?.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

// Service role client (full access - backend only, NEVER expose to frontend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Test connection on startup
async function testConnection() {
  try {
    const { error } = await supabase?.from('servers')?.select('count')?.limit(1);
    if (error) throw error;
    logger?.info('Supabase connection established successfully');
  } catch (error) {
    logger?.error('Supabase connection failed:', error?.message);
  }
}

testConnection();

module.exports = supabase;
