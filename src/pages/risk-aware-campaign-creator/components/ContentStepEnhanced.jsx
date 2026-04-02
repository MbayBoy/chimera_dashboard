import { useState, useEffect } from 'react';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const ContentStepEnhanced = ({ formData, setFormData }) => {
  const [contentScore, setContentScore] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (formData?.htmlContent && formData?.subject) {
      setAnalyzing(true);
      const timer = setTimeout(() => {
        const score = Math.random() * 4 + 6;
        const triggers = [];
        
        if (formData?.subject?.toLowerCase()?.includes('free')) triggers?.push('"FREE" in subject');
        if (formData?.subject?.toLowerCase()?.includes('!!!')) triggers?.push('Multiple exclamation marks');
        if (formData?.htmlContent?.toLowerCase()?.includes('click here')) triggers?.push('"Click here" phrase');
        
        setContentScore({
          score: score?.toFixed(1),
          spamRisk: score >= 8 ? 'Low' : score >= 5 ? 'Medium' : 'High',
          inboxRate: (score * 10)?.toFixed(0),
          triggers: triggers,
          details: `Content analyzed with ${triggers?.length} potential spam triggers detected.`
        });
        setAnalyzing(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [formData?.htmlContent, formData?.subject]);

  const getScoreColor = (score) => {
    const numScore = parseFloat(score);
    if (numScore >= 8) return 'text-success';
    if (numScore >= 5) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Step 2: Create Content
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Design your email content. Real-time spam analysis helps optimize deliverability.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="Campaign Name"
          type="text"
          placeholder="Enter campaign name"
          value={formData?.name}
          onChange={(e) => setFormData({ ...formData, name: e?.target?.value })}
          required
          description="Internal name for this campaign"
        />

        <Input
          label="Email Subject"
          type="text"
          placeholder="Enter email subject line"
          value={formData?.subject}
          onChange={(e) => setFormData({ ...formData, subject: e?.target?.value })}
          required
          description="Subject line visible to recipients"
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email Content (HTML)
            <span className="text-error ml-1">*</span>
          </label>
          <textarea
            className="w-full min-h-[200px] px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-smooth resize-y"
            placeholder="Enter your email HTML content..."
            value={formData?.htmlContent}
            onChange={(e) => setFormData({ ...formData, htmlContent: e?.target?.value })}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            HTML content for your email
          </p>
        </div>
      </div>

      {(analyzing || contentScore) && (
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-heading font-semibold text-foreground">
              Content Analysis
            </h4>
            {analyzing && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Analyzing...</span>
              </div>
            )}
          </div>

          {contentScore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-muted"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={`${(parseFloat(contentScore?.score) / 10) * 314} 314`}
                      strokeLinecap="round"
                      className={getScoreColor(contentScore?.score)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`text-3xl font-heading font-bold ${getScoreColor(contentScore?.score)}`}>
                      {contentScore?.score}
                    </div>
                    <div className="text-xs text-muted-foreground">/ 10</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getScoreColor(contentScore?.score)?.replace('text-', 'bg-')}/10 ${getScoreColor(contentScore?.score)} text-sm font-medium`}>
                    {contentScore?.spamRisk} Spam Risk
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Predicted Inbox Rate</div>
                  <div className="text-2xl font-heading font-semibold text-foreground">
                    {contentScore?.inboxRate}%
                  </div>
                </div>

                {contentScore?.triggers?.length > 0 && (
                  <div>
                    <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Detected Triggers
                    </div>
                    <div className="space-y-2">
                      {contentScore?.triggers?.map((trigger, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded text-xs">
                          <Icon name="AlertCircle" size={12} className="text-warning" />
                          <span className="text-foreground">{trigger}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <Icon name="Info" size={14} className="text-primary mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      {contentScore?.details}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentStepEnhanced;