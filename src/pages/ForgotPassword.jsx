import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { KeyRound, Mail, Lock, ShieldAlert, CheckCircle2, Hash } from 'lucide-react';
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

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1 = request OTP, 2 = enter OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
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
            background: success ? TONE.green : 'var(--accent-primary)',
            borderRadius: '16px',
            marginBottom: '1.25rem',
            boxShadow: `0 0 24px ${success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(var(--accent-primary-rgb), 0.35)'}`
          }}>
            {success ? <CheckCircle2 size={30} color="white" /> : <KeyRound size={30} color="white" />}
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2vw, 1.7rem)', fontWeight: 800, color: 'white', margin: '0 0 0.4rem 0' }}>
            {success ? 'Password reset!' : 'Reset Your Password'}
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.9rem' }}>
            {success
              ? 'Redirecting to login...'
              : step === 1
                ? 'Enter your Gmail address and we’ll email you a one-time code.'
                : 'Enter the code we emailed you and choose a new password.'}
          </p>
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

        {!success && step === 1 && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        )}

        {!success && step === 2 && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={inputWrapStyle}>
              <div style={iconStyle}><Hash size={18} /></div>
              <input
                type="text"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
            <div style={inputWrapStyle}>
              <div style={iconStyle}><Lock size={18} /></div>
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
            <div style={inputWrapStyle}>
              <div style={iconStyle}><Lock size={18} /></div>
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
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
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Didn't get a code? Try again
            </button>
          </form>
        )}

        {!success && (
          <div style={{ marginTop: 'clamp(1.5rem, 3vw, 2rem)', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
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

export default ForgotPassword;
