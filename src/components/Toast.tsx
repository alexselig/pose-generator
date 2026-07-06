'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(current => current?.id === toast.id ? null : current), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '26px',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'var(--accent)',
            border: '1px solid rgba(247,244,238,.22)',
            color: 'var(--canvas)',
            padding: '13px 22px',
            borderRadius: '12px',
            boxShadow: '0 16px 40px -12px rgba(90,55,30,.5)',
            font: "600 13px var(--font-body)",
            animation: 'pf-toast .25s ease',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <span>✓</span> {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
