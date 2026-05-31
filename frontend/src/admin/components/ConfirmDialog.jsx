import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../../components/ui/Button';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    ({
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant = 'danger',
    }) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({ title, message, confirmLabel, cancelLabel, variant, open: true });
      }),
    [],
  );

  const close = useCallback((result) => {
    setState((s) => (s ? { ...s, open: false } : null));
    resolveRef.current?.(result);
    resolveRef.current = null;
    setTimeout(() => setState(null), 200);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 id="confirm-title" className="text-lg font-bold text-text">
              {state.title}
            </h3>
            {state.message && (
              <p className="mt-2 text-sm text-text-muted">{state.message}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel || 'Cancel'}
              </Button>
              <Button
                variant={state.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {state.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
