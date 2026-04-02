// Duplicate Contact Prevention Utility
// Tracks which contacts have been emailed per campaign to prevent duplicates

const SENT_LOG_KEY = 'chimera_sent_log';

/**
 * Get the sent log from localStorage
 * Structure: { [campaignId]: Set<contactEmail> }
 */
export const getSentLog = () => {
  try {
    const raw = localStorage.getItem(SENT_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Convert arrays back to Sets
    const result = {};
    for (const [campaignId, emails] of Object.entries(parsed)) {
      result[campaignId] = new Set(emails);
    }
    return result;
  } catch {
    return {};
  }
};

/**
 * Save the sent log to localStorage
 */
const saveSentLog = (log) => {
  try {
    const serializable = {};
    for (const [campaignId, emailSet] of Object.entries(log)) {
      serializable[campaignId] = Array.from(emailSet);
    }
    localStorage.setItem(SENT_LOG_KEY, JSON.stringify(serializable));
  } catch {
    // Silent fail
  }
};

/**
 * Check if a contact has already been sent a specific campaign
 * @param {string} campaignId
 * @param {string} contactEmail
 * @returns {boolean}
 */
export const hasContactBeenSent = (campaignId, contactEmail) => {
  const log = getSentLog();
  return log?.[campaignId]?.has(contactEmail?.toLowerCase()) ?? false;
};

/**
 * Mark a contact as sent for a campaign
 * @param {string} campaignId
 * @param {string} contactEmail
 */
export const markContactSent = (campaignId, contactEmail) => {
  const log = getSentLog();
  if (!log?.[campaignId]) {
    log[campaignId] = new Set();
  }
  log?.[campaignId]?.add(contactEmail?.toLowerCase());
  saveSentLog(log);
};

/**
 * Filter a list of contacts to remove duplicates for a campaign
 * @param {string} campaignId
 * @param {Array<{email: string}>} contacts
 * @returns {{ filtered: Array, duplicates: Array, duplicateCount: number }}
 */
export const filterDuplicateContacts = (campaignId, contacts) => {
  const log = getSentLog();
  const sentSet = log?.[campaignId] || new Set();
  
  const filtered = [];
  const duplicates = [];
  
  // Also check for duplicates within the current list itself
  const seenInList = new Set();
  
  for (const contact of contacts) {
    const email = contact?.email?.toLowerCase();
    if (!email) continue;
    
    if (sentSet?.has(email) || seenInList?.has(email)) {
      duplicates?.push(contact);
    } else {
      filtered?.push(contact);
      seenInList?.add(email);
    }
  }
  
  return {
    filtered,
    duplicates,
    duplicateCount: duplicates?.length,
    originalCount: contacts?.length,
  };
};

/**
 * Get stats for a campaign's sent contacts
 * @param {string} campaignId
 * @returns {{ totalSent: number }}
 */
export const getCampaignSentStats = (campaignId) => {
  const log = getSentLog();
  return {
    totalSent: log?.[campaignId]?.size ?? 0,
  };
};

/**
 * Clear sent log for a campaign (use when resetting/cloning)
 * @param {string} campaignId
 */
export const clearCampaignSentLog = (campaignId) => {
  const log = getSentLog();
  delete log?.[campaignId];
  saveSentLog(log);
};

export default {
  getSentLog,
  hasContactBeenSent,
  markContactSent,
  filterDuplicateContacts,
  getCampaignSentStats,
  clearCampaignSentLog,
};
