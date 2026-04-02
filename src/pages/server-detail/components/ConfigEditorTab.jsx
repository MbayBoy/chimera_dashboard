import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ConfigEditorTab = ({ serverId }) => {
  const [config, setConfig] = useState('');
  const [originalConfig, setOriginalConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [lineNumbers, setLineNumbers] = useState([]);

  useEffect(() => {
    fetchConfig();
  }, [serverId]);

  useEffect(() => {
    const lines = config?.split('\n');
    setLineNumbers(Array.from({ length: lines?.length }, (_, i) => i + 1));
  }, [config]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockConfig = `# Postfix main.cf configuration
# Server: ${serverId}
# Last modified: ${new Date()?.toLocaleString()}

# Network settings
myhostname = mail.example.com
mydomain = example.com
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4

# Mail queue settings
maximal_queue_lifetime = 1d
bounce_queue_lifetime = 1d
maximal_backoff_time = 4000s
minimal_backoff_time = 300s
queue_run_delay = 300s

# TLS settings
smtpd_tls_cert_file = /etc/ssl/certs/mail.crt
smtpd_tls_key_file = /etc/ssl/private/mail.key
smtpd_use_tls = yes
smtpd_tls_security_level = may
smtp_tls_security_level = may

# SASL authentication
smtpd_sasl_auth_enable = yes
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_security_options = noanonymous

# Restrictions
smtpd_recipient_restrictions = 
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination

# Rate limiting
smtpd_client_connection_rate_limit = 100
smtpd_client_message_rate_limit = 100
smtpd_client_recipient_rate_limit = 200

# Message size
message_size_limit = 10485760

# Virtual domains
virtual_mailbox_domains = mysql:/etc/postfix/mysql-virtual-mailbox-domains.cf
virtual_mailbox_maps = mysql:/etc/postfix/mysql-virtual-mailbox-maps.cf
virtual_alias_maps = mysql:/etc/postfix/mysql-virtual-alias-maps.cf`;

      setConfig(mockConfig);
      setOriginalConfig(mockConfig);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching config:', error);
      setIsLoading(false);
    }
  };

  const handleConfigChange = (e) => {
    const newConfig = e?.target?.value;
    setConfig(newConfig);
    setHasChanges(newConfig !== originalConfig);
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setOriginalConfig(config);
      setHasChanges(false);
      setSaveStatus('success');
      
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(originalConfig);
    setHasChanges(false);
    setSaveStatus(null);
  };

  const handleDownload = () => {
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `main.cf-${serverId}-${Date.now()}.txt`;
    document.body?.appendChild(a);
    a?.click();
    document.body?.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 md:py-16">
        <div className="text-center">
          <Icon name="Loader2" size={48} className="text-primary animate-spin mx-auto mb-4" />
          <p className="text-sm md:text-base text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Postfix Configuration Editor
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Edit main.cf configuration file for this mail server
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconName="Download"
            iconPosition="left"
            onClick={handleDownload}
          >
            Download
          </Button>
          
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              iconName="RotateCcw"
              iconPosition="left"
              onClick={handleReset}
            >
              Reset
            </Button>
          )}
          
          <Button
            variant="default"
            size="sm"
            iconName="Save"
            iconPosition="left"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            loading={isSaving}
          >
            Save Changes
          </Button>
        </div>
      </div>
      {saveStatus && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          saveStatus === 'success' ?'bg-success/10 border-success/20 text-success' :'bg-error/10 border-error/20 text-error'
        }`}>
          <Icon 
            name={saveStatus === 'success' ? 'CheckCircle2' : 'XCircle'} 
            size={20} 
          />
          <span className="text-sm font-medium">
            {saveStatus === 'success' ?'Configuration saved successfully' :'Failed to save configuration'}
          </span>
        </div>
      )}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="FileCode" size={20} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground font-mono">
              /etc/postfix/main.cf
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {config?.split('\n')?.length} lines
            </span>
            {hasChanges && (
              <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-medium border border-warning/20">
                Modified
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <div className="flex">
            <div className="bg-muted border-r border-border px-3 py-4 text-right select-none">
              {lineNumbers?.map((num) => (
                <div 
                  key={num} 
                  className="text-xs text-muted-foreground font-mono leading-6"
                >
                  {num}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto">
              <textarea
                value={config}
                onChange={handleConfigChange}
                className="w-full min-h-[400px] md:min-h-[500px] p-4 bg-card text-foreground font-mono text-sm leading-6 resize-none focus:outline-none"
                spellCheck="false"
                style={{ 
                  tabSize: 4,
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace"
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-muted px-4 py-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Icon name="Info" size={14} />
              <span>Press Ctrl+S to save</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="AlertTriangle" size={14} />
              <span>Changes require service restart</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-warning mb-1">
              Configuration Warning
            </h4>
            <p className="text-sm text-muted-foreground">
              Incorrect configuration may cause mail delivery failures. Always backup before making changes and test thoroughly. The Postfix service will be automatically restarted after saving.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigEditorTab;