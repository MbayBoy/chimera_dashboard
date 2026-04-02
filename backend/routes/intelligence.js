const express = require('express');
const router = express?.Router();
const https = require('https');
const http = require('http');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

router?.use(authenticateToken);

// ─── Simple XML parser (no external deps) ─────────────────────────────────────
function parseRSSXML(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex?.exec(xml)) !== null) {
    const block = match?.[1];
    const get = (tag) => {
      const m = block?.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? (m?.[1] || m?.[2] || '')?.trim() : '';
    };
    const title = get('title');
    const description = get('description');
    const pubDate = get('pubDate');
    const link = get('link') || block?.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    if (title) items?.push({ title, description: description?.replace(/<[^>]+>/g, '')?.slice(0, 500), pubDate, link });
  }
  return items;
}

// ─── Fetch URL helper ─────────────────────────────────────────────────────────
function fetchURL(url, timeout = 8000) {
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

// ─── GET /api/intelligence/rss-feeds ─────────────────────────────────────────
router?.get('/rss-feeds', asyncHandler(async (req, res) => {
  const { domains } = req?.query;

  // Default competitor RSS feed URLs (can be overridden via query)
  const feedURLs = domains
    ? domains?.split(',')?.map(d => `https://${d?.trim()}/feed`)
    : [
        'https://blog.mailchimp.com/feed/',
        'https://sendgrid.com/blog/feed/',
        'https://www.campaignmonitor.com/blog/feed/',
        'https://litmus.com/blog/feed/',
      ];

  const results = await Promise.allSettled(
    feedURLs?.map(async (url) => {
      try {
        const xml = await fetchURL(url);
        const items = parseRSSXML(xml);
        const domain = new URL(url)?.hostname?.replace('www.', '');
        return { domain, url, items: items?.slice(0, 10), success: true };
      } catch (err) {
        const domain = url?.replace(/https?:\/\//, '')?.split('/')?.[0];
        return { domain, url, items: [], success: false, error: err?.message };
      }
    })
  );

  const feeds = results?.map(r => r?.value || r?.reason);
  const totalItems = feeds?.reduce((sum, f) => sum + (f?.items?.length || 0), 0);

  logger?.info(`[Intelligence] RSS fetch: ${feeds?.filter(f => f?.success)?.length}/${feedURLs?.length} feeds, ${totalItems} items`);
  res?.json({ feeds, totalItems, fetchedAt: new Date()?.toISOString() });
}));

// ─── POST /api/intelligence/analyze-sentiment ─────────────────────────────────
router?.post('/analyze-sentiment', asyncHandler(async (req, res) => {
  const { items } = req?.body; // [{ subject_line, content_preview, source_domain }]

  if (!items || !Array.isArray(items) || items?.length === 0) {
    return res?.status(400)?.json({ error: 'items array is required' });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const analyzed = await Promise.all(
    items?.slice(0, 20)?.map(async (item) => {
      try {
        let sentiment_score = 0;
        let urgency_score = 0;
        let campaign_type = 'informational';
        let keywords = [];

        if (OPENAI_KEY && OPENAI_KEY !== 'your-openai-api-key-here') {
          // Use OpenAI GPT-4 for NLP analysis
          const prompt = `Analyze this email campaign for sentiment and classification.
Subject: "${item?.subject_line}"
Content: "${item?.content_preview?.slice(0, 300)}"

Respond with JSON only:
{
  "sentiment_score": <number -1.0 to 1.0, negative=negative, positive=positive>,
  "urgency_score": <number 0-10>,
  "campaign_type": <"promotional"|"informational"|"transactional"|"newsletter">,
  "keywords": [<top 5 keywords>]
}`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              max_tokens: 200,
            }),
          });
          let data = await response?.json();
          const text = data?.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(text?.replace(/```json|```/g, '')?.trim());
          sentiment_score = parsed?.sentiment_score ?? 0;
          urgency_score = parsed?.urgency_score ?? 0;
          campaign_type = parsed?.campaign_type ?? 'informational';
          keywords = parsed?.keywords ?? [];
        } else {
          // Fallback: rule-based NLP
          const text = `${item?.subject_line} ${item?.content_preview}`?.toLowerCase();
          const urgencyWords = ['urgent', 'limited', 'expires', 'last chance', 'today only', 'hurry', 'now', 'deadline', 'ending soon'];
          const promoWords = ['sale', 'discount', 'off', 'deal', 'save', 'free', 'offer', 'promo', '%'];
          const positiveWords = ['great', 'amazing', 'exclusive', 'special', 'new', 'best', 'top', 'win', 'success'];
          const negativeWords = ['problem', 'issue', 'fail', 'error', 'warning', 'alert', 'danger'];

          urgency_score = Math.min(10, urgencyWords?.filter(w => text?.includes(w))?.length * 2.5);
          const posCount = positiveWords?.filter(w => text?.includes(w))?.length;
          const negCount = negativeWords?.filter(w => text?.includes(w))?.length;
          sentiment_score = Math.max(-1, Math.min(1, (posCount - negCount) * 0.3));
          campaign_type = promoWords?.filter(w => text?.includes(w))?.length >= 2 ? 'promotional' : 'informational';
          keywords = text?.split(/\s+/)?.filter(w => w?.length > 4)?.slice(0, 5);
        }

        return {
          ...item,
          sentiment_score: parseFloat(sentiment_score?.toFixed(3)),
          urgency_score: parseFloat(urgency_score?.toFixed(1)),
          campaign_type,
          keywords,
          analyzed: true,
        };
      } catch (err) {
        logger?.warn(`[Intelligence] Sentiment analysis failed for item: ${err?.message}`);
        return { ...item, sentiment_score: 0, urgency_score: 0, campaign_type: 'informational', keywords: [], analyzed: false };
      }
    })
  );

  res?.json({ analyzed, count: analyzed?.length });
}));

// ─── GET /api/intelligence/competitor-campaigns ───────────────────────────────
router?.get('/competitor-campaigns', asyncHandler(async (req, res) => {
  const { limit = 50, source_domain, campaign_type } = req?.query;

  let query = supabase
    ?.from('competitor_campaigns')
    ?.select('*')
    ?.order('detected_at', { ascending: false })
    ?.limit(parseInt(limit));

  if (source_domain) query = query?.eq('source_domain', source_domain);
  if (campaign_type) query = query?.eq('campaign_type', campaign_type);

  const { data, error } = await query;
  if (error) throw error;

  res?.json({ data: data || [], count: data?.length || 0 });
}));

// ─── GET /api/intelligence/trending-topics ────────────────────────────────────
router?.get('/trending-topics', asyncHandler(async (req, res) => {
  const { days = 7 } = req?.query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)?.toISOString();

  const { data, error } = await supabase
    ?.from('competitor_campaigns')
    ?.select('subject_line, content_preview, campaign_type, sentiment_score, urgency_score, detected_at')
    ?.gte('detected_at', since)
    ?.order('detected_at', { ascending: false });

  if (error) throw error;

  // Extract keyword frequency
  const wordFreq = {};
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'your', 'with', 'this', 'that', 'from', 'they', 'will', 'have', 'more', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'into', 'year', 'good', 'some', 'could', 'them', 'than', 'then', 'look', 'only', 'come', 'over', 'also', 'back', 'after', 'first', 'well', 'even', 'want', 'because', 'these', 'give', 'most']);

  (data || [])?.forEach(row => {
    const text = `${row?.subject_line} ${row?.content_preview}`?.toLowerCase();
    text?.split(/[\s,!?."']+/)?.forEach(word => {
      const w = word?.replace(/[^a-z]/g, '');
      if (w?.length > 3 && !stopWords?.has(w)) {
        wordFreq[w] = (wordFreq?.[w] || 0) + 1;
      }
    });
  });

  const trending = Object.entries(wordFreq)
    ?.sort((a, b) => b?.[1] - a?.[1])
    ?.slice(0, 20)
    ?.map(([word, count]) => ({ word, count }));

  // Sentiment breakdown
  const sentimentBreakdown = {
    positive: (data || [])?.filter(r => r?.sentiment_score > 0.2)?.length,
    neutral: (data || [])?.filter(r => r?.sentiment_score >= -0.2 && r?.sentiment_score <= 0.2)?.length,
    negative: (data || [])?.filter(r => r?.sentiment_score < -0.2)?.length,
  };

  // Campaign type breakdown
  const typeBreakdown = {};
  (data || [])?.forEach(r => {
    typeBreakdown[r?.campaign_type] = (typeBreakdown?.[r?.campaign_type] || 0) + 1;
  });

  res?.json({ trending, sentimentBreakdown, typeBreakdown, totalCampaigns: data?.length || 0, period: `${days} days` });
}));

module.exports = router;
