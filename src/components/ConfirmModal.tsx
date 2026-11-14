import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** `danger` para ações que apagam dados; `warning` para ações de alto impacto. */
  tone: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
}

interface ConfirmModalProps {
  request: ConfirmRequest | null;
  loading?: boolean;
  onClose: () => void;
}

export function ConfirmModal({ request, loading = false, onClose }: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const isOpen = request !== null;

  // Foco inicial no botão seguro (cancelar) para evitar confirmações acidentais.
  // Depende só de abrir/fechar, para não roubar o foco a cada re-render da página.
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  if (!request) return null;

  const isDanger = request.tone === 'danger';

  const handleConfirm = async () => {
    await request.onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#02040A]/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 shadow-[0_0_60px_rgba(2,4,10,0.9)] space-y-5"
      >
        <div className="flex items-start gap-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border ${
              isDanger
                ? 'bg-rose-500/10 border-rose-400/30 text-rose-300'
                : 'bg-[#D97706]/10 border-[#D97706]/40 text-[#F59E0B]'
            }`}
          >
            <TriangleAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <h3 id="confirm-title" className="font-display text-lg font-bold text-[#F8F6F0]">
              {request.title}
            </h3>
            <p id="confirm-message" className="text-sm text-[#94A3C8] leading-relaxed">
              {request.message}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] text-[#F8F6F0] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451] ${
              isDanger
                ? 'bg-rose-500 hover:bg-rose-400 text-[#070B19]'
                : 'bg-[#D97706] hover:bg-[#EA8C15] text-[#070B19]'
            }`}
          >
            {loading ? 'Aguarde…' : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
