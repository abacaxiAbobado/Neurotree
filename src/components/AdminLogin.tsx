import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

interface AdminLoginProps {
  /** Valida o token no servidor. Retorna `null` em caso de sucesso ou a mensagem de erro. */
  onLogin: (token: string) => Promise<string | null>;
  /** Aviso exibido ao abrir a tela (ex.: sessão expirada). */
  notice?: string | null;
}

export function AdminLogin({ onLogin, notice = null }: AdminLoginProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = token.trim();
    if (!value) {
      setError('Informe o token de acesso.');
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onLogin(value);
    setLoading(false);

    if (result) {
      setError(result);
      setToken('');
    }
  };

  return (
    <div className="max-w-md mx-auto w-full py-6 md:py-12">
      <form
        onSubmit={handleSubmit}
        className="bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C451]/10 border border-[#F5C451]/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-[#F5C451]" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[#F8F6F0]">
              Acesso dos organizadores
            </h2>
            <p className="text-xs text-[#94A3C8] leading-relaxed">
              Área restrita à equipe da Feira de Cursos. Entre com o token
              administrativo para gerenciar a árvore.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="admin-token"
            className="text-xs font-medium text-[#CBD5E1] flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-[#7385AD]" aria-hidden="true" />
            Token de acesso
          </label>
          <div className="relative">
            <input
              id="admin-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || notice ? 'admin-token-error' : undefined}
              placeholder="Cole aqui o ADMIN_TOKEN"
              className="w-full bg-[#070B19] border border-[#1E2949] rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-[#F8F6F0] font-mono placeholder:text-[#4A5A85] placeholder:font-sans focus:outline-none focus:border-[#F5C451] focus-visible:ring-2 focus-visible:ring-[#F5C451]/30 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#7385AD] hover:text-[#F8F6F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
              aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {(error || notice) && (
            <p
              id="admin-token-error"
              role="alert"
              className="text-xs text-[#FBBF24] bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg px-3 py-2"
            >
              {error ?? notice}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F5C451] hover:bg-[#F7D06D] disabled:opacity-60 disabled:cursor-not-allowed text-[#070B19] font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,196,81,0.18)]"
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          {loading ? 'Verificando…' : 'Entrar'}
        </button>

        <p className="text-[11px] text-[#6E80A8] text-center">
          A sessão termina quando você fecha esta aba.
        </p>
      </form>
    </div>
  );
}
