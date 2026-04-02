const https = require('https');
const http = require('http');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// ─── XML parser ───────────────────────────────────────────────────────────────
function parseRSSXML(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex?.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block?.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '')?.trim() : '';
    };
    const title = get('title');
    const description = get('description');
    const pubDate = get('pubDate');
    const link = get('link') || block?.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    if (title) items?.push({ title, description: description?.replace(/<[^>]+>/g, '')?.slice(0, 500), pubDate, link });
  }
  return items;
}

function fetchURL(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const lib = url?.startsWith('https') ? https : http;
    const req = lib?.get(url, { headers: { 'User-Agent': 'Chimera-Intel/5.0' } }, (res) => {
      let data = '';
      res?.on('data', chunk => { data += chunk; });
      res?.on('end', () => resolve(data));
    });
    req?.setTimeout(timeout, () => { req?.destroy(); reject(new Error('Timeout')); });
    req?.on('error', reject);
  });
}

// ─── Rule-based sentiment analysis (fallback) ─────────────────────────────────
function analyzeLocally(subject, content) {
  const text = `${subject} ${content}`?.toLowerCase();
  const urgencyWords = ['urgent', 'limited', 'expires', 'last chance', 'today only', 'hurry', 'deadline', 'ending soon', 'act now'];
  const promoWords = ['sale', 'discount', 'off', 'deal', 'save', 'free', 'offer', 'promo', '%', 'coupon'];
  const positiveWords = ['great', 'amazing', 'exclusive', 'special', 'new', 'best', 'top', 'win', 'success', 'improve'];
  const negativeWords = ['problem', 'issue', 'fail', 'error', 'warning', 'alert', 'danger', 'risk'];

  const urgency_score = Math.min(10, urgencyWords?.filter(w => text?.includes(w))?.length * 2.5);
  const posCount = positiveWords?.filter(w => text?.includes(w))?.length;
  const negCount = negativeWords?.filter(w => text?.includes(w))?.length;
  const sentiment_score = Math.max(-1, Math.min(1, (posCount - negCount) * 0.3));
  const campaign_type = promoWords?.filter(w => text?.includes(w))?.length >= 2 ? 'promotional' : 'informational';

  return { sentiment_score: parseFloat(sentiment_score?.toFixed(3)), urgency_score: parseFloat(urgency_score?.toFixed(1)), campaign_type };
}

// ─── OpenAI batch sentiment analysis ─────────────────────────────────────────
async function analyzeWithOpenAI(items) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY || OPENAI_KEY === 'your-openai-api-key-here') {
    return items?.map(item => ({ ...item, ...analyzeLocally(item?.subject_line, item?.content_preview) }));
  }

  return await Promise.all(
    items?.map(async (item) => {
      try {
        const prompt = `Analyze this email campaign. Respond with JSON only:
{"sentiment_score":<-1.0 to 1.0>,"urgency_score":<0-10>,"campaign_type":"promotional|informational|transactional|newsletter"}

Subject: "${item?.subject_line}" Content:"${item?.content_preview?.slice(0, 200)}"`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 100 }),
        });
        let data = await response?.json();
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content?.replace(/```json|```/g, '')?.trim() || '{}');
        return {
          ...item,
          sentiment_score: parseFloat((parsed?.sentiment_score ?? 0)?.toFixed(3)),
          urgency_score: parseFloat((parsed?.urgency_score ?? 0)?.toFixed(1)),
          campaign_type: parsed?.campaign_type ?? 'informational',
        };
      } catch {
        return { ...item, ...analyzeLocally(item?.subject_line, item?.content_preview) };
      }
    })
  );
}

// ─── Main crawler function ────────────────────────────────────────────────────
async function runIntelligenceCrawler() {
  const feedURLs = [
    { url: 'https://blog.mailchimp.com/feed/', domain: 'mailchimp.com' },
    { url: 'https://sendgrid.com/blog/feed/', domain: 'sendgrid.com' },
    { url: 'https://www.campaignmonitor.com/blog/feed/', domain: 'campaignmonitor.com' },
    { url: 'https://litmus.com/blog/feed/', domain: 'litmus.com' },
    { url: 'https://www.klaviyo.com/blog/feed', domain: 'klaviyo.com' },
  ];

  logger?.info('[IntelligenceCrawler] Starting RSS feed crawl...');
  let newCampaigns = 0;

  for (const feed of feedURLs) {
    try {
      const xml = await fetchURL(feed?.url);
      const items = parseRSSXML(xml)?.slice(0, 5);

      if (items?.length === 0) continue;

      // Check which items are new (not already stored)
      const links = items?.map(i => i?.link)?.filter(Boolean);
      const { data: existing } = await supabase
        ?.from('competitor_campaigns')
        ?.select('link')
        ?.eq('source_domain', feed?.domain)
        ?.in('link', links);

      const existingLinks = new Set((existing || [])?.map(e => e?.link));
      const newItems = items?.filter(i => !existingLinks?.has(i?.link));

      if (newItems?.length === 0) {
        logger?.info(`[IntelligenceCrawler] No new items from ${feed?.domain}`);
        continue;
      }

      // Prepare for analysis
      const toAnalyze = newItems?.map(item => ({
        subject_line: item?.title,
        content_preview: item?.description,
        source_domain: feed?.domain,
        link: item?.link,
        pub_date: item?.pubDate,
      }));

      // Analyze sentiment
      const analyzed = await analyzeWithOpenAI(toAnalyze);

      // Store in database
      const rows = analyzed?.map(item => ({
        source_domain: item?.source_domain,
        subject_line: item?.subject_line,
        content_preview: item?.content_preview,
        link: item?.link,
        sentiment_score: item?.sentiment_score,
        urgency_score: item?.urgency_score,
        campaign_type: item?.campaign_type,
        detected_at: new Date()?.toISOString(),
      }));

      const { error } = await supabase?.from('competitor_campaigns')?.insert(rows);
      if (error) {
        logger?.error(`[IntelligenceCrawler] DB insert error for ${feed?.domain}: ${error?.message}`);
      } else {
        newCampaigns += rows?.length;
        logger?.info(`[IntelligenceCrawler] Stored ${rows?.length} new campaigns from ${feed?.domain}`);
      }
    } catch (err) {
      logger?.warn(`[IntelligenceCrawler] Failed to crawl ${feed?.domain}: ${err?.message}`);
    }
  }

  // Log to system_logs
  await supabase?.from('system_logs')?.insert({
    log_level: 'INFO',
    source: 'IntelligenceCrawler',
    message: `RSS crawl complete: ${newCampaigns} new competitor campaigns stored`,
    log_timestamp: new Date()?.toISOString(),
  });

  logger?.info(`[IntelligenceCrawler] Complete. ${newCampaigns} new campaigns stored.`);
  return newCampaigns;
}

module.exports = runIntelligenceCrawler;
