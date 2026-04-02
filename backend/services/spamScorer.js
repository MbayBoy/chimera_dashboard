/**
 * Spam content scorer - analyzes email content for spam indicators
 * No external API required - uses pattern matching
 */

const SPAM_WORDS = [
  'free', 'winner', 'won', 'prize', 'cash', 'money', 'earn', 'income',
  'click here', 'act now', 'limited time', 'urgent', 'guaranteed',
  'no obligation', 'risk free', 'satisfaction guaranteed', 'order now',
  'buy now', 'special offer', 'discount', '100%', 'amazing', 'incredible',
  'unsubscribe', 'opt out', 'remove', 'dear friend', 'congratulations',
  'you have been selected', 'million dollars', 'nigerian', 'inheritance',
  'wire transfer', 'bank account', 'social security', 'password'
];

const SPAM_PATTERNS = [
  /\$\d+/g,                    // Dollar amounts
  /\d+%\s*(off|discount)/gi,   // Percentage discounts
  /[A-Z]{5,}/g,                // Excessive caps
  /!{2,}/g,                    // Multiple exclamation marks
  /\?{2,}/g,                   // Multiple question marks
  /click\s+here/gi,            // Click here
  /unsubscribe/gi,             // Unsubscribe
  /mailto:/gi,                 // Mailto links
  /\bfree\b/gi,                // Free
  /\bviagra\b/gi,              // Pharmaceutical spam
  /\bcasino\b/gi,              // Gambling
  /\bpoker\b/gi                // Gambling
];

/**
 * Score email content for spam likelihood
 * @param {string} subject - Email subject line
 * @param {string} bodyHtml - HTML body content
 * @param {string} bodyText - Plain text body
 * @returns {object} Spam score and breakdown
 */
function scoreContent(subject, bodyHtml, bodyText) {
  const issues = [];
  let score = 0;

  const fullText = `${subject} ${bodyText || ''} ${stripHtml(bodyHtml || '')}`;
  const subjectText = subject || '';

  // 1. Check subject line
  if (subjectText?.length === 0) {
    issues?.push({ type: 'missing_subject', severity: 'high', penalty: 20 });
    score += 20;
  }

  // 2. ALL CAPS in subject
  const capsRatio = (subjectText?.match(/[A-Z]/g) || [])?.length / Math.max(subjectText?.length, 1);
  if (capsRatio > 0.5 && subjectText?.length > 5) {
    issues?.push({ type: 'excessive_caps_subject', severity: 'medium', penalty: 15 });
    score += 15;
  }

  // 3. Spam words
  let spamWordCount = 0;
  SPAM_WORDS?.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = fullText?.match(regex);
    if (matches) {
      spamWordCount += matches?.length;
    }
  });

  if (spamWordCount > 0) {
    const penalty = Math.min(spamWordCount * 5, 30);
    issues?.push({ type: 'spam_words', count: spamWordCount, severity: 'medium', penalty });
    score += penalty;
  }

  // 4. Spam patterns
  let patternCount = 0;
  SPAM_PATTERNS?.forEach(pattern => {
    const matches = fullText?.match(pattern);
    if (matches) patternCount += matches?.length;
  });

  if (patternCount > 2) {
    const penalty = Math.min(patternCount * 3, 20);
    issues?.push({ type: 'spam_patterns', count: patternCount, severity: 'medium', penalty });
    score += penalty;
  }

  // 5. HTML/text ratio
  const htmlLength = (bodyHtml || '')?.length;
  const textLength = (bodyText || '')?.length;
  if (htmlLength > 0 && textLength === 0) {
    issues?.push({ type: 'no_text_version', severity: 'low', penalty: 5 });
    score += 5;
  }

  // 6. Image-only email
  const imgCount = (bodyHtml || '')?.match(/<img/gi)?.length || 0;
  const textWordCount = (bodyText || '')?.split(/\s+/)?.filter(Boolean)?.length;
  if (imgCount > 0 && textWordCount < 10) {
    issues?.push({ type: 'image_heavy', severity: 'medium', penalty: 10 });
    score += 10;
  }

  // 7. Excessive links
  const linkCount = (bodyHtml || '')?.match(/<a\s/gi)?.length || 0;
  if (linkCount > 10) {
    issues?.push({ type: 'excessive_links', count: linkCount, severity: 'low', penalty: 5 });
    score += 5;
  }

  const finalScore = Math.min(score, 100);
  const verdict = finalScore < 20 ? 'clean' : finalScore < 50 ? 'suspicious' : 'spam';

  return {
    score: finalScore,
    verdict,
    issues,
    inboxPrediction: Math.max(0, 100 - finalScore),
    recommendations: issues?.map(i => getRecommendation(i?.type))
  };
}

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, ' ')?.replace(/\s+/g, ' ')?.trim();
}

function getRecommendation(issueType) {
  const recommendations = {
    missing_subject: 'Add a clear, descriptive subject line',
    excessive_caps_subject: 'Avoid ALL CAPS in subject line',
    spam_words: 'Remove or replace spam trigger words',
    spam_patterns: 'Reduce use of spam patterns like dollar signs and excessive punctuation',
    no_text_version: 'Add a plain text version of your email',
    image_heavy: 'Add more text content alongside images',
    excessive_links: 'Reduce the number of links in your email'
  };
  return recommendations?.[issueType] || 'Review email content';
}

module.exports = { scoreContent };
