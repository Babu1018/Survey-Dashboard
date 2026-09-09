import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { Lock, Eye, EyeOff, ShieldCheck, ShieldAlert, Mail, UserCircle2 } from 'lucide-react';
import { TONE } from '../utils/dashboardTheme';
import sidebarGradient from '../assets/sidebar-gradient.png';

const inputWrapStyle = { position: 'relative' };
const iconStyle = {
  position: 'absolute',
  left: '16px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'rgba(255, 255, 255, 0.4)',
  display: 'flex',
  alignItems: 'center'
};
const inputStyle = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px 14px 48px',
  color: 'white',
  fontSize: '1rem',
  outline: 'none',
  transition: 'all 0.2s'
};

const focusInput = (e) => {
  e.target.style.borderColor = 'var(--accent-primary)';
  e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-primary-rgb), 0.15)';
};
const blurInput = (e) => {
  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
  e.target.style.boxShadow = 'none';
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [foundUsername, setFoundUsername] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Authentik SSO is temporarily disabled on the backend (see Backend/main.py),
  // so default to the local login this app used before Authentik was added.
  const [useAuthentik, setUseAuthentik] = useState(false);

  const loginEmail = useAuthStore((state) => state.loginEmail);
  const loginAuthentik = useAuthStore((state) => state.loginAuthentik);
  const lookupUsernameByEmail = useAuthStore((state) => state.lookupUsernameByEmail);
  const navigate = useNavigate();

  // As the user types a valid-looking email, show whose account it is
  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFoundUsername(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const name = await lookupUsernameByEmail(email);
      if (!cancelled) setFoundUsername(name);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [email, lookupUsernameByEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = useAuthentik ? await loginAuthentik(email, password) : await loginEmail(email, password);
      if (user.is_first_login) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `url(${sidebarGradient})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#0a1242',
      padding: 'clamp(1.5rem, 4vw, 3rem)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: 'clamp(2rem, 4vw, 2.75rem)',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
        animation: 'fade-in-up 0.6s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            background: 'var(--accent-primary)',
            borderRadius: '16px',
            marginBottom: '1.25rem',
            boxShadow: '0 0 24px rgba(var(--accent-primary-rgb), 0.35)'
          }}>
            <ShieldCheck size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2vw, 1.7rem)', fontWeight: 800, color: 'white', margin: '0 0 0.4rem 0' }}>Survey Management Application</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.9rem' }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: TONE.red,
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {foundUsername && !useAuthentik && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(var(--accent-primary-rgb), 0.1)',
              border: '1px solid rgba(var(--accent-primary-rgb), 0.25)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <UserCircle2 size={16} color="var(--accent-primary)" />
              Signing in as {foundUsername}
            </div>
          )}

          <div style={inputWrapStyle}>
            <div style={iconStyle}><Mail size={18} /></div>
            <input
              type="email"
              placeholder="Gmail address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>

          <div style={inputWrapStyle}>
            <div style={iconStyle}><Lock size={18} /></div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, padding: '14px 48px 14px 48px' }}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.5rem' }}>
            <button
              type="button"
              onClick={() => setUseAuthentik((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.45)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              {useAuthentik ? 'Use local login instead' : 'Sign in with Authentik SSO'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="primary"
            style={{
              width: '100%',
              height: '48px',
              fontSize: '0.95rem',
              marginTop: '0.5rem',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Authenticating...' : useAuthentik ? 'Sign In with Authentik' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 'clamp(1.5rem, 3vw, 2rem)', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.8rem' }}>
            Restricted access for authorized personnel only.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
