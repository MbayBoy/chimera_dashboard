const dns = require('dns')?.promises;
const logger = require('../utils/logger');

/**
 * Validate SPF record for a domain
 */
async function validateSPF(domain) {
  try {
    const records = await dns?.resolveTxt(domain);
    const spfRecord = records?.flat()?.find(r => r?.startsWith('v=spf1'));

    if (!spfRecord) {
      return { valid: false, record: null, error: 'No SPF record found' };
    }

    // Basic SPF validation
    const hasAll = spfRecord?.includes('~all') || spfRecord?.includes('-all') || spfRecord?.includes('?all');
    const isStrict = spfRecord?.includes('-all');

    return {
      valid: true,
      record: spfRecord,
      isStrict,
      hasAll,
      recommendation: !isStrict ? 'Consider using -all for stricter enforcement' : null
    };
  } catch (error) {
    return { valid: false, record: null, error: error?.message };
  }
}

/**
 * Validate DKIM record for a domain with a given selector
 */
async function validateDKIM(domain, selector = 'default') {
  try {
    const dkimHost = `${selector}._domainkey.${domain}`;
    const records = await dns?.resolveTxt(dkimHost);
    const dkimRecord = records?.flat()?.join('');

    if (!dkimRecord) {
      return { valid: false, selector, record: null, error: 'No DKIM record found' };
    }

    const hasPublicKey = dkimRecord?.includes('p=') && !dkimRecord?.includes('p=;');

    return {
      valid: hasPublicKey,
      selector,
      record: dkimRecord?.substring(0, 100) + '...',
      hasPublicKey
    };
  } catch (error) {
    return { valid: false, selector, record: null, error: error?.message };
  }
}

/**
 * Validate DMARC record for a domain
 */
async function validateDMARC(domain) {
  try {
    const dmarcHost = `_dmarc.${domain}`;
    const records = await dns?.resolveTxt(dmarcHost);
    const dmarcRecord = records?.flat()?.find(r => r?.startsWith('v=DMARC1'));

    if (!dmarcRecord) {
      return { valid: false, record: null, error: 'No DMARC record found' };
    }

    // Parse DMARC policy
    const policyMatch = dmarcRecord?.match(/p=(none|quarantine|reject)/);
    const policy = policyMatch ? policyMatch?.[1] : 'none';
    const isEnforced = policy === 'quarantine' || policy === 'reject';

    // Check for RUA (aggregate reports)
    const ruaMatch = dmarcRecord?.match(/rua=([^;]+)/);
    const rua = ruaMatch ? ruaMatch?.[1] : null;

    return {
      valid: true,
      record: dmarcRecord,
      policy,
      isEnforced,
      rua,
      recommendation: !isEnforced
        ? 'Consider upgrading to p=quarantine or p=reject for better protection'
        : null
    };
  } catch (error) {
    return { valid: false, record: null, error: error?.message };
  }
}

/**
 * Validate all DNS records for a domain object from Supabase
 * @param {object} domain - Domain record from database
 */
async function validateDNS(domain) {
  const domainName = domain?.domain_name;
  const dkimSelector = domain?.dkim_selector || 'default';

  logger?.info(`Validating DNS for ${domainName}`);

  const [spf, dkim, dmarc] = await Promise.all([
    validateSPF(domainName),
    validateDKIM(domainName, dkimSelector),
    validateDMARC(domainName)
  ]);

  const overallHealth = [
    spf?.valid ? 33 : 0,
    dkim?.valid ? 33 : 0,
    dmarc?.valid ? 34 : 0
  ]?.reduce((a, b) => a + b, 0);

  return {
    domain: domainName,
    spf,
    dkim,
    dmarc,
    overallHealth,
    isFullyConfigured: spf?.valid && dkim?.valid && dmarc?.valid,
    checkedAt: new Date()?.toISOString()
  };
}

module.exports = { validateDNS, validateSPF, validateDKIM, validateDMARC };
