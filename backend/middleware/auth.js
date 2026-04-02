const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Verify Supabase JWT token from Authorization header
 */
async function authenticateToken(req, res, next) {
  const authHeader = req?.headers?.authorization;

  if (!authHeader || !authHeader?.startsWith('Bearer ')) {
    return res?.status(401)?.json({ error: 'No authorization token provided' });
  }

  const token = authHeader?.split('Bearer ')?.[1];

  if (!token) {
    return res?.status(401)?.json({ error: 'Invalid authorization format' });
  }

  try {
    const { data: { user }, error } = await supabase?.auth?.getUser(token);

    if (error || !user) {
      logger?.warn(`Auth failed: ${error?.message || 'No user found'}`);
      return res?.status(403)?.json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger?.error('Auth middleware error:', error?.message);
    return res?.status(500)?.json({ error: 'Authentication service error' });
  }
}

/**
 * Optional: Verify internal agent API key
 */
function authenticateAgentKey(req, res, next) {
  const apiKey = req?.headers?.['x-api-key'];

  if (!apiKey) {
    return res?.status(401)?.json({ error: 'No API key provided' });
  }

  // Validate against known agent keys stored in env
  const validKeys = (process.env.AGENT_API_KEYS || '')?.split(',')?.filter(Boolean);

  if (!validKeys?.includes(apiKey)) {
    logger?.warn(`Invalid agent API key attempt from ${req?.ip}`);
    return res?.status(403)?.json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = { authenticateToken, authenticateAgentKey };
