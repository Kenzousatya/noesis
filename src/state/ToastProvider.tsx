import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn, uid } from '../lib/utils';

type Tone = 'default' | 'success' | 'error';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastContextValue {
  push: (toast: { title: string; description?: string; tone?: Tone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ title, description, tone = 'default' }: { title: string; description?: string; tone?: Tone }) => {
      const id = uid('t');
      setToasts((current) => [...current.slice(-3), { id, title, description, tone }]);
      const timer = window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4200);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: 'success' }),
      error: (title, description) => push({ title, description, tone: 'error' }),
      info: (title, description) => push({ title, description, tone: 'default' }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[120] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-panel px-4 py-3 shadow-lift',
                toast.tone === 'error' ? 'border-danger/50' : 'border-line',
              )}
              role="status"
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0',
                  toast.tone === 'error' ? 'text-danger' : toast.tone === 'success' ? 'text-success' : 'text-accent',
                )}
              >
                {toast.tone === 'error' ? (
                  <AlertTriangle size={17} />
                ) : toast.tone === 'success' ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Info size={17} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold leading-snug text-ink">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink2">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="rounded p-1 text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
