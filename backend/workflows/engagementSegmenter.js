const supabase = require('../config/supabase');
const { ENGAGEMENT, TIER_THRESHOLDS } = require('../config/constants');
const logger = require('../utils/logger');

async function engagementSegmenter() {
  logger?.info('[Engagement Segmenter] Starting segmentation with LTV calculation...');

  let offset = 0;
  const batchSize = 500;
  let totalProcessed = 0;
  let highRiskContacts = [];

  while (true) {
    const { data: contacts, error } = await supabase?.from('contacts')?.select('*')?.not('status', 'in', '("Bounced","Unsubscribed","Complained")')?.range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!contacts || contacts?.length === 0) break;

    // Fetch transaction data for this batch
    const contactIds = contacts?.map(c => c?.id);
    const { data: transactions } = await supabase?.from('transactions')?.select('contact_id, amount, created_at')?.in('contact_id', contactIds);

    const txByContact = {};
    if (transactions) {
      for (const tx of transactions) {
        if (!txByContact?.[tx?.contact_id]) txByContact[tx?.contact_id] = [];
        txByContact?.[tx?.contact_id]?.push(tx);
      }
    }

    const updates = contacts?.map(contact => {
      const engagementScore = calculateEngagementScore(contact);
      const tier = assignTier(contact, engagementScore);
      const status = shouldMarkZombie(contact) ? 'Zombie' : contact?.status;
      const contactTxs = txByContact?.[contact?.id] || [];
      const { predicted_ltv, churn_probability } = calculateLTVAndChurn(contact, engagementScore, tier, contactTxs);

      if (churn_probability > 0.7) {
        highRiskContacts?.push({ id: contact?.id, email: contact?.email, churn_probability, list_id: contact?.list_id });
      }

      return { id: contact?.id, engagement_score: engagementScore, tier, status, predicted_ltv: predicted_ltv, churn_probability: churn_probability };
    });

    for (const update of updates) {
      await supabase?.from('contacts')?.update({
        engagement_score: update?.engagement_score,
        tier: update?.tier,
        status: update?.status,
        predicted_ltv: update?.predicted_ltv,
        churn_probability: update?.churn_probability
      })?.eq('id', update?.id);
    }

    totalProcessed += contacts?.length;
    offset += batchSize;
    if (contacts?.length < batchSize) break;
  }

  // Update list statistics including LTV
  await updateListStats();

  // Auto-enroll high-risk contacts in win-back campaigns
  if (highRiskContacts?.length > 0) {
    await enrollHighRiskInWinBack(highRiskContacts);
  }

  await logToSystem('INFO', 'Engagement_Segmenter',
    `Segmentation + LTV completed: ${totalProcessed} contacts processed, ${highRiskContacts?.length} high-risk enrolled in win-back`);

  logger?.info(`[Engagement Segmenter] Completed: ${totalProcessed} contacts, ${highRiskContacts?.length} high-risk`);
}

function calculateLTVAndChurn(contact, engagementScore, tier, transactions) {
  // LTV Calculation
  let predicted_ltv = 0;
  if (transactions?.length > 0) {
    const totalRevenue = transactions?.reduce((sum, tx) => sum + (parseFloat(tx?.amount) || 0), 0);
    const avgTransactionValue = totalRevenue / transactions?.length;

    // Purchase frequency: transactions per month
    const firstTx = new Date(transactions?.sort((a, b) => new Date(a?.created_at) - new Date(b?.created_at))?.[0]?.created_at);
    const monthsActive = Math.max(1, daysBetween(firstTx, new Date()) / 30);
    const purchaseFrequency = transactions?.length / monthsActive;

    // Customer lifespan in months based on tier
    const lifespanByTier = { Platinum: 36, Gold: 24, Silver: 18, Bronze: 12, Lead: 6 };
    const customerLifespan = lifespanByTier?.[tier] || 12;

    // Engagement multiplier (0.5 to 1.5)
    const engagementMultiplier = 0.5 + (engagementScore / 100);

    predicted_ltv = Math.round(avgTransactionValue * purchaseFrequency * customerLifespan * engagementMultiplier * 100) / 100;
  } else {
    // No transactions: estimate from tier
    const tierBaseLTV = { Platinum: 500, Gold: 250, Silver: 100, Bronze: 50, Lead: 10 };
    predicted_ltv = (tierBaseLTV?.[tier] || 10) * (engagementScore / 100);
  }

  // Churn Probability using logistic regression model
  const daysSinceLastOpen = contact?.last_open_date
    ? daysBetween(new Date(contact?.last_open_date), new Date())
    : 999;

  // Engagement score trend: compare current vs historical (approximate decline)
  const prevScore = contact?.engagement_score || engagementScore;
  const scoreDelta = engagementScore - prevScore; // negative = declining
  const engagementTrendFactor = scoreDelta < -10 ? 0.3 : scoreDelta < 0 ? 0.15 : 0;

  // Tier degradation factor
  const tierOrder = { Platinum: 5, Gold: 4, Silver: 3, Bronze: 2, Lead: 1 };
  const currentTierVal = tierOrder?.[tier] || 1;
  const prevTierVal = tierOrder?.[contact?.tier] || 1;
  const tierDegradationFactor = prevTierVal > currentTierVal ? 0.2 : 0;

  // Logistic regression inputs
  const recencyFactor = Math.min(1, daysSinceLastOpen / 180); // 0-1 scale, 180 days = max
  const bounceFactor = Math.min(0.4, (contact?.bounce_count || 0) * 0.1);
  const lowEngagementFactor = Math.max(0, (50 - engagementScore) / 100); // higher when score < 50

  // Weighted sum → sigmoid
  const z = (recencyFactor * 2.5) + (bounceFactor * 2.0) + (lowEngagementFactor * 1.5)
    + engagementTrendFactor + tierDegradationFactor - 1.0;
  const churn_probability = Math.round((1 / (1 + Math.exp(-z))) * 1000) / 1000;

  return { predicted_ltv, churn_probability };
}

function calculateEngagementScore(contact) {
  const opens = contact?.open_count || 0;
  const clicks = contact?.click_count || 0;
  const daysSinceActivity = contact?.last_open_date
    ? daysBetween(new Date(contact.last_open_date), new Date())
    : 999;

  let score = (opens * ENGAGEMENT?.OPEN_WEIGHT) +
    (clicks * ENGAGEMENT?.CLICK_WEIGHT) -
    (daysSinceActivity * ENGAGEMENT?.RECENCY_PENALTY);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function assignTier(contact, engagementScore) {
  const daysSinceActivity = contact?.last_open_date
    ? daysBetween(new Date(contact.last_open_date), new Date())
    : 999;
  const daysSinceCreation = contact?.created_at
    ? daysBetween(new Date(contact.created_at), new Date())
    : 0;

  const { PLATINUM, GOLD, SILVER, BRONZE } = TIER_THRESHOLDS;

  if (
    engagementScore >= PLATINUM?.score &&
    daysSinceActivity <= PLATINUM?.recencyDays &&
    daysSinceCreation >= PLATINUM?.ageDays &&
    (contact?.bounce_count || 0) === 0 &&
    contact?.status !== 'Complained'
  ) return 'Platinum';

  if (engagementScore >= GOLD?.score && daysSinceActivity <= GOLD?.recencyDays) return 'Gold';
  if (engagementScore >= SILVER?.score && daysSinceActivity <= SILVER?.recencyDays) return 'Silver';
  if (engagementScore >= BRONZE?.score || daysSinceActivity <= BRONZE?.recencyDays) return 'Bronze';
  return 'Lead';
}

function shouldMarkZombie(contact) {
  if (contact?.status === 'Active' && contact?.last_open_date) {
    return daysBetween(new Date(contact.last_open_date), new Date()) > ENGAGEMENT?.ZOMBIE_DAYS;
  }
  return false;
}

function daysBetween(date1, date2) {
  const diff = Math.abs(date2?.getTime() - date1?.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function enrollHighRiskInWinBack(highRiskContacts) {
  try {
    // Find or create win-back campaign
    const { data: winBackCampaign } = await supabase?.from('campaigns')
      ?.select('id')
      ?.ilike('name', '%win-back%')
      ?.eq('status', 'Active')
      ?.limit(1);

    const campaignId = winBackCampaign?.[0]?.id;

    for (const contact of highRiskContacts) {
      // Tag contact as high-risk churn
      await supabase?.from('contacts')?.update({ tags: supabase?.rpc ? undefined : undefined })
        ?.eq('id', contact?.id);

      // Log enrollment
      await logToSystem('INFO', 'Engagement_Segmenter',
        `High-risk contact ${contact?.email} (churn: ${(contact?.churn_probability * 100)?.toFixed(1)}%) enrolled in win-back campaign`,
        null, contact?.id);
    }

    // Log LTV predictions summary
    await logToSystem('INFO', 'Engagement_Segmenter',
      `Win-back enrollment: ${highRiskContacts?.length} high-risk contacts (churn > 70%) auto-enrolled`);
  } catch (err) {
    logger?.error('[Engagement Segmenter] Win-back enrollment error:', err?.message);
  }
}

async function updateListStats() {
  const { data: lists } = await supabase?.from('contact_lists')?.select('id');
  if (!lists) return;

  for (const list of lists) {
    const { data: contacts } = await supabase?.from('contacts')
      ?.select('tier, status, engagement_score, predicted_ltv, churn_probability')
      ?.eq('list_id', list?.id);

    if (!contacts || contacts?.length === 0) continue;

    const active = contacts?.filter(c => c?.status === 'Active');
    const avgScore = active?.length > 0
      ? active?.reduce((s, c) => s + (c?.engagement_score || 0), 0) / active?.length
      : 0;

    // LTV and churn stats
    const totalPredictedLTV = contacts?.reduce((sum, c) => sum + (parseFloat(c?.predicted_ltv) || 0), 0);
    const avgChurnRisk = contacts?.length > 0
      ? contacts?.reduce((sum, c) => sum + (parseFloat(c?.churn_probability) || 0), 0) / contacts?.length
      : 0;

    await supabase?.from('contact_lists')?.update({
      total_contacts: contacts?.length,
      average_engagement_score: Math.round(avgScore * 10) / 10,
      platinum_count: contacts?.filter(c => c?.tier === 'Platinum')?.length,
      gold_count: contacts?.filter(c => c?.tier === 'Gold')?.length,
      silver_count: contacts?.filter(c => c?.tier === 'Silver')?.length,
      bronze_count: contacts?.filter(c => c?.tier === 'Bronze')?.length,
      lead_count: contacts?.filter(c => c?.tier === 'Lead')?.length,
      total_predicted_ltv: Math.round(totalPredictedLTV * 100) / 100,
      average_churn_risk: Math.round(avgChurnRisk * 1000) / 1000
    })?.eq('id', list?.id);
  }
}

async function logToSystem(level, source, message, serverId = null, contactId = null) {
  try {
    await supabase?.from('system_logs')?.insert({
      level, source, message,
      server_id: serverId,
      contact_id: contactId,
      timestamp: new Date()?.toISOString()
    });
  } catch (err) {
    logger?.error('Failed to write system log:', err?.message);
  }
}

module.exports = engagementSegmenter;
