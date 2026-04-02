const dns = require('dns')?.promises;
const { FREE_RBL_LISTS, CRITICAL_RBLS, DELIST_URLS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Reverse an IP address for DNS RBL lookup
 * e.g. 192.168.1.100 -> 100.1.168.192
 */
function reverseIP(ip) {
  return ip?.split('.')?.reverse()?.join('.');
}

/**
 * Check a single IP against a single RBL via DNS lookup
 */
async function checkRBL(ip, rbl) {
  const reversedIP = reverseIP(ip);
  const hostname = `${reversedIP}.${rbl}`;

  try {
    const result = await dns?.resolve4(hostname);

    // IP is listed - try to get reason from TXT record
    let reason = '';
    try {
      const txtRecords = await dns?.resolveTxt(hostname);
      reason = txtRecords?.flat()?.join(' ');
    } catch (e) {
      // No TXT record available
    }

    const delistUrl = DELIST_URLS?.[rbl] ? DELIST_URLS?.[rbl](ip) : null;

    return {
      rbl,
      listed: true,
      response: result?.[0],
      reason,
      delistUrl,
      isCritical: CRITICAL_RBLS?.includes(rbl),
      checkedAt: new Date()?.toISOString()
    };
  } catch (error) {
    if (error?.code === 'ENOTFOUND' || error?.code === 'ENODATA' || error?.code === 'ESERVFAIL') {
      // Not listed - clean
      return {
        rbl,
        listed: false,
        checkedAt: new Date()?.toISOString()
      };
    }

    // DNS error (timeout, network issue, etc.)
    logger?.warn(`RBL check error for ${ip} on ${rbl}: ${error?.code}`);
    return {
      rbl,
      listed: null,
      error: error?.code || error?.message,
      checkedAt: new Date()?.toISOString()
    };
  }
}

/**
 * Check an IP against all configured RBLs in parallel
 * @param {string} ip - IPv4 address to check
 * @returns {object} Comprehensive RBL check results
 */
async function checkAllRBLs(ip) {
  if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/?.test(ip)) {
    return {
      ip,
      error: 'Invalid IP address format',
      totalChecked: 0,
      listedCount: 0,
      isClean: false,
      listings: [],
      allResults: []
    };
  }

  const results = await Promise.all(
    FREE_RBL_LISTS?.map(rbl => checkRBL(ip, rbl))
  );

  const listedOn = results?.filter(r => r?.listed === true);
  const clean = results?.filter(r => r?.listed === false);
  const errors = results?.filter(r => r?.listed === null);
  const hasCriticalListing = listedOn?.some(r => r?.isCritical);

  logger?.info(`RBL check for ${ip}: ${listedOn?.length} listings, ${errors?.length} errors`);

  return {
    ip,
    totalChecked: results?.length,
    listedCount: listedOn?.length,
    cleanCount: clean?.length,
    errorCount: errors?.length,
    isClean: listedOn?.length === 0,
    hasCriticalListing,
    listings: listedOn,
    allResults: results,
    checkedAt: new Date()?.toISOString()
  };
}

module.exports = { checkAllRBLs, checkRBL, reverseIP };
