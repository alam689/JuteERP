import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, IDLE_TIMEOUT_MIN } from '../auth/AuthContext';
import { DEMO_USERS, ROLE_LABEL } from '../data/users';
import { COMPANY } from '../data/management';
import { fmtNum } from '../lib/format';

export default function Login() {
  const { user, login, verifyOtp, mfaPendingFor, cancelMfa, signOutReason } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    // Small delay so the button state is visible, as with a real network call.
    window.setTimeout(() => {
      const r = login(username, password, remember);
      setBusy(false);
      if (r.status === 'ok') navigate(from, { replace: true });
      else if (r.status === 'error')
        setError(`Incorrect username or password. ${r.remaining} attempt${r.remaining === 1 ? '' : 's'} left before the account is locked.`);
      else if (r.status === 'locked')
        setError(`Too many failed attempts. Try again after ${new Date(r.until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`);
    }, 350);
  };

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    if (!verifyOtp(otp)) {
      setError('That code is not valid. Check your authenticator app and try again.');
      return;
    }
    navigate(from, { replace: true });
  };

  const fillDemo = (id: string) => {
    const u = DEMO_USERS.find((d) => d.id === id)!;
    setUsername(u.username);
    setPassword(u.password);
    setError(null);
  };

  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">J</div>
          <div>
            <div className="brand-name">{COMPANY.name}</div>
            <div className="brand-sub">A joint venture of Samuda Chemical Complex Ltd. &amp; Bay Group</div>
          </div>
        </div>
        <div>
          <div className="tagline">{COMPANY.tagline}</div>
          <h1>Manufacturing ERP</h1>
          <p>
            One system for raw jute procurement, multi-stage production, quality, export shipment and finance — from the
            batching house to the container.
          </p>
        </div>
        <div className="hero-stats">
          <div><b>{fmtNum(COMPANY.workforce)}</b><span>Employees</span></div>
          <div><b>300K</b><span>Sq. ft. production floor</span></div>
          <div><b>17</b><span>Export products</span></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="card login-card">
          {!mfaPendingFor ? (
            <>
              <h2>Sign in</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>Use your JAL ERP account.</p>
              {signOutReason === 'idle' && (
                <div className="alert alert-info" style={{ marginTop: 16 }}>
                  You were signed out after {IDLE_TIMEOUT_MIN} minutes of inactivity.
                </div>
              )}
              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <label htmlFor="username">Username</label>
                  <input id="username" className="input" autoComplete="username" autoFocus value={username}
                    onChange={(e) => setUsername(e.target.value)} aria-invalid={!!error} />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="pw-wrap">
                    <input id="password" className="input" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPw((v) => !v)}>
                      {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <label className="check small">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Keep me signed in on this device
                </label>
                {error && <div className="alert alert-bad" role="alert">{error}</div>}
                <button className="btn btn-primary" type="submit" disabled={busy} style={{ height: 42 }}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div className="small muted" style={{ fontWeight: 600, marginBottom: 8 }}>Prototype — demo accounts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEMO_USERS.map((u) => (
                    <button key={u.id} type="button" className="btn btn-sm" onClick={() => fillDemo(u.id)}>
                      {ROLE_LABEL[u.role]}
                    </button>
                  ))}
                </div>
                <div className="hint" style={{ marginTop: 8 }}>Fills the form for that role. Board and CEO accounts use two-step verification.</div>
              </div>
            </>
          ) : (
            <>
              <h2>Two-step verification</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Enter the 6-digit code from your authenticator app for <b>{mfaPendingFor.name}</b>.
              </p>
              <form onSubmit={onVerify} noValidate>
                <div className="field">
                  <label htmlFor="otp">Verification code</label>
                  <input id="otp" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                    value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} aria-invalid={!!error} />
                </div>
                {error && <div className="alert alert-bad" role="alert">{error}</div>}
                <button className="btn btn-primary" type="submit" disabled={otp.length !== 6} style={{ height: 42 }}>Verify</button>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelMfa(); setOtp(''); setError(null); }}>
                    ← Back
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setOtp(DEMO_USERS.find((u) => u.id === mfaPendingFor.id)?.otp ?? '')}>
                    Fill demo code
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
