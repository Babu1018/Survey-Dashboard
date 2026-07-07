import React from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import useNotificationStore from '../../store/useNotificationStore';

const Toast = () => {
  const { notification, clearNotification } = useNotificationStore();

  if (!notification) return null;

  const isSuccess = notification.type === 'success';

  return (
    <div className={`toast-notification ${notification.type}`}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        color: isSuccess ? '#10b981' : '#ef4444',
        flexShrink: 0
      }}>
        {isSuccess ? <CheckCircle size={20} /> : <XCircle size={20} />}
      </div>
      
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {isSuccess ? 'Success' : 'Error'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {notification.message}
        </div>
      </div>

      <button 
        onClick={clearNotification}
        style={{ 
          background: 'none', 
          border: 'none', 
          padding: '4px', 
          color: 'var(--text-muted)', 
          cursor: 'pointer',
          borderRadius: '6px'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
