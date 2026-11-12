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
  Zap,
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
  { name: 'Esmeralda', hex: '#10B981' },
  { name: 'Oceano', hex: '#3B82F6' },
  { name: 'Ametista', hex: '#8B5CF6' },
  { name: 'Rubi', hex: '#EF4444' },
  { name: 'Âmbar', hex: '#F59E0B' },
  { name: 'Rosa Choque', hex: '#EC4899' },
  { name: 'Ciano Neón', hex: '#06B6D4' },
  { name: 'Lima Vibrante', hex: '#84CC16' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'telao' | 'formulario' | 'admin' | 'docs'>('telao');
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [selectedFolha, setSelectedFolha] = useState<Folha | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [repoType, setRepoType] = useState<'postgresql' | 'memory'>('memory');
  const [dbConnected, setDbConnected] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Formulário do participante
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#10B981');
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
  const [adminTokenInput, setAdminTokenInput] = useState('neurotree_admin_secret_2026');
  const [adminAuthed, setAdminAuthed] = useState(false);
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
    ctx.strokeStyle = '#10B981';
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
  const handleDeleteFolha = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta folha?')) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/admin/folha/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminTokenInput}` },
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
    if (
      !window.confirm(
        `Resetar a árvore agora? Um backup automático da sessão "${resetTurmaLabel}" será salvo.`
      )
    )
      return;

    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminTokenInput}`,
        },
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
    if (
      !window.confirm(
        'Deseja restaurar todas as folhas arquivadas de todos os backups para o encerramento da feira?'
      )
    )
      return;

    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminTokenInput}` },
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
    window.location.href = `/api/admin/export?token=${encodeURIComponent(adminTokenInput)}`;
  };

  const handleSimulateLeaves = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminTokenInput}`,
        },
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Barra de Navegação Superior */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TreeDeciduous className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  NEUROTREE • YGGDRASIL
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Feira EEEP • Fios Trançados
                </span>
              </div>
              <p className="text-xs text-slate-400">Árvore Cósmica de Linhas Temporais em Tempo Real</p>
            </div>
          </div>

          {/* Abas */}
          <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('telao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'telao'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <TreeDeciduous className="w-4 h-4" />
              Telão da Árvore
            </button>
            <button
              onClick={() => setActiveTab('formulario')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'formulario'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Send className="w-4 h-4" />
              Contribuir (Celular)
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Gestão da Feira
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'docs'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              API Docs
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col">
        {/* ========================================================================= */}
        {/* ABA 1: O TELÃO DA ÁRVORE (VISUALIZAÇÃO COLETIVA EM TEMPO REAL)            */}
        {/* ========================================================================= */}
        {activeTab === 'telao' && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Barra de Status do Telão */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      socketConnected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {socketConnected && (
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  )}
                </div>
                <span className="text-xs font-medium text-slate-300">
                  {socketConnected ? 'Socket.IO Conectado em Tempo Real' : 'Reconectando WebSocket...'}
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-xs text-slate-400">
                  Persistência:{' '}
                  <span className="font-semibold text-emerald-400">
                    {repoType === 'postgresql' ? 'PostgreSQL Oficial' : 'Memória Resiliente (Fallback Ativo)'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Total de Folhas:</span>
                  <span className="font-bold text-white text-sm">{totalCount}</span>
                </div>
                <button
                  onClick={() => setActiveTab('formulario')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  Plantar Minha Folha
                </button>
              </div>
            </div>

            {/* Árvore Neural Interativa (Canvas, Sinapses Vivas e Nódulos Holográficos) */}
            <NeuralTree
              folhas={folhas}
              selectedFolha={selectedFolha}
              onSelectFolha={setSelectedFolha}
              onClearSelection={() => setSelectedFolha(null)}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: FORMULÁRIO DO PARTICIPANTE (CELULAR / TOTEM)                       */}
        {/* ========================================================================= */}
        {activeTab === 'formulario' && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TreeDeciduous className="w-5 h-5 text-emerald-400" />
                    {isEditing ? 'Editar Minha Folha' : 'Deixe Sua Folha na Árvore'}
                  </h2>
                  {myEditToken && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Edição: {editRemainingTime || '15 min'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Suas respostas ficarão registradas no banco de dados e aparecerão no telão
                  em tempo real para todos os visitantes da Feira de Cursos.
                </p>
              </div>

              {/* Feedback de sucesso após o envio */}
              {submitSuccess && !isEditing && (
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Sua folha foi plantada na árvore com sucesso!
                  </div>
                  <p className="text-xs text-slate-300">
                    Olhe para o telão agora! Sua folha com o sonho de ser{' '}
                    <strong className="text-emerald-300">{submitSuccess.profissao}</strong> já está brotando.
                  </p>
                  {myEditToken && (
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                      <span className="text-xs text-slate-400">
                        Errou algo? Você pode editar nos próximos 15 minutos:
                      </span>
                      <button
                        onClick={handleStartEdit}
                        className="text-xs bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-lg hover:bg-emerald-400 transition flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar Agora
                      </button>
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 p-4 rounded-2xl text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitFolha} className="space-y-4">
                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Seu Nome ou Apelido <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={50}
                    placeholder="Ex: Ana Clara ou Aluno 3º Ano"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Profissão dos Sonhos */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Profissão dos Seus Sonhos <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profissao}
                    onChange={(e) => setProfissao(e.target.value)}
                    maxLength={100}
                    placeholder="Ex: Engenheiro Aeroespacial, Médica, Cientista de IA"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Escolha da Cor da Folha */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Cor da Sua Folha</span>
                    <span className="font-mono text-emerald-400">{cor}</span>
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c.hex}
                        onClick={() => setCor(c.hex)}
                        className={`h-9 rounded-xl flex items-center justify-center transition border ${
                          cor.toLowerCase() === c.hex.toLowerCase()
                            ? 'border-white scale-105 shadow-md'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {cor.toLowerCase() === c.hex.toLowerCase() && (
                          <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pad de Assinatura Digital */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Assinatura Digital (Desenhe com o dedo ou mouse)
                    </label>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Limpar
                    </button>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden touch-none relative">
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
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs italic">
                        ✍️ Faça seu autógrafo ou rubrica aqui
                      </div>
                    )}
                  </div>
                </div>

                {/* Mensagem para o Futuro */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Mensagem para o Futuro (Opcional)
                    </label>
                    <span className="text-[10px] text-slate-500">{mensagem.length}/500</span>
                  </div>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Deixe um conselho ou reflexão que você gostaria de ler daqui a 5 anos..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition resize-none"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
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
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
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
        {activeTab === 'admin' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    Painel de Moderação & Gestão de Sessões
                  </h2>
                  <p className="text-xs text-slate-400">
                    Controle oficial para os organizadores da Feira de Cursos (EEEP).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={adminTokenInput}
                    onChange={(e) => setAdminTokenInput(e.target.value)}
                    placeholder="ADMIN_TOKEN"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    Token Pronto
                  </span>
                </div>
              </div>

              {adminMessage && (
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl text-xs text-slate-200">
                  {adminMessage}
                </div>
              )}

              {/* Ações Rápidas da Feira (Reset de Turma, Exportação, Simulação) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Reset para Nova Turma */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <RotateCcw className="w-4 h-4" />
                    Nova Turma
                  </div>
                  <p className="text-xs text-slate-400">
                    Gera backup automático da turma atual e limpa a tela para os próximos alunos.
                  </p>
                  <input
                    type="text"
                    value={resetTurmaLabel}
                    onChange={(e) => setResetTurmaLabel(e.target.value)}
                    placeholder="Nome da Turma"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={handleResetTree}
                    disabled={adminLoading}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-lg text-xs transition"
                  >
                    Resetar Árvore
                  </button>
                </div>

                {/* Simulação em Massa (100 Folhas) */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-purple-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <Zap className="w-4 h-4 text-purple-400" />
                    Simulação (100 Folhas)
                  </div>
                  <p className="text-xs text-slate-400">
                    Gera instantaneamente 100 contribuições com sonhos e cores para teste do telão.
                  </p>
                  <div className="pt-6">
                    <button
                      onClick={handleSimulateLeaves}
                      disabled={adminLoading}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Simular 100 Folhas
                    </button>
                  </div>
                </div>

                {/* Exportar JSON */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Download className="w-4 h-4" />
                    Exportar Backup JSON
                  </div>
                  <p className="text-xs text-slate-400">
                    Faz o download de todas as folhas ativas com nomes, sonhos e assinaturas.
                  </p>
                  <div className="pt-6">
                    <button
                      onClick={handleExportJson}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Arquivo JSON
                    </button>
                  </div>
                </div>

                {/* Restauração Final Coletiva */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    Encerramento Feira
                  </div>
                  <p className="text-xs text-slate-400">
                    Restaura e consolida todas as folhas dos 2 dias de feira na árvore gigante.
                  </p>
                  <div className="pt-6">
                    <button
                      onClick={handleRestoreAll}
                      disabled={adminLoading}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 rounded-lg text-xs transition"
                    >
                      Restaurar Todas
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabela de Moderação das Folhas Ativas */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300">
                  Moderação em Tempo Real ({folhas.length} folhas na tela)
                </h3>
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3">Participante</th>
                        <th className="p-3">Profissão</th>
                        <th className="p-3">Cor</th>
                        <th className="p-3">Mensagem</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {folhas.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-white">{f.nome}</td>
                          <td className="p-3">{f.profissao}</td>
                          <td className="p-3">
                            <span
                              className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle"
                              style={{ backgroundColor: f.cor }}
                            />
                            {f.cor}
                          </td>
                          <td className="p-3 max-w-xs truncate text-slate-400">
                            {f.mensagem || '—'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteFolha(f.id)}
                              disabled={adminLoading}
                              className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition"
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
        {activeTab === 'docs' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-400" />
                  Guia de Integração e Especificação da API
                </h2>
                <p className="text-xs text-slate-400">
                  Documentação oficial completa do Back-End para desenvolvedores e equipe de Front-End.
                </p>
              </div>

              {/* Endpoints */}
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      POST
                    </span>
                    <span className="font-mono text-xs text-white">/api/folha</span>
                    <span className="text-xs text-slate-400">— Cadastra nova folha</span>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-xl text-[11px] text-slate-300 overflow-x-auto font-mono">
{`// Payload de envio:
{
  "nome": "João Silva",
  "cor": "#10B981",
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

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      GET
                    </span>
                    <span className="font-mono text-xs text-white">/api/folha?limit=100</span>
                    <span className="text-xs text-slate-400">— Lista as folhas para o telão</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      PATCH
                    </span>
                    <span className="font-mono text-xs text-white">/api/folha/edit/:token</span>
                    <span className="text-xs text-slate-400">— Edição permitida durante 15 minutos</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      DELETE
                    </span>
                    <span className="font-mono text-xs text-white">/api/admin/folha/:id</span>
                    <span className="text-xs text-slate-400">— Requer Authorization: Bearer ADMIN_TOKEN</span>
                  </div>
                </div>
              </div>

              {/* Eventos Socket.IO */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-300">Eventos em Tempo Real (Socket.IO)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <strong className="text-emerald-400 font-mono">folha:created</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Emitido quando um participante envia sua folha. O telão a desenha instantaneamente.
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <strong className="text-blue-400 font-mono">folha:updated</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Emitido quando o participante corrige sua folha nos 15 minutos de edição.
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <strong className="text-rose-400 font-mono">folha:deleted</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Emitido pelo painel admin. O telão desintegra a folha imprópria em tempo real.
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <strong className="text-amber-400 font-mono">folha:reset</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Emitido após o backup de sessão. O telão limpa os galhos para a nova turma.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-3 text-center text-xs text-slate-500">
        NEUROTREE • Feira de Cursos da EEEP • Back-End Node.js/Express, PostgreSQL, Socket.IO & React
      </footer>
    </div>
  );
}
