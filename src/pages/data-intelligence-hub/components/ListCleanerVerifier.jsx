import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { supabase } from '../../../lib/supabase';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3001';

const ListCleanerVerifier = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    selectedList: '',
    removeDuplicates: true,
    removeRoleBased: true,
    removeToxic: true,
    syntaxValidation: true,
    liveVerification: true,
    confidenceThreshold: 85
  });
  const [verificationJob, setVerificationJob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [contactLists, setContactLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const pollRef = useRef(null);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase?.auth?.getSession();
    return session?.access_token || null;
  };

  const fetchVerificationHistory = useCallback(async () => {
    try {
      const { data } = await supabase?.from('verification_jobs')?.select('*, contact_lists(name)')?.order('created_at', { ascending: false })?.limit(10);
      if (data) setVerificationHistory(data);
    } catch (err) { console.error('Failed to fetch verification history:', err); }
  }, []);

  useEffect(() => {
    const fetchLists = async () => {
      setLoadingLists(true);
      try {
        const { data, error } = await supabase?.from('contact_lists')?.select('id, name, total_contacts')?.order('created_at', { ascending: false });
        if (!error && data) {
          setContactLists(data?.map(l => ({ value: l?.id, label: `${l?.name} (${(l?.total_contacts || 0)?.toLocaleString()} contacts)` })));
        }
      } catch (err) { console.error('Failed to fetch lists:', err); }
      finally { setLoadingLists(false); }
    };
    fetchLists();
    fetchVerificationHistory();
  }, [fetchVerificationHistory]);

  const stopPolling = useCallback(() => {
    if (pollRef?.current) { clearInterval(pollRef?.current); pollRef.current = null; }
  }, []);

  const pollJobStatus = useCallback(async (jobId) => {
    try {
      const { data: job, error } = await supabase?.from('verification_jobs')?.select('*')?.eq('id', jobId)?.single();
      if (error || !job) return;
      setVerificationJob(job);
      setProgress(job?.progress || 0);
      if (job?.status === 'Completed') {
        stopPolling();
        setCurrentStep(5);
        fetchVerificationHistory();
      } else if (job?.status === 'Failed') {
        stopPolling();
        setErrorMsg('Verification job was cancelled or failed.');
        setCurrentStep(3);
      }
    } catch (err) { console.error('Poll error:', err); }
  }, [stopPolling, fetchVerificationHistory]);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  const handleStartVerification = async () => {
    setStarting(true);
    setErrorMsg(null);
    try {
      const { data: job, error } = await supabase?.from('verification_jobs')?.insert({
        list_id: formData?.selectedList,
        status: 'Running',
        progress: 0,
        options: { remove_duplicates: formData?.removeDuplicates, verify_smtp: formData?.liveVerification, threshold: formData?.confidenceThreshold },
        created_at: new Date()?.toISOString(),
      })?.select()?.single();
      if (error) throw error;
      if (!job) throw new Error('Failed to start verification');
      setVerificationJob(job);
      setProgress(0);
      setCurrentStep(4);
      pollRef.current = setInterval(() => pollJobStatus(job?.id), 2000);
    } catch (err) {
      setErrorMsg(err?.message);
    } finally { setStarting(false); }
  };

  const handleCancelVerification = async () => {
    if (!verificationJob?.id) return;
    setCancelling(true);
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      const token = session?.access_token || null;
      const { error: fnError } = await supabase?.functions?.invoke('verification-worker', {
        body: { action: 'cancel', jobId: verificationJob?.id },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (fnError) {
        // Fallback: update job status directly in DB
        await supabase?.from('verification_jobs')?.update({ status: 'Cancelled' })?.eq('id', verificationJob?.id);
      }
      stopPolling();
      setErrorMsg('Verification job cancelled.');
      setCurrentStep(3);
    } catch (err) { setErrorMsg(err?.message); }
    finally { setCancelling(false); }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {[1, 2, 3, 4, 5]?.map((step) => (
        <div key={step} className="flex items-center flex-1">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= step ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}>
            {currentStep > step ? <Icon name="Check" size={20} /> : <span className="text-sm font-medium">{step}</span>}
          </div>
          {step < 5 && <div className={`flex-1 h-0.5 mx-2 ${currentStep > step ? 'bg-primary' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Step 1: Select Contact List</h3>
        <p className="text-sm text-muted-foreground mb-6">Choose the contact list you want to clean and verify</p>
      </div>
      {errorMsg && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{errorMsg}</div>}
      <Select label="Contact List" placeholder={loadingLists ? 'Loading lists...' : 'Select a list'} options={contactLists} value={formData?.selectedList} onChange={(value) => setFormData({ ...formData, selectedList: value })} />
      {verificationHistory?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-foreground mb-3">Recent Verification Jobs</h4>
          <div className="space-y-2">
            {verificationHistory?.slice(0, 5)?.map(job => (
              <div key={job?.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2 text-sm">
                <span className="text-muted-foreground truncate max-w-[180px]">{job?.contact_lists?.name || job?.list_id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job?.status === 'Completed' ? 'bg-green-500/20 text-green-400' : job?.status === 'Running' ? 'bg-blue-500/20 text-blue-400' : job?.status === 'Failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{job?.status}</span>
                <span className="text-muted-foreground text-xs">{new Date(job?.created_at)?.toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => setCurrentStep(2)} disabled={!formData?.selectedList} iconName="ArrowRight" iconPosition="right">Next: Choose Options</Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Step 2: Choose Cleaning Options</h3>
        <p className="text-sm text-muted-foreground mb-6">Select which cleaning and verification operations to perform</p>
      </div>
      <div className="bg-muted rounded-lg p-6 space-y-4">
        <Checkbox label="Remove Duplicates" description="Remove duplicate email addresses from the list" checked={formData?.removeDuplicates} onChange={(e) => setFormData({ ...formData, removeDuplicates: e?.target?.checked })} />
        <Checkbox label="Remove Role-Based Emails" description="Remove generic addresses like info@, support@, admin@" checked={formData?.removeRoleBased} onChange={(e) => setFormData({ ...formData, removeRoleBased: e?.target?.checked })} />
        <Checkbox label="Remove Toxic Domains" description="Remove known spam traps and disposable email domains" checked={formData?.removeToxic} onChange={(e) => setFormData({ ...formData, removeToxic: e?.target?.checked })} />
        <Checkbox label="Syntax Validation" description="Validate email format and structure" checked={formData?.syntaxValidation} onChange={(e) => setFormData({ ...formData, syntaxValidation: e?.target?.checked })} />
        <div className="border-t border-border pt-4">
          <Checkbox label="Run Live Email Verification" description="Perform SMTP verification to check if emails are deliverable (recommended)" checked={formData?.liveVerification} onChange={(e) => setFormData({ ...formData, liveVerification: e?.target?.checked })} />
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(1)} iconName="ArrowLeft">Back</Button>
        <Button onClick={() => setCurrentStep(3)} iconName="ArrowRight" iconPosition="right">Next: Set Threshold</Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Step 3: Set Confidence Threshold</h3>
        <p className="text-sm text-muted-foreground mb-6">Set the minimum confidence score required to keep an email address</p>
      </div>
      {errorMsg && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{errorMsg}</div>}
      <div className="bg-muted rounded-lg p-6">
        <div className="mb-6">
          <label className="text-sm font-medium text-foreground mb-4 block">Minimum Confidence Score: {formData?.confidenceThreshold}%</label>
          <input type="range" min="0" max="100" value={formData?.confidenceThreshold} onChange={(e) => setFormData({ ...formData, confidenceThreshold: parseInt(e?.target?.value) })} className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0% (Keep All)</span><span>50% (Moderate)</span><span>100% (Strict)</span>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Icon name="Info" size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-2"><strong className="text-foreground">Recommended: 85%</strong></p>
              <p>Emails with confidence scores below this threshold will be marked as "Bounced" and excluded from future campaigns.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(2)} iconName="ArrowLeft">Back</Button>
        <Button onClick={handleStartVerification} disabled={starting} iconName="Play" iconPosition="right">{starting ? 'Starting...' : 'Execute Verification'}</Button>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const summary = verificationJob?.results_summary || {};
    const stage = verificationJob?.current_stage || (progress < 25 ? 'Stage 1: Syntax Validation' : progress < 50 ? 'Stage 2: DNS/MX Lookup' : progress < 75 ? 'Stage 3: SMTP Verification' : 'Stage 4: ML Scoring');
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Step 4: Verification in Progress</h3>
          <p className="text-sm text-muted-foreground mb-6">Please wait while we verify your contact list</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className="text-sm font-medium text-primary">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stage}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2"><Icon name="FileText" size={16} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Stage</span></div>
              <div className="text-sm font-medium text-foreground">{stage}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2"><Icon name="Users" size={16} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Total</span></div>
              <div className="text-sm font-medium text-foreground">{(verificationJob?.total_to_verify || 0)?.toLocaleString()}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2"><Icon name="CheckCircle" size={16} className="text-success" /><span className="text-xs text-muted-foreground">Verified</span></div>
              <div className="text-sm font-medium text-foreground">{(verificationJob?.verified_count || 0)?.toLocaleString()}</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2"><Icon name="Clock" size={16} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Remaining</span></div>
              <div className="text-sm font-medium text-foreground">{((verificationJob?.total_to_verify || 0) - (verificationJob?.verified_count || 0))?.toLocaleString()}</div>
            </div>
          </div>
          {(summary?.valid > 0 || summary?.invalid > 0) && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="text-center"><div className="text-lg font-bold text-green-400">{summary?.valid || 0}</div><div className="text-xs text-muted-foreground">Valid</div></div>
              <div className="text-center"><div className="text-lg font-bold text-red-400">{summary?.invalid || 0}</div><div className="text-xs text-muted-foreground">Invalid</div></div>
              <div className="text-center"><div className="text-lg font-bold text-yellow-400">{summary?.risky || 0}</div><div className="text-xs text-muted-foreground">Risky</div></div>
              <div className="text-center"><div className="text-lg font-bold text-muted-foreground">{summary?.unknown || 0}</div><div className="text-xs text-muted-foreground">Unknown</div></div>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleCancelVerification} disabled={cancelling} iconName="X">{cancelling ? 'Cancelling...' : 'Cancel Verification'}</Button>
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    const summary = verificationJob?.results_summary || {};
    const total = verificationJob?.verified_count || verificationJob?.total_to_verify || 1;
    const startedAt = verificationJob?.started_at;
    const completedAt = verificationJob?.completed_at;
    const duration = startedAt && completedAt ? Math.round((new Date(completedAt) - new Date(startedAt)) / 1000) : null;
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Step 5: Verification Complete</h3>
          <p className="text-sm text-muted-foreground mb-6">Your contact list has been successfully verified</p>
        </div>
        <div className="bg-success/10 rounded-lg border border-success/20 p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="CheckCircle" size={24} className="text-success" />
            <span className="text-lg font-semibold text-success">Verification Complete</span>
          </div>
          <p className="text-sm text-muted-foreground">Processed {(verificationJob?.verified_count || 0)?.toLocaleString()} contacts{duration ? ` in ${duration}s` : ''}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-sm text-muted-foreground mb-2">Valid</div>
            <div className="text-3xl font-heading font-bold text-success mb-1">{(summary?.valid || 0)?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{total > 0 ? (((summary?.valid || 0) / total) * 100)?.toFixed(1) : 0}% of total</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-sm text-muted-foreground mb-2">Invalid</div>
            <div className="text-3xl font-heading font-bold text-error mb-1">{(summary?.invalid || 0)?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{total > 0 ? (((summary?.invalid || 0) / total) * 100)?.toFixed(1) : 0}% of total</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-sm text-muted-foreground mb-2">Risky</div>
            <div className="text-3xl font-heading font-bold text-warning mb-1">{(summary?.risky || 0)?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{total > 0 ? (((summary?.risky || 0) / total) * 100)?.toFixed(1) : 0}% of total</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-sm text-muted-foreground mb-2">Unknown</div>
            <div className="text-3xl font-heading font-bold text-muted-foreground mb-1">{(summary?.unknown || 0)?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{total > 0 ? (((summary?.unknown || 0) / total) * 100)?.toFixed(1) : 0}% of total</div>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" iconName="Download">Export Results</Button>
          <Button onClick={() => { setCurrentStep(1); setVerificationJob(null); setProgress(0); setErrorMsg(null); }} iconName="RefreshCw">Verify Another List</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderStepIndicator()}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
      {currentStep === 5 && renderStep5()}
    </div>
  );
};

export default ListCleanerVerifier;