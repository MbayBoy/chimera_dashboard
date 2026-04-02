import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    console.log(`[Auth] Attempting ${mode} for:`, email);

    try {
      if (mode === 'login') {
        const { data, error: authError } = await signIn(email, password);
        if (authError) {
          console.error('[Auth] Login failed:', authError?.message);
          setError(authError?.message);
        } else {
          console.log('[Auth] Login successful:', data?.user?.email);
          navigate('/');
        }
      } else {
        // Signup via supabase directly
        const { data, error: signupError } = await supabase?.auth?.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location?.origin },
        });
        if (signupError) {
          console.error('[Auth] Signup failed:', signupError?.message);
          setError(signupError?.message);
        } else {
          console.log('[Auth] Signup successful:', data?.user?.email);
          setSuccess('Account created! Check your email to confirm, or log in if email confirmation is disabled.');
          setMode('login');
        }
      }
    } catch (err) {
      console.error('[Auth] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('admin@chimera.io');
    setPassword('chimera2026');
    setError('');
    setLoading(true);
    console.log('[Auth] Attempting demo login...');
    try {
      const { data, error: authError } = await signIn('admin@chimera.io', 'chimera2026');
      if (authError) {
        console.error('[Auth] Demo login failed:', authError?.message);
        setError(`Demo login failed: ${authError?.message}`);
      } else {
        console.log('[Auth] Demo login successful');
        navigate('/');
      }
    } catch (err) {
      setError('Demo login failed. Please try manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Icon name="Zap" size={24} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">Chimera</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login' ? 'Welcome back to Chimera Dashboard' : 'Get started with Chimera'}
          </p>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <Icon name="AlertCircle" size={16} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-2">
              <Icon name="CheckCircle" size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e?.target?.value)}
                required
                placeholder="admin@chimera.io"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e?.target?.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Icon name="Loader2" size={16} className="animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Demo Login */}
          {mode === 'login' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <button
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-2.5 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-border"
              >
                <Icon name="PlayCircle" size={16} className="text-primary" />
                Demo Login (admin@chimera.io)
              </button>
            </>
          )}

          {/* Toggle mode */}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }} className="text-primary hover:underline font-medium">Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-primary hover:underline font-medium">Sign in</button>
              </>
            )}
          </p>
        </div>

        {/* Credentials hint */}
        <div className="mt-4 p-3 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            <Icon name="Info" size={12} className="inline mr-1" />
            Demo credentials: <span className="text-foreground font-mono">admin@chimera.io</span> / <span className="text-foreground font-mono">chimera2026</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
