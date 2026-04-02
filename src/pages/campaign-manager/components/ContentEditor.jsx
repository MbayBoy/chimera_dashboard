import { useState, useEffect } from 'react';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const ContentEditor = ({ formData, onChange, onScoreUpdate }) => {
  const [activeTab, setActiveTab] = useState('html');
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (formData?.subject || formData?.htmlContent || formData?.textContent) {
      calculateContentScore();
    }
  }, [formData?.subject, formData?.htmlContent, formData?.textContent]);

  const calculateContentScore = async () => {
    setIsCalculating(true);
    
    setTimeout(() => {
      const spamTriggers = [];
      let baseScore = 10;
      
      const content = `${formData?.subject} ${formData?.htmlContent} ${formData?.textContent}`?.toLowerCase();
      
      if (content?.includes('free') || content?.includes('click here') || content?.includes('act now')) {
        spamTriggers?.push('SUSPICIOUS_WORDS');
        baseScore -= 1.5;
      }
      
      if (content?.includes('!!!') || content?.includes('$$$')) {
        spamTriggers?.push('EXCESSIVE_PUNCTUATION');
        baseScore -= 1.0;
      }
      
      if (formData?.htmlContent && !formData?.textContent) {
        spamTriggers?.push('HTML_ONLY');
        baseScore -= 0.5;
      }
      
      if (formData?.htmlContent) {
        spamTriggers?.push('HTML_MESSAGE');
        baseScore -= 0.3;
      }
      
      if (!content?.includes('unsubscribe')) {
        spamTriggers?.push('NO_UNSUBSCRIBE');
        baseScore -= 2.0;
      }
      
      if (content?.length < 100) {
        spamTriggers?.push('SHORT_CONTENT');
        baseScore -= 1.0;
      }
      
      if (!spamTriggers?.includes('SUSPICIOUS_WORDS') && !spamTriggers?.includes('EXCESSIVE_PUNCTUATION')) {
        spamTriggers?.push('BAYES_00');
        baseScore += 0.5;
      }
      
      const finalScore = Math.max(0, Math.min(10, baseScore))?.toFixed(1);
      
      onScoreUpdate({
        score: finalScore,
        triggers: spamTriggers,
        details: `SpamAssassin Result: ${(10 - parseFloat(finalScore))?.toFixed(1)} points (${spamTriggers?.join(', ')})`
      });
      
      setIsCalculating(false);
    }, 800);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Input
          label="Email Subject"
          type="text"
          placeholder="Enter campaign subject line"
          value={formData?.subject}
          onChange={(e) => onChange({ ...formData, subject: e?.target?.value })}
          required
          description="Keep it concise and avoid spam trigger words"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-foreground">
            Email Content
          </label>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
                activeTab === 'html' ?'bg-card text-foreground shadow-sm' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Code" size={14} className="inline mr-1.5" />
              HTML
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
                activeTab === 'text' ?'bg-card text-foreground shadow-sm' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="FileText" size={14} className="inline mr-1.5" />
              Plain Text
            </button>
          </div>
        </div>

        {activeTab === 'html' && (
          <div>
            <textarea
              value={formData?.htmlContent}
              onChange={(e) => onChange({ ...formData, htmlContent: e?.target?.value })}
              placeholder="Enter HTML content for your email..."
              className="w-full h-64 px-4 py-3 bg-input border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none scrollbar-thin"
              required
            />
            <p className="text-xs text-muted-foreground mt-2">
              Use valid HTML markup. Include both HTML and plain text versions for best deliverability.
            </p>
          </div>
        )}

        {activeTab === 'text' && (
          <div>
            <textarea
              value={formData?.textContent}
              onChange={(e) => onChange({ ...formData, textContent: e?.target?.value })}
              placeholder="Enter plain text version of your email..."
              className="w-full h-64 px-4 py-3 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none scrollbar-thin"
              required
            />
            <p className="text-xs text-muted-foreground mt-2">
              Plain text fallback for email clients that don't support HTML.
            </p>
          </div>
        )}
      </div>
      {isCalculating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Analyzing content...
        </div>
      )}
    </div>
  );
};

export default ContentEditor;