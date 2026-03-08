import { useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
