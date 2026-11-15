import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { NeuralTree } from './components/NeuralTree.tsx';
import {
  TreeDeciduous,
  Send,
  Eraser,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Download,
  Info,
  Clock,
  Heart,
  CheckCircle2,
  Trash2,
  Edit3,
  RefreshCw,
  ExternalLink,
  Code2,
  Lock,
  LogOut,
  Unlock,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface Folha {
  id: string;
  nome: string;
  cor: string;
  profissao: string;
  assinatura: string;
  mensagem: string;
  edit_token?: string;
  edit_expires_at?: string;
  created_at: string;
  updated_at?: string;
}

const PRESET_COLORS = [
  { name: 'Ouro Solar', hex: '#F5C451', darkCheck: true },
  { name: 'Âmbar Real', hex: '#F59E0B', darkCheck: true },
  { name: 'Marfim Estrelado', hex: '#FDE68A', darkCheck: true },
  { name: 'Celeste Polar', hex: '#38BDF8', darkCheck: true },
  { name: 'Índigo Estelar', hex: '#6366F1', darkCheck: false },
  { name: 'Ametista Lunar', hex: '#A855F7', darkCheck: false },
  { name: 'Coral Aurora', hex: '#FB7185', darkCheck: true },
  { name: 'Turquesa Astral', hex: '#2DD4BF', darkCheck: true },
];

const MOBILE_QUERY = '(max-width: 767px)';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'gold';
  icon: 'reset' | 'trash' | 'restore';
}

export default function App() {
  // Celular: mostra apenas o formulário de inserir folha (cadeado de admin fica no rodapé)
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  );
  const [activeTab, setActiveTab] = useState<'telao' | 'formulario'>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_QUERY).matches
      ? 'formulario'
      : 'telao'
  );
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalClosing, setAdminModalClosing] = useState(false);
  const adminCloseTimerRef = useRef<number | null>(null);

  // Diálogo de confirmação próprio (substitui o window.confirm do navegador)
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [confirmClosing, setConfirmClosing] = useState(false);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [selectedFolha, setSelectedFolha] = useState<Folha | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [repoType, setRepoType] = useState<'postgresql' | 'memory'>('memory');
  const [dbConnected, setDbConnected] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [newLeafBirths, setNewLeafBirths] = useState<Record<string, number>>({});

  // Formulário do participante
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#F5C451');
  const [profissao, setProfissao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<Folha | null>(null);
  const [myEditToken, setMyEditToken] = useState<string | null>(null);
  const [myEditExpiresAt, setMyEditExpiresAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Edição
  const [isEditing, setIsEditing] = useState(false);
  const [editRemainingTime, setEditRemainingTime] = useState<string>('');

  // Painel Admin - Autenticação por senha + cookie JWT
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [resetTurmaLabel, setResetTurmaLabel] = useState('Turma 3º Ano Informática');
  const [adminLoading, setAdminLoading] = useState(false);

  // Canvas para assinatura digital
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  // Socket.IO Ref
  const socketRef = useRef<Socket | null>(null);

  // Fecha o modal de admin tocando a animação de saída antes de desmontar
  const closeAdminModal = () => {
    if (adminModalClosing) return;
    setAdminModalClosing(true);
    adminCloseTimerRef.current = window.setTimeout(() => {
      setShowAdminModal(false);
      setAdminModalClosing(false);
      adminCloseTimerRef.current = null;
    }, 220);
  };

  useEffect(
    () => () => {
      if (adminCloseTimerRef.current) window.clearTimeout(adminCloseTimerRef.current);
    },
    []
  );

  // Mensagem de "folha enviada" (alvo do scroll automático após o envio)
  const successRef = useRef<HTMLDivElement | null>(null);

  // Acompanha mudança de largura (rotação / redimensionamento) e força o formulário no celular
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (ev: MediaQueryListEvent) => {
      setIsMobile(ev.matches);
      if (ev.matches) setActiveTab('formulario');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const askConfirm = (opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmClosing(false);
      setConfirmState(opts);
    });

  const settleConfirm = (value: boolean) => {
    if (!confirmResolverRef.current) return;
    confirmResolverRef.current(value);
    confirmResolverRef.current = null;
    setConfirmClosing(true);
    window.setTimeout(() => {
      setConfirmState(null);
      setConfirmClosing(false);
    }, 200);
  };

  // Atalho escondido para abrir o painel admin: Ctrl+Shift+A (ou Ctrl+Alt+A). Esc fecha.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmState && !confirmClosing) {
        settleConfirm(false);
        return;
      }
      const isA = e.code === 'KeyA' || e.key.toLowerCase() === 'a';
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && isA) {
        e.preventDefault();
        if (!showAdminModal) setShowAdminModal(true);
        return;
      }
      if (e.key === 'Escape' && showAdminModal) {
        closeAdminModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdminModal, adminModalClosing, confirmState, confirmClosing]);

  // Se a folha aberta (texto na tela) foi deletada, fecha o texto dela
  useEffect(() => {
    if (selectedFolha && !folhas.some((f) => f.id === selectedFolha.id)) {
      setSelectedFolha(null);
    }
  }, [folhas, selectedFolha]);

  // Ao enviar a folha, rola a tela até a mensagem de confirmação
  useEffect(() => {
    if (!submitSuccess || isEditing) return;
    successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [submitSuccess, isEditing]);

  // 1. Inicializa Socket.IO e busca folhas iniciais
  useEffect(() => {
    // Carrega token de edição guardado no localStorage (se ainda válido)
    const savedToken = localStorage.getItem('neurotree_edit_token');
    const savedExpires = localStorage.getItem('neurotree_edit_expires');
    if (savedToken && savedExpires && new Date(savedExpires) > new Date()) {
      setMyEditToken(savedToken);
      setMyEditExpiresAt(savedExpires);
    }

    // Busca imediata resiliente via HTTP das folhas ativas
    fetch('/api/folha?limit=200')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setFolhas(data.data);
          setTotalCount(data.total || data.data.length);
        }
      })
      .catch(() => {});

    // Inicializa conexão Socket.IO
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      // Solicita estado inicial
      socket.emit('telao:getInitialState', (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          setFolhas(res.data);
          setTotalCount(res.data.length);
        }
      });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Eventos em tempo real
    socket.on('folha:created', (newFolha: Folha) => {
      setFolhas((prev) => [newFolha, ...prev.filter((f) => f.id !== newFolha.id)]);
      setTotalCount((prev) => prev + 1);
      setNewLeafBirths((prev) =>
        prev[newFolha.id] ? prev : { ...prev, [newFolha.id]: Date.now() }
      );
    });

    socket.on('folha:updated', (updatedFolha: Folha) => {
      setFolhas((prev) =>
        prev.map((f) => (f.id === updatedFolha.id ? { ...f, ...updatedFolha } : f))
      );
      if (selectedFolha?.id === updatedFolha.id) {
        setSelectedFolha(updatedFolha);
      }
    });

    socket.on('folha:deleted', ({ id }: { id: string }) => {
      setFolhas((prev) => prev.filter((f) => f.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      if (selectedFolha?.id === id) {
        setSelectedFolha(null);
      }
    });

    socket.on('folha:reset', () => {
      setFolhas([]);
      setTotalCount(0);
      setSelectedFolha(null);
      setNewLeafBirths({});
    });

    // Busca status da API
    fetchHealth();

    // Verifica sessão admin existente (cookie JWT)
    checkAdminSession();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Timer para contagem regressiva de edição (15 min)
  useEffect(() => {
    if (!myEditExpiresAt) return;

    const interval = setInterval(() => {
      const remainingMs = new Date(myEditExpiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setEditRemainingTime('Expirado');
        setMyEditToken(null);
        localStorage.removeItem('neurotree_edit_token');
        localStorage.removeItem('neurotree_edit_expires');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remainingMs / (60 * 1000));
        const secs = Math.floor((remainingMs % (60 * 1000)) / 1000);
        setEditRemainingTime(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [myEditExpiresAt]);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setRepoType(data.database?.type || 'memory');
        setDbConnected(Boolean(data.database?.connected));
        if (typeof data.totalFolhas === 'number') {
          setTotalCount(data.totalFolhas);
        }
      }
    } catch {
      // Ignora falhas em rede
    }
  };

  // Verifica se há sessão admin válida (cookie JWT HttpOnly)
  const checkAdminSession = async () => {
    try {
      const res = await fetch('/api/admin/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminAuthed(true);
        }
      }
    } catch {
      // Sem sessão válida
    } finally {
      setAdminChecking(false);
    }
  };

  // Funções do Canvas de Assinatura
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawnSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#F5C451';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  // Enviar folha (criação ou edição)
  const handleSubmitFolha = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validações locais amigáveis
    if (nome.trim().length < 2) {
      setFormError('O nome deve ter pelo menos 2 caracteres.');
      return;
    }
    if (!profissao.trim()) {
      setFormError('Informe a profissão dos seus sonhos.');
      return;
    }

    let assinaturaBase64 = '';
    if (canvasRef.current && hasDrawnSignature) {
      assinaturaBase64 = canvasRef.current.toDataURL('image/png');
    } else if (!isEditing) {
      // Gera assinatura padrão se o usuário não desenhou no canvas
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '24px "Brush Script MT", cursive, sans-serif';
        ctx.fillStyle = cor;
        ctx.fillText(nome || 'Participante', 20, 55);
        assinaturaBase64 = canvas.toDataURL('image/png');
      }
    }

    setSubmitting(true);

    try {
      if (isEditing && myEditToken) {
        // Atualização via PATCH /api/folha/edit/:token
        const payload: any = {
          nome: nome.trim(),
          cor,
          profissao: profissao.trim(),
          mensagem: mensagem.trim(),
        };
        if (hasDrawnSignature && assinaturaBase64) {
          payload.assinatura = assinaturaBase64;
        }

        const res = await fetch(`/api/folha/edit/${myEditToken}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Falha ao atualizar folha.');
        }

        setSubmitSuccess(data.data);
        setIsEditing(false);
      } else {
        // Criação via POST /api/folha
        const res = await fetch('/api/folha', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-session': `client_${Date.now()}`,
          },
          body: JSON.stringify({
            nome: nome.trim(),
            cor,
            profissao: profissao.trim(),
            assinatura: assinaturaBase64,
            mensagem: mensagem.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Falha ao cadastrar folha.');
        }

        setSubmitSuccess(data.data);
        if (data.data?.id) {
          setNewLeafBirths((prev) =>
            prev[data.data.id] ? prev : { ...prev, [data.data.id]: Date.now() }
          );
        }
        if (data.editToken) {
          setMyEditToken(data.editToken);
          setMyEditExpiresAt(data.editExpiresAt);
          localStorage.setItem('neurotree_edit_token', data.editToken);
          localStorage.setItem('neurotree_edit_expires', data.editExpiresAt);
        }

        // Limpa formulário
        setNome('');
        setProfissao('');
        setMensagem('');
        clearCanvas();
      }
    } catch (err: any) {
      setFormError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Carregar dados para edição
  const handleStartEdit = () => {
    if (!submitSuccess && !myEditToken) return;
    setIsEditing(true);
    setSubmitSuccess(null);
    if (submitSuccess) {
      setNome(submitSuccess.nome);
      setCor(submitSuccess.cor);
      setProfissao(submitSuccess.profissao);
      setMensagem(submitSuccess.mensagem);
    }
  };

  // Admin: Login com senha
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminAuthed(true);
      setAdminMessage('✅ Login realizado com sucesso!');
      setAdminPassword(''); // Limpa senha do estado
    } catch (err: any) {
      setAdminMessage(`❌ ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  // Admin: Logout
  const handleAdminLogout = async () => {
    setAdminLoading(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
      setAdminAuthed(false);
      setAdminMessage('✅ Logout realizado.');
    } catch {
      setAdminAuthed(false);
      setAdminMessage('✅ Sessão encerrada.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Ações Administrativas (usam cookie JWT automaticamente via credentials: 'include')
  const handleDeleteFolha = async (id: string) => {
    const ok = await askConfirm({
      title: 'Excluir esta folha?',
      message: 'A folha será removida da árvore para todos os visitantes.',
      confirmLabel: 'Excluir',
      tone: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/admin/folha/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminMessage(`✅ Folha ${id} removida com sucesso.`);
    } catch (err: any) {
      setAdminMessage(`❌ Erro: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleResetTree = async () => {
    const ok = await askConfirm({
      title: 'Resetar a árvore?',
      message: `Um backup automático da sessão "${resetTurmaLabel}" será salvo e a árvore ficará vazia para a próxima turma.`,
      confirmLabel: 'Resetar árvore',
      tone: 'danger',
      icon: 'reset',
    });
    if (!ok) return;

    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: resetTurmaLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminMessage(
        `✅ Árvore resetada com sucesso para a nova turma! Backup salvo em: ${data.backupFile} (${data.totalFolhasSalvas} folhas arquivadas).`
      );
    } catch (err: any) {
      setAdminMessage(`❌ Erro: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRestoreAll = async () => {
    const ok = await askConfirm({
      title: 'Restaurar todas as folhas?',
      message:
        'As folhas arquivadas de todos os backups voltarão para a árvore, para o encerramento da feira.',
      confirmLabel: 'Restaurar tudo',
      tone: 'gold',
      icon: 'restore',
    });
    if (!ok) return;

    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminMessage(
        `🎉 ${data.totalRestauradas} folhas históricas restauradas com sucesso!`
      );
      // Recarrega estado do telão
      const leavesRes = await fetch('/api/folha?limit=200');
      const leavesData = await leavesRes.json();
      if (leavesData.success) {
        setFolhas(leavesData.data);
      }
    } catch (err: any) {
      setAdminMessage(`❌ Erro: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleExportJson = () => {
    window.open('/api/admin/export', '_blank');
  };

  // Modais do painel admin (login por senha e painel de moderação), usados no computador e no celular
  const confirmIsDanger = confirmState?.tone === 'danger';
  const ConfirmIcon =
    confirmState?.icon === 'trash' ? Trash2 : confirmState?.icon === 'restore' ? Sparkles : RotateCcw;

  const adminModals = (
    <>
      {/* Modal de Login Admin (Discreto - Cadeado no Rodapé) */}
      {!adminAuthed && showAdminModal && (
        <div
          data-closing={adminModalClosing}
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B19]/95 backdrop-blur-sm"
        >
          <div
            data-closing={adminModalClosing}
            className="modal-card relative w-full max-w-md bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
          >
            <button
              type="button"
              onClick={closeAdminModal}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#566894] hover:text-[#F8F6F0] hover:bg-[#131C38] transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-2">
              <Lock className="modal-lock w-10 h-10 text-[#F5C451] mx-auto" />
              <h3 className="font-display text-lg font-bold text-[#F8F6F0]">Acesso Restrito</h3>
              <p className="text-xs text-[#94A3C8]">Digite a senha de administrador para acessar o painel de gestão.</p>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CBD5E1]">Senha de Administrador</label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Digite a senha"
                    autoComplete="current-password"
                    required
                    autoFocus
                    className="w-full bg-[#070B19] border border-[#1E2949] rounded-xl px-4 py-2.5 text-sm text-[#F8F6F0] placeholder-[#566894] focus:outline-none focus:border-[#F5C451] transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#566894] hover:text-[#F5C451] transition-colors"
                    aria-label={showAdminPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {adminMessage && (
                <div
                  className={`text-xs text-center px-3 py-2 rounded-lg border ${
                    adminMessage.includes('✅')
                      ? 'bg-green-500/10 border-green-500/30 text-green-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {adminMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-gradient-to-r from-[#F5C451] to-[#D97706] hover:from-[#F7D06D] hover:to-[#E58A1A] text-[#070B19] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(245,196,81,0.22)] disabled:opacity-50"
              >
                {adminLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                {adminLoading ? 'Entrando...' : 'Acessar Painel'}
              </button>
            </form>
          </div>
        </div>
      )}

      {adminAuthed && showAdminModal && (
        <div
          data-closing={adminModalClosing}
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B19]/95 backdrop-blur-sm"
        >
          <div
            data-closing={adminModalClosing}
            className="modal-card w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#1E2949] pb-4 gap-4 flex-wrap mb-6">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-[#F8F6F0] flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#F5C451]" />
                  Painel de Moderação & Gestão de Sessões
                </h2>
                <p className="text-xs text-[#94A3C8]">Controle oficial para os organizadores da Feira de Cursos (EEEP).</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeAdminModal}
                  className="p-1.5 rounded-lg text-[#566894] hover:text-[#F8F6F0] hover:bg-[#131C38] transition-colors"
                  aria-label="Fechar painel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  disabled={adminLoading}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            </div>

            {adminMessage && (
              <div className="bg-[#131C38] border border-[#2C3C6B] p-4 rounded-2xl text-xs text-[#F8F6F0] mb-6">
                {adminMessage}
              </div>
            )}

            {/* Ações Rápidas da Feira */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Reset para Nova Turma */}
              <div className="bg-[#070B19] p-5 rounded-2xl border border-[#1E2949] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#F5C451] font-semibold text-sm">
                    <RotateCcw className="w-4 h-4" />
                    Nova Turma
                  </div>
                  <p className="text-xs text-[#94A3C8]">Gera backup automático da turma atual e limpa a tela para os próximos alunos.</p>
                  <input
                    type="text"
                    value={resetTurmaLabel}
                    onChange={(e) => setResetTurmaLabel(e.target.value)}
                    placeholder="Nome da Turma"
                    className="w-full bg-[#0E152B] border border-[#1E2949] rounded-lg px-3 py-1.5 text-xs text-[#F8F6F0] focus:outline-none focus:border-[#F5C451]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetTree}
                  disabled={adminLoading}
                  className="w-full bg-[#F5C451] hover:bg-[#F7D06D] text-[#070B19] font-semibold py-2 rounded-lg text-xs transition-colors"
                >
                  Resetar Árvore
                </button>
              </div>

              {/* Exportar JSON */}
              <div className="bg-[#070B19] p-5 rounded-2xl border border-[#1E2949] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#F8F6F0] font-semibold text-sm">
                    <Download className="w-4 h-4 text-[#F5C451]" />
                    Exportar Backup JSON
                  </div>
                  <p className="text-xs text-[#94A3C8]">Faz o download de todas as folhas ativas com nomes, sonhos e assinaturas.</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] text-[#F8F6F0] font-semibold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#F5C451]" />
                  Baixar Arquivo JSON
                </button>
              </div>

              {/* Restauração Final Coletiva */}
              <div className="bg-[#070B19] p-5 rounded-2xl border border-[#1E2949] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#F5C451] font-semibold text-sm">
                    <Sparkles className="w-4 h-4" />
                    Encerramento Feira
                  </div>
                  <p className="text-xs text-[#94A3C8]">Restaura e consolida todas as folhas dos 2 dias de feira na árvore gigante.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  disabled={adminLoading}
                  className="w-full bg-[#D97706] hover:bg-[#EA8C15] text-[#070B19] font-semibold py-2 rounded-lg text-xs transition-colors"
                >
                  Restaurar Todas
                </button>
              </div>
            </div>

            {/* Tabela de Moderação das Folhas Ativas */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#CBD5E1]">Moderação em Tempo Real ({folhas.length} folhas na tela)</h3>
              <div className="bg-[#070B19] rounded-2xl border border-[#1E2949] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0E152B] text-[#94A3C8] text-[11px] font-medium border-b border-[#1E2949]">
                    <tr>
                      <th className="p-3">Participante</th>
                      <th className="p-3">Profissão</th>
                      <th className="p-3">Cor</th>
                      <th className="p-3">Mensagem</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2949]/70 text-[#CBD5E1]">
                    {folhas.map((f) => (
                      <tr key={f.id} className="hover:bg-[#0E152B]/60 transition-colors">
                        <td className="p-3 font-semibold text-[#F8F6F0]">{f.nome}</td>
                        <td className="p-3">{f.profissao}</td>
                        <td className="p-3 font-mono tabular-nums">
                          <span className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle" style={{ backgroundColor: f.cor }} />
                          {f.cor}
                        </td>
                        <td className="p-3 max-w-xs truncate text-[#94A3C8]">{f.mensagem || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteFolha(f.id)}
                            disabled={adminLoading}
                            className="text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação (acima do painel admin) */}
      {confirmState && (
        <div
          data-closing={confirmClosing}
          onClick={() => settleConfirm(false)}
          className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#070B19]/80 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            data-closing={confirmClosing}
            onClick={(e) => e.stopPropagation()}
            className="modal-card w-full max-w-sm bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 shadow-2xl text-center space-y-5"
          >
            <div
              className={`modal-lock mx-auto w-14 h-14 rounded-2xl flex items-center justify-center border ${
                confirmIsDanger
                  ? 'bg-rose-500/10 border-rose-400/30 text-rose-300'
                  : 'bg-[#F5C451]/10 border-[#F5C451]/30 text-[#F5C451]'
              }`}
            >
              <ConfirmIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 id="confirm-title" className="font-display text-lg font-bold text-[#F8F6F0]">
                {confirmState.title}
              </h3>
              <p className="text-xs leading-relaxed text-[#94A3C8]">{confirmState.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => settleConfirm(false)}
                className="py-2.5 rounded-xl text-sm font-semibold bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] text-[#CBD5E1] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => settleConfirm(true)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 ${
                  confirmIsDanger
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-[0_8px_24px_rgba(244,63,94,0.25)] focus-visible:ring-rose-300'
                    : 'bg-gradient-to-r from-[#F5C451] to-[#D97706] hover:from-[#F7D06D] hover:to-[#E58A1A] text-[#070B19] shadow-[0_8px_24px_rgba(245,196,81,0.22)] focus-visible:ring-[#F5C451]'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Computador: somente o telão da árvore, sempre aberto e em tela cheia (sem menus, abas ou rodapé)
  if (!isMobile) {
    return (
      <div className="fixed inset-0 bg-[#070B19] text-[#F8F6F0] overflow-hidden">
        <NeuralTree
          fillScreen
          folhas={folhas}
          selectedFolha={selectedFolha}
          onSelectFolha={setSelectedFolha}
          onClearSelection={() => setSelectedFolha(null)}
          newLeafBirths={newLeafBirths}
        />
        {adminModals}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B19] text-[#F8F6F0] flex flex-col selection:bg-[#F5C451] selection:text-[#070B19]">
      {/* Barra de Navegação Superior — Contrato Limpo em 3 Zonas + Abas com Linha Indicadora Ativa */}
      <header className="border-b border-[#1E2949] bg-[#0A1024]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zona 1: Marca em linha única */}
          <button
            type="button"
            onClick={() => !isMobile && setActiveTab('telao')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451] rounded-lg"
          >
            <TreeDeciduous className="w-5 h-5 text-[#F5C451] shrink-0" />
            <span className="font-display font-bold text-lg tracking-tight text-[#F8F6F0]">
              NEUROTREE
            </span>
          </button>

          {/* Zona 2: Abas limpas com linha indicadora dourada ativa */}
          {!isMobile && (
          <nav
            aria-label="Navegação principal"
            className="flex items-stretch h-16 gap-5 md:gap-7 overflow-x-auto no-scrollbar"
          >
            <button
              type="button"
              onClick={() => setActiveTab('telao')}
              className={`relative h-full px-1 text-xs md:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'telao'
                  ? 'border-[#F5C451] text-[#F8F6F0] font-semibold'
                  : 'border-transparent text-[#94A3C8] hover:text-[#F8F6F0] hover:border-[#334678]'
              }`}
            >
              <TreeDeciduous
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'telao' ? 'text-[#F5C451]' : 'text-[#7385AD]'
                }`}
              />
              <span>Telão da Árvore</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('formulario')}
              className={`relative h-full px-1 text-xs md:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'formulario'
                  ? 'border-[#F5C451] text-[#F8F6F0] font-semibold'
                  : 'border-transparent text-[#94A3C8] hover:text-[#F8F6F0] hover:border-[#334678]'
              }`}
            >
              <Send
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'formulario' ? 'text-[#F5C451]' : 'text-[#7385AD]'
                }`}
              />
              <span>Contribuir</span>
            </button>
          </nav>
          )}

          {/* Zona 3: Ação Principal */}
          <div className="hidden md:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('formulario')}
              className="bg-[#F5C451] hover:bg-[#F7D06D] text-[#070B19] font-semibold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-[0_4px_20px_rgba(245,196,81,0.18)]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Plantar Folha</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col">
        {/* ========================================================================= */}
        {/* ABA 1: O TELÃO DA ÁRVORE (VISUALIZAÇÃO COLETIVA EM TEMPO REAL)            */}
        {/* ========================================================================= */}
        {activeTab === 'telao' && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Barra de Estado do Telão */}
            <div className="bg-[#0E152B]/90 border border-[#1E2949] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-[#94A3C8]">
                <div className="relative flex items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      socketConnected ? 'bg-[#F5C451]' : 'bg-[#D97706]'
                    }`}
                  />
                  {socketConnected && (
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#F5C451] animate-ping opacity-70" />
                  )}
                </div>
                <span className="font-medium text-[#E2E8F0]">
                  {socketConnected ? 'Tempo real conectado' : 'Reconectando WebSocket...'}
                </span>
                <span aria-hidden="true" className="text-[#334678]">·</span>
                <span>
                  Armazenamento:{' '}
                  <strong className="font-semibold text-[#F5C451]">
                    {repoType === 'postgresql' ? 'PostgreSQL' : 'Memória Resiliente'}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2 text-[#94A3C8]">
                  <span>Folhas vivas</span>
                  <span className="font-mono tabular-nums font-semibold text-[#F8F6F0] text-sm">
                    {totalCount}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('formulario')}
                  className="bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] text-[#F5C451] font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Plantar Minha Folha</span>
                </button>
              </div>
            </div>

            {/* Palco Interativo da Árvore */}
            <NeuralTree
              folhas={folhas}
              selectedFolha={selectedFolha}
              onSelectFolha={setSelectedFolha}
              onClearSelection={() => setSelectedFolha(null)}
              newLeafBirths={newLeafBirths}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: FORMULÁRIO DO PARTICIPANTE (CELULAR / TOTEM)                       */}
        {/* ========================================================================= */}
        {activeTab === 'formulario' && (
          <div className="max-w-2xl mx-auto w-full space-y-6 py-2">
            <div className="bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="space-y-1.5 border-b border-[#1E2949] pb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="font-display text-xl md:text-2xl font-bold text-[#F8F6F0] flex items-center gap-2.5">
                    <TreeDeciduous className="w-5 h-5 text-[#F5C451]" />
                    {isEditing ? 'Editar Minha Folha' : 'Deixe Sua Folha na Árvore'}
                  </h2>
                  {myEditToken && (
                    <span className="text-xs font-mono tabular-nums text-[#F5C451] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Edição: {editRemainingTime || '15 min'}
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-[#94A3C8]">
                  Suas respostas ficam registradas no banco de dados e brotam no telão em tempo real para todos os visitantes da feira.
                </p>
              </div>

              {/* Feedback de sucesso após o envio */}
              {submitSuccess && !isEditing && (
                <div
                  ref={successRef}
                  className="scroll-mt-20 bg-[#F5C451]/10 border border-[#F5C451]/35 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 text-[#F5C451] font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Sua folha foi plantada na árvore com sucesso!
                  </div>
                  <p className="text-xs text-[#E2E8F0]">
                    Olhe para o telão agora! Sua folha com o sonho de{' '}
                    <strong className="text-[#F5C451]">{submitSuccess.profissao}</strong> já está brotando.
                  </p>
                  {myEditToken && (
                    <div className="flex items-center justify-between pt-3 border-t border-[#F5C451]/20 gap-3 flex-wrap">
                      <span className="text-xs text-[#94A3C8]">
                        Deseja corrigir algum dado? Você tem 15 minutos para editar:
                      </span>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="text-xs bg-[#F5C451] text-[#070B19] font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#F7D06D] transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar Agora
                      </button>
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="bg-rose-500/10 border border-rose-400/35 text-rose-300 p-4 rounded-2xl text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitFolha} className="space-y-5">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">
                    Seu Nome ou Apelido <span className="text-[#F5C451]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={50}
                    placeholder="Ex: Ana Clara ou Aluno 3º Ano"
                    className="w-full bg-[#070B19] border border-[#1E2949] rounded-xl px-4 py-2.5 text-sm text-[#F8F6F0] placeholder-[#566894] focus:outline-none focus:border-[#F5C451] transition-colors"
                  />
                </div>

                {/* Profissão dos Sonhos */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">
                    Profissão dos Seus Sonhos <span className="text-[#F5C451]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profissao}
                    onChange={(e) => setProfissao(e.target.value)}
                    maxLength={100}
                    placeholder="Ex: Engenheiro Aeroespacial, Médica, Cientista de IA"
                    className="w-full bg-[#070B19] border border-[#1E2949] rounded-xl px-4 py-2.5 text-sm text-[#F8F6F0] placeholder-[#566894] focus:outline-none focus:border-[#F5C451] transition-colors"
                  />
                </div>

                {/* Escolha da Cor da Folha */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#CBD5E1] flex items-center justify-between">
                    <span>Cor da Sua Folha</span>
                    <span className="font-mono text-[#F5C451] flex items-center gap-1.5">
                      <span className="font-sans text-[#94A3C8] font-medium">
                        {PRESET_COLORS.find((p) => p.hex.toLowerCase() === cor.toLowerCase())?.name ?? 'Personalizada'}
                      </span>
                      <span>•</span>
                      <span>{cor}</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_COLORS.map((c) => {
                      const isActive = cor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          type="button"
                          key={c.hex}
                          onClick={() => setCor(c.hex)}
                          className={`h-9 rounded-xl flex items-center justify-center transition-transform border ${
                            isActive
                              ? 'border-[#F8F6F0] scale-105 shadow-md ring-2 ring-[#F5C451]/50'
                              : 'border-[#1E2949]/60 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                          aria-label={c.name}
                        >
                          {isActive && (
                            <CheckCircle2
                              className={`w-4 h-4 ${c.darkCheck ? 'text-[#070B19]' : 'text-[#F8F6F0]'}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pad de Assinatura Digital */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#CBD5E1]">
                      Assinatura Digital (Desenhe com o dedo ou mouse)
                    </label>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-[#94A3C8] hover:text-[#F5C451] flex items-center gap-1 transition-colors"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Limpar
                    </button>
                  </div>
                  <div className="bg-[#070B19] border border-[#1E2949] rounded-2xl overflow-hidden touch-none relative">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={140}
                      className="w-full h-32 cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasDrawnSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#566894] text-xs italic">
                        Faça seu autógrafo ou rubrica aqui
                      </div>
                    )}
                  </div>
                </div>

                {/* Mensagem para o Futuro */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#CBD5E1]">
                      Mensagem para o Futuro (Opcional)
                    </label>
                    <span className="text-[11px] font-mono tabular-nums text-[#7385AD]">
                      {mensagem.length}/500
                    </span>
                  </div>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Deixe um conselho ou reflexão que você gostaria de ler daqui a 5 anos..."
                    className="w-full bg-[#070B19] border border-[#1E2949] rounded-xl px-4 py-2.5 text-sm text-[#F8F6F0] placeholder-[#566894] focus:outline-none focus:border-[#F5C451] transition-colors resize-none"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-[#F5C451] to-[#D97706] hover:from-[#F7D06D] hover:to-[#E58A1A] text-[#070B19] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(245,196,81,0.22)] disabled:opacity-50"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isEditing ? 'Salvar Alterações da Folha' : 'Enviar Minha Folha para o Telão'}
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-3 bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] text-[#CBD5E1] rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="border-t border-[#1E2949]/80 bg-[#070B19] py-3.5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <span className="text-xs text-[#6E80A8]">NEUROTREE · Feira de Cursos da EEEP</span>
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="p-1.5 rounded-lg text-[#334678] hover:text-[#F5C451] hover:bg-[#131C38] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
            aria-label="Acesso administrativo"
            title="Gestão da Feira"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {adminModals}
    </div>
  );
}
