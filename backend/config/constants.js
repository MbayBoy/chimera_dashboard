module.exports = {
  // RBL Lists for blacklist checking
  FREE_RBL_LISTS: [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'b.barracudacentral.org',
    'dnsbl.sorbs.net',
    'psbl.surriel.com',
    'ubl.unsubscore.com',
    'dnsbl-1.uceprotect.net',
    'cbl.abuseat.org',
    'ips.backscatterer.org',
    'bogons.cymru.com'
  ],

  // Critical RBLs that trigger immediate quarantine
  CRITICAL_RBLS: [
    'zen.spamhaus.org',
    'cbl.abuseat.org'
  ],

  // Delist URLs per RBL
  DELIST_URLS: {
    'zen.spamhaus.org': (ip) => `https://www.spamhaus.org/query/ip/${ip}`,
    'bl.spamcop.net': (ip) => `https://www.spamcop.net/bl.shtml?${ip}`,
    'dnsbl.sorbs.net': (ip) => `https://www.sorbs.net/lookup.shtml?${ip}`,
    'b.barracudacentral.org': (ip) => `https://barracudacentral.org/lookups/lookup-reputation?host=${ip}`,
    'cbl.abuseat.org': (ip) => `https://www.abuseat.org/lookup.cgi?ip=${ip}`
  },

  // Server statuses
  SERVER_STATUS: {
    PROVISIONING: 'Provisioning',
    WARMING: 'Warming',
    ACTIVE: 'Active',
    QUARANTINED: 'Quarantined',
    BURNT: 'Burnt'
  },

  // Campaign statuses
  CAMPAIGN_STATUS: {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    RUNNING: 'Running',
    PAUSED: 'Paused',
    COMPLETED: 'Completed'
  },

  // Contact tiers
  CONTACT_TIERS: ['Platinum', 'Gold', 'Silver', 'Bronze', 'Lead'],

  // Log levels
  LOG_LEVELS: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],

  // Reputation thresholds
  REPUTATION: {
    QUARANTINE_THRESHOLD: 30,
    WARNING_THRESHOLD: 50,
    HEALTHY_THRESHOLD: 70
  },

  // Engagement scoring weights
  ENGAGEMENT: {
    OPEN_WEIGHT: 5,
    CLICK_WEIGHT: 10,
    RECENCY_PENALTY: 2,
    ZOMBIE_DAYS: 90
  },

  // Tier thresholds
  TIER_THRESHOLDS: {
    PLATINUM: { score: 90, recencyDays: 14, ageDays: 90 },
    GOLD: { score: 70, recencyDays: 30 },
    SILVER: { score: 40, recencyDays: 60 },
    BRONZE: { score: 20, recencyDays: 90 }
  }
};
