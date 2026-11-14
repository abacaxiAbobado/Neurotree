import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { NeuralTree } from './components/NeuralTree.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { ConfirmModal, type ConfirmRequest } from './components/ConfirmModal.tsx';
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
  Zap,
  ShieldCheck,
  Lock,
  LogOut,
  type LucideIcon,
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

const ADMIN_SESSION_KEY = 'neurotree_admin_session';

type TabId = 'telao' | 'formulario' | 'admin' | 'docs';

// Abas marcadas com adminOnly só aparecem para quem entrou como administrador
const NAV_TABS: { id: TabId; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: 'telao', label: 'Telão da Árvore', icon: TreeDeciduous },
  { id: 'formulario', label: 'Contribuir', icon: Send },
  { id: 'admin', label: 'Gestão da Feira', icon: ShieldAlert, adminOnly: true },
  { id: 'docs', label: 'API Docs', icon: Code2, adminOnly: true },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('telao');
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

  // Painel Admin
  // Sessão de administrador: o token fica só na aba atual (sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY);
    } catch {
      return null;
    }
  });
  const isAdmin = adminToken !== null;
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [resetTurmaLabel, setResetTurmaLabel] = useState('Turma 3º Ano Informática');
  const [adminLoading, setAdminLoading] = useState(false);

  // Canvas para assinatura digital
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  // Socket.IO Ref
  const socketRef = useRef<Socket | null>(null);

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

  // Páginas restritas: quem não é admin não permanece na documentação da API
  useEffect(() => {
    if (!isAdmin && activeTab === 'docs') setActiveTab('telao');
  }, [isAdmin, activeTab]);

  const adminLogin = async (token: string): Promise<string | null> => {
    try {
      // Valida o token numa rota administrativa já existente (GET exige Authorization: Bearer)
      const res = await fetch('/api/admin/backups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        return 'Token inválido. Confira e tente novamente.';
      }
      if (!res.ok) {
        return 'O servidor não conseguiu validar o token agora. Tente novamente em instantes.';
      }
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, token);
      } catch {
        // sessionStorage indisponível: a sessão vale só até recarregar a página
      }
      setAdminToken(token);
      setLoginNotice(null);
      setAdminMessage(null);
      setActiveTab('admin');
      return null;
    } catch {
      return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
    }
  };

  const adminLogout = (options?: { expired?: boolean }) => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignora
    }
    setAdminToken(null);
    setAdminMessage(null);
    setConfirmRequest(null);
    if (options?.expired) {
      // Mantém na tela de login, explicando o motivo
      setLoginNotice('Sua sessão administrativa expirou ou o token deixou de ser válido. Entre novamente.');
      setActiveTab('admin');
    } else {
      setLoginNotice(null);
      setActiveTab((tab) => (tab === 'admin' || tab === 'docs' ? 'telao' : tab));
    }
  };

  // Todas as chamadas administrativas passam por aqui; 401/403 encerram a sessão
  const adminRequest = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const res = await fetch(path, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string> | undefined) ?? {}),
        Authorization: `Bearer ${adminToken ?? ''}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      adminLogout({ expired: true });
      throw new Error('Sessão administrativa inválida ou expirada.');
    }
    return res;
  };

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

  // Ações Administrativas
  const handleDeleteFolha = (folha: Folha) => {
    setConfirmRequest({
      title: 'Excluir esta folha?',
      message: `A folha de "${folha.nome}" será removida da árvore. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir folha',
      tone: 'danger',
      onConfirm: () => performDeleteFolha(folha.id),
    });
  };

  const performDeleteFolha = async (id: string) => {
    setAdminLoading(true);
    try {
      const res = await adminRequest(`/api/admin/folha/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminMessage(`✅ Folha ${id} removida com sucesso.`);
    } catch (err: any) {
      setAdminMessage(`❌ Erro: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleResetTree = () => {
    setConfirmRequest({
      title: 'Resetar a árvore?',
      message: `Um backup da sessão "${resetTurmaLabel}" será salvo no servidor e a árvore ficará vazia para a próxima turma. Se quiser uma cópia sua, exporte o JSON antes.`,
      confirmLabel: 'Resetar árvore',
      tone: 'danger',
      onConfirm: performResetTree,
    });
  };

  const performResetTree = async () => {
    setAdminLoading(true);
    try {
      const res = await adminRequest('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleRestoreAll = () => {
    setConfirmRequest({
      title: 'Restaurar todas as folhas?',
      message:
        'Todas as folhas dos backups salvos voltarão para a árvore, para o encerramento da feira. Folhas que já estão na árvore não são duplicadas.',
      confirmLabel: 'Restaurar todas',
      tone: 'warning',
      onConfirm: performRestoreAll,
    });
  };

  const performRestoreAll = async () => {
    setAdminLoading(true);
    try {
      const res = await adminRequest('/api/admin/restore', { method: 'POST' });
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

  const handleExportJson = async () => {
    setAdminLoading(true);
    try {
      // O back só aceita o token no cabeçalho Authorization, então baixamos via fetch + blob
      const res = await adminRequest('/api/admin/export');
      if (!res.ok) {
        let message = 'Falha ao exportar as folhas.';
        try {
          message = (await res.json()).message || message;
        } catch {
          // resposta sem JSON
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neurotree_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAdminMessage('✅ Exportação concluída: o arquivo JSON foi baixado.');
    } catch (err: any) {
      setAdminMessage(`❌ Erro ao exportar: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSimulateLeaves = async () => {
    setAdminLoading(true);
    try {
      const res = await adminRequest('/api/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAdminMessage(
        `🚀 Simulação concluída com sucesso! ${data.totalCriadas} folhas adicionadas à árvore (Total ativo: ${data.totalAtivas}).`
      );
      // Atualiza folhas no telão
      const leavesRes = await fetch('/api/folha?limit=200');
      const leavesData = await leavesRes.json();
      if (leavesData.success) {
        const existingIds = new Set(folhas.map((f) => f.id));
        const now = Date.now();
        const addedBirths: Record<string, number> = {};
        leavesData.data.forEach((f: Folha) => {
          if (!existingIds.has(f.id)) {
            addedBirths[f.id] = now;
          }
        });
        if (Object.keys(addedBirths).length > 0) {
          setNewLeafBirths((prev) => ({ ...prev, ...addedBirths }));
        }
        setFolhas(leavesData.data);
        setTotalCount(leavesData.data.length);
      }
    } catch (err: any) {
      setAdminMessage(`❌ Erro na simulação: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B19] text-[#F8F6F0] flex flex-col selection:bg-[#F5C451] selection:text-[#070B19]">
      {/* Barra de Navegação Superior — Contrato Limpo em 3 Zonas + Abas com Linha Indicadora Ativa */}
      <header className="border-b border-[#1E2949] bg-[#0A1024]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zona 1: Marca em linha única */}
          <button
            type="button"
            onClick={() => setActiveTab('telao')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451] rounded-lg"
          >
            <TreeDeciduous className="w-5 h-5 text-[#F5C451] shrink-0" />
            <span className="font-display font-bold text-lg tracking-tight text-[#F8F6F0]">
              NEUROTREE
            </span>
          </button>

          {/* Zona 2: Abas limpas com linha indicadora dourada ativa (abas de gestão só para admins) */}
          <nav
            aria-label="Navegação principal"
            className="flex items-stretch h-16 gap-5 md:gap-7 overflow-x-auto no-scrollbar min-w-0"
          >
            {NAV_TABS.filter((tab) => !tab.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`relative h-full px-1 text-xs md:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === id
                    ? 'border-[#F5C451] text-[#F8F6F0] font-semibold'
                    : 'border-transparent text-[#94A3C8] hover:text-[#F8F6F0] hover:border-[#334678]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === id ? 'text-[#F5C451]' : 'text-[#7385AD]'
                  }`}
                />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Zona 3: Selo de admin + Ação Principal */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D97706]/50 bg-[#D97706]/10 px-2 sm:px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[#F59E0B]"
                  title="Sessão de administrador ativa"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">ADMIN</span>
                </span>
                <button
                  type="button"
                  onClick={() => adminLogout()}
                  aria-label="Sair do modo administrador"
                  title="Sair do modo administrador"
                  className="p-2 rounded-lg text-xs text-[#94A3C8] hover:text-[#F8F6F0] hover:bg-[#131C38] border border-transparent hover:border-[#2C3C6B] transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden md:inline">Sair</span>
                </button>
              </>
            )}
            <div className="hidden sm:flex items-center">
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
                <div className="bg-[#F5C451]/10 border border-[#F5C451]/35 rounded-2xl p-5 space-y-3">
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

        {/* ========================================================================= */}
        {/* ABA 3: PAINEL DE GESTÃO DA FEIRA & ADMIN                                  */}
        {/* ========================================================================= */}
        {activeTab === 'admin' && !isAdmin && (
          <AdminLogin onLogin={adminLogin} notice={loginNotice} />
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="max-w-5xl mx-auto w-full space-y-6 py-2">
            <div className="bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-[#1E2949] pb-4 gap-4 flex-wrap">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-[#F8F6F0] flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-[#F5C451]" />
                    Painel de Moderação & Gestão de Sessões
                  </h2>
                  <p className="text-xs text-[#94A3C8]">
                    Controle oficial para os organizadores da Feira de Cursos (EEEP).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F59E0B]">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" aria-hidden="true" />
                    Sessão de administrador ativa
                  </span>
                  <button
                    type="button"
                    onClick={() => adminLogout()}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F8F6F0] bg-[#131C38] hover:bg-[#1B274D] border border-[#2C3C6B] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sair
                  </button>
                </div>
              </div>

              {adminMessage && (
                <div className="bg-[#131C38] border border-[#2C3C6B] p-4 rounded-2xl text-xs text-[#F8F6F0]">
                  {adminMessage}
                </div>
              )}

              {/* Ferramentas (seguras) */}
              <section aria-labelledby="admin-tools" className="space-y-3">
                <h3
                  id="admin-tools"
                  className="text-xs font-semibold uppercase tracking-wider text-[#7385AD]"
                >
                  Ferramentas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Simulação em Massa (100 Folhas) */}
                  <div className="bg-[#070B19] p-5 rounded-2xl border border-[#1E2949] flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#7DD3FC] font-semibold text-sm">
                        <Zap className="w-4 h-4" />
                        Simulação (100 Folhas)
                      </div>
                      <p className="text-xs text-[#94A3C8]">
                        Gera instantaneamente 100 contribuições com sonhos e cores para teste do telão.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSimulateLeaves}
                      disabled={adminLoading}
                      className="w-full bg-[#131C38] hover:bg-[#1B274D] disabled:opacity-60 border border-[#38BDF8]/40 text-[#7DD3FC] font-semibold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Simular 100 Folhas
                    </button>
                  </div>

                  {/* Exportar JSON */}
                  <div className="bg-[#070B19] p-5 rounded-2xl border border-[#1E2949] flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#F8F6F0] font-semibold text-sm">
                        <Download className="w-4 h-4 text-[#F5C451]" />
                        Exportar Backup JSON
                      </div>
                      <p className="text-xs text-[#94A3C8]">
                        Faz o download de todas as folhas ativas com nomes, sonhos e assinaturas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      disabled={adminLoading}
                      className="w-full bg-[#131C38] hover:bg-[#1B274D] disabled:opacity-60 border border-[#2C3C6B] text-[#F8F6F0] font-semibold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-[#F5C451]" />
                      Baixar Arquivo JSON
                    </button>
                  </div>
                </div>
              </section>

              {/* Ações da feira (pedem confirmação) */}
              <section aria-labelledby="admin-fair-actions" className="space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3
                    id="admin-fair-actions"
                    className="text-xs font-semibold uppercase tracking-wider text-[#7385AD]"
                  >
                    Ações da feira
                  </h3>
                  <span className="text-[11px] text-[#F59E0B] bg-[#D97706]/10 border border-[#D97706]/30 rounded-full px-2 py-0.5">
                    pedem confirmação
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Reset para Nova Turma */}
                  <div className="bg-[#070B19] p-5 rounded-2xl border border-[#D97706]/30 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#F5C451] font-semibold text-sm">
                        <RotateCcw className="w-4 h-4" />
                        Nova Turma
                      </div>
                      <p className="text-xs text-[#94A3C8]">
                        Gera backup automático da turma atual e limpa a tela para os próximos alunos.
                      </p>
                      <input
                        type="text"
                        value={resetTurmaLabel}
                        onChange={(e) => setResetTurmaLabel(e.target.value)}
                        placeholder="Nome da Turma"
                        aria-label="Nome da turma"
                        className="w-full bg-[#0E152B] border border-[#1E2949] rounded-lg px-3 py-1.5 text-xs text-[#F8F6F0] focus:outline-none focus:border-[#F5C451]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleResetTree}
                      disabled={adminLoading}
                      className="w-full bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-60 border border-rose-400/40 text-rose-200 font-semibold py-2 rounded-lg text-xs transition-colors"
                    >
                      Resetar Árvore
                    </button>
                  </div>

                  {/* Restauração Final Coletiva */}
                  <div className="bg-[#070B19] p-5 rounded-2xl border border-[#D97706]/30 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#F5C451] font-semibold text-sm">
                        <Sparkles className="w-4 h-4" />
                        Encerramento Feira
                      </div>
                      <p className="text-xs text-[#94A3C8]">
                        Restaura e consolida todas as folhas dos 2 dias de feira na árvore gigante.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestoreAll}
                      disabled={adminLoading}
                      className="w-full bg-[#D97706] hover:bg-[#EA8C15] disabled:opacity-60 text-[#070B19] font-semibold py-2 rounded-lg text-xs transition-colors"
                    >
                      Restaurar Todas
                    </button>
                  </div>
                </div>
              </section>

              {/* Tabela de Moderação das Folhas Ativas */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#CBD5E1]">
                  Moderação em Tempo Real ({folhas.length} folhas na tela)
                </h3>
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
                            <span
                              className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle"
                              style={{ backgroundColor: f.cor }}
                            />
                            {f.cor}
                          </td>
                          <td className="p-3 max-w-xs truncate text-[#94A3C8]">
                            {f.mensagem || '—'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteFolha(f)}
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

        {/* ========================================================================= */}
        {/* ABA 4: DOCUMENTAÇÃO & INTEGRAÇÃO DA API                                    */}
        {/* ========================================================================= */}
        {activeTab === 'docs' && isAdmin && (
          <div className="max-w-4xl mx-auto w-full space-y-6 py-2">
            <div className="bg-[#0E152B] border border-[#1E2949] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="space-y-1 border-b border-[#1E2949] pb-4">
                <h2 className="font-display text-xl font-bold text-[#F8F6F0] flex items-center gap-2.5">
                  <Code2 className="w-5 h-5 text-[#F5C451]" />
                  Guia de Integração e Especificação da API
                </h2>
                <p className="text-xs text-[#94A3C8]">
                  Documentação oficial completa do Back-End para desenvolvedores e equipe de Front-End.
                </p>
              </div>

              {/* Endpoints */}
              <div className="space-y-4">
                <div className="bg-[#070B19] p-4 rounded-2xl border border-[#1E2949] space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-[#F5C451]">
                      POST
                    </span>
                    <span className="font-mono text-xs text-[#F8F6F0]">/api/folha</span>
                    <span className="text-xs text-[#94A3C8]">— Cadastra nova folha</span>
                  </div>
                  <pre className="bg-[#0E152B] border border-[#1E2949]/60 p-3 rounded-xl text-[11px] text-[#CBD5E1] overflow-x-auto font-mono">
{`// Payload de envio:
{
  "nome": "João Silva",
  "cor": "#F5C451",
  "profissao": "Desenvolvedor de Software",
  "assinatura": "data:image/png;base64,iVBORw0KGgo...",
  "mensagem": "Construindo o futuro na EEEP!"
}

// Resposta 201:
{
  "success": true,
  "data": { "id": "uuid", ... },
  "editToken": "uuid-15-min-window",
  "editExpiresAt": "2026-11-11T12:15:00Z"
}`}
                  </pre>
                </div>

                <div className="bg-[#070B19] p-4 rounded-2xl border border-[#1E2949] space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-[#7DD3FC]">
                      GET
                    </span>
                    <span className="font-mono text-xs text-[#F8F6F0]">/api/folha?limit=100</span>
                    <span className="text-xs text-[#94A3C8]">— Lista as folhas para o telão</span>
                  </div>
                </div>

                <div className="bg-[#070B19] p-4 rounded-2xl border border-[#1E2949] space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-amber-300">
                      PATCH
                    </span>
                    <span className="font-mono text-xs text-[#F8F6F0]">/api/folha/edit/:token</span>
                    <span className="text-xs text-[#94A3C8]">— Edição permitida durante 15 minutos</span>
                  </div>
                </div>

                <div className="bg-[#070B19] p-4 rounded-2xl border border-[#1E2949] space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-rose-400">
                      DELETE
                    </span>
                    <span className="font-mono text-xs text-[#F8F6F0]">/api/admin/folha/:id</span>
                    <span className="text-xs text-[#94A3C8]">— Requer Authorization: Bearer ADMIN_TOKEN</span>
                  </div>
                </div>
              </div>

              {/* Eventos Socket.IO */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-[#CBD5E1]">Eventos em Tempo Real (Socket.IO)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#070B19] p-3.5 rounded-xl border border-[#1E2949]">
                    <strong className="text-[#F5C451] font-mono">folha:created</strong>
                    <p className="text-[#94A3C8] text-[11px] mt-1">
                      Emitido quando um participante envia sua folha. O telão a desenha instantaneamente.
                    </p>
                  </div>
                  <div className="bg-[#070B19] p-3.5 rounded-xl border border-[#1E2949]">
                    <strong className="text-[#7DD3FC] font-mono">folha:updated</strong>
                    <p className="text-[#94A3C8] text-[11px] mt-1">
                      Emitido quando o participante corrige sua folha nos 15 minutos de edição.
                    </p>
                  </div>
                  <div className="bg-[#070B19] p-3.5 rounded-xl border border-[#1E2949]">
                    <strong className="text-rose-400 font-mono">folha:deleted</strong>
                    <p className="text-[#94A3C8] text-[11px] mt-1">
                      Emitido pelo painel admin. O telão remove a folha em tempo real.
                    </p>
                  </div>
                  <div className="bg-[#070B19] p-3.5 rounded-xl border border-[#1E2949]">
                    <strong className="text-amber-300 font-mono">folha:reset</strong>
                    <p className="text-[#94A3C8] text-[11px] mt-1">
                      Emitido após o backup de sessão. O telão limpa os galhos para a nova turma.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé Informativo (o cadeado discreto leva ao acesso dos organizadores) */}
      <footer className="border-t border-[#1E2949]/80 bg-[#070B19] py-3.5 text-xs text-[#6E80A8]">
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-center">
          <span>NEUROTREE · Feira de Cursos da EEEP</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              window.scrollTo({ top: 0 });
            }}
            aria-label={isAdmin ? 'Abrir a gestão da feira' : 'Acesso dos organizadores'}
            title={isAdmin ? 'Gestão da feira' : 'Acesso dos organizadores'}
            className="absolute right-4 md:right-6 p-1.5 rounded-md text-[#2C3C6B] hover:text-[#94A3C8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </footer>

      <ConfirmModal
        request={confirmRequest}
        loading={adminLoading}
        onClose={() => setConfirmRequest(null)}
      />
    </div>
  );
}
