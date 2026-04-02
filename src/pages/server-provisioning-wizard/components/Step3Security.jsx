import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const Step3Security = ({ config, updateConfig }) => {
  const [generatingDKIM, setGeneratingDKIM] = useState(false);
  const [dkimKeys, setDkimKeys] = useState(null);

  const generateDKIMKeys = () => {
    setGeneratingDKIM(true);
    setTimeout(() => {
      const mockPublicKey = 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a7...(truncated)';
      const mockPrivateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA2a7...\n-----END RSA PRIVATE KEY-----';
      setDkimKeys({ public: mockPublicKey, private: mockPrivateKey });
      updateConfig({
        dkimGenerated: true,
        spfRecord: `v=spf1 ip4:${config?.ipAddress || '0.0.0.0'} include:_spf.${config?.domain || 'domain.com'} ~all`
      });
      setGeneratingDKIM(false);
    }, 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Security Configuration</h2>
        <p className="text-sm text-muted-foreground">Configure email authentication records. These are critical for deliverability.</p>
      </div>
      <div className="space-y-6">
        {/* SSH Key */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Icon name="Key" size={16} className="text-primary" />
            SSH Access Key <span className="text-red-400">*</span>
          </h3>
          <textarea
            value={config?.sshKey}
            onChange={e => updateConfig({ sshKey: e?.target?.value })}
            placeholder="Paste your SSH public key here (ssh-rsa AAAA...)"
            rows={3}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">The Chimera Agent will use this key to connect to your server</p>
        </div>

        {/* DKIM */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Icon name="ShieldCheck" size={16} className="text-green-400" />
              DKIM Key Generation
            </h3>
            {config?.dkimGenerated && (
              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded font-medium flex items-center gap-1">
                <Icon name="CheckCircle2" size={12} /> Generated
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically generates a 2048-bit RSA key pair. The public key will be added to DNS, the private key installed on the server.
          </p>
          {!config?.dkimGenerated ? (
            <button
              onClick={generateDKIMKeys}
              disabled={generatingDKIM}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generatingDKIM ? (
                <><Icon name="Loader2" size={14} className="animate-spin" /> Generating Keys...</>
              ) : (
                <><Icon name="Key" size={14} /> Generate DKIM Keys</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Public Key (DNS TXT Record)</label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-mono text-foreground break-all">{dkimKeys?.public}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-green-500/5 border border-green-500/20 rounded">
                <Icon name="CheckCircle2" size={12} className="text-green-400" />
                <p className="text-xs text-green-400">DNS record will be automatically created. Private key will be installed on server during deployment.</p>
              </div>
            </div>
          )}
        </div>

        {/* SPF */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Icon name="Shield" size={16} className="text-blue-400" />
            SPF Record
          </h3>
          {config?.spfRecord ? (
            <div>
              <div className="p-3 bg-muted rounded-lg mb-2">
                <p className="text-xs font-mono text-foreground">{config?.spfRecord}</p>
              </div>
              <p className="text-xs text-muted-foreground">Auto-generated from your IP address. Will be added to DNS automatically.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">SPF record will be auto-generated after DKIM key generation.</p>
          )}
        </div>

        {/* DMARC */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Icon name="ShieldAlert" size={16} className="text-yellow-400" />
            DMARC Policy
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'none', label: 'None (Monitor)', desc: 'Report only, no action taken. Good for new domains.', color: 'border-blue-500/50' },
              { value: 'quarantine', label: 'Quarantine', desc: 'Failed emails go to spam. Recommended for production.', color: 'border-yellow-500/50' },
              { value: 'reject', label: 'Reject', desc: 'Failed emails are rejected. Maximum protection.', color: 'border-red-500/50' }
            ]?.map(policy => (
              <button
                key={policy?.value}
                onClick={() => updateConfig({ dmarcPolicy: policy?.value })}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  config?.dmarcPolicy === policy?.value
                    ? `${policy?.color} bg-primary/5`
                    : 'border-border hover:border-border/80'
                }`}
              >
                <div className="font-medium text-sm text-foreground mb-1">{policy?.label}</div>
                <p className="text-xs text-muted-foreground">{policy?.desc}</p>
                {config?.dmarcPolicy === policy?.value && (
                  <Icon name="CheckCircle2" size={14} className="text-primary mt-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Security;
