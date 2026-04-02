import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { filterDuplicateContacts, getCampaignSentStats } from '../../../utils/duplicatePrevention';

const DuplicateCheckPanel = ({ campaignId, contacts = [], onProceed }) => {
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = () => {
    const checkResult = filterDuplicateContacts(campaignId, contacts);
    const stats = getCampaignSentStats(campaignId);
    setResult({ ...checkResult, previouslySent: stats?.totalSent });
    setChecked(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="UserCheck" size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Duplicate Contact Prevention</h3>
          <p className="text-xs text-muted-foreground">Ensure no contact receives this campaign twice</p>
        </div>
      </div>
      {!checked ? (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            This will check {contacts?.length?.toLocaleString()} contacts against the campaign send history
            to prevent duplicate sends.
          </p>
          <Button variant="outline" size="sm" iconName="Search" iconPosition="left" onClick={handleCheck}>
            Run Duplicate Check
          </Button>
        </div>
      ) : result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-xl font-mono font-bold text-foreground">{result?.originalCount?.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Contacts</div>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <div className="text-xl font-mono font-bold text-success">{result?.filtered?.length?.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Will Receive</div>
            </div>
            <div className={`rounded-lg p-3 text-center ${result?.duplicateCount > 0 ? 'bg-warning/10' : 'bg-muted'}`}>
              <div className={`text-xl font-mono font-bold ${result?.duplicateCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                {result?.duplicateCount?.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Duplicates Removed</div>
            </div>
          </div>

          {result?.previouslySent > 0 && (
            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Icon name="Info" size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground">
                {result?.previouslySent?.toLocaleString()} contacts have previously received this campaign and will be excluded.
              </p>
            </div>
          )}

          {result?.duplicateCount > 0 ? (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <Icon name="AlertTriangle" size={14} className="text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground">
                {result?.duplicateCount} duplicate contacts detected and removed. Only {result?.filtered?.length?.toLocaleString()} unique contacts will receive this campaign.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
              <Icon name="CheckCircle" size={14} className="text-success mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground">No duplicates found. All {result?.filtered?.length?.toLocaleString()} contacts are unique.</p>
            </div>
          )}

          {onProceed && (
            <Button
              variant="default"
              size="sm"
              iconName="ArrowRight"
              iconPosition="right"
              onClick={() => onProceed(result?.filtered)}
            >
              Proceed with {result?.filtered?.length?.toLocaleString()} Contacts
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DuplicateCheckPanel;
