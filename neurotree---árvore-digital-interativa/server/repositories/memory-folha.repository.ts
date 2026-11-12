import crypto from 'crypto';
import { CreateFolhaInput, UpdateFolhaInput } from '../schemas/folha.schema.ts';
import { Folha, IFolhaRepository } from './folha.repository.ts';

export class MemoryFolhaRepository implements IFolhaRepository {
  private folhas: Map<string, Folha> = new Map();

  constructor() {
    this.seedDemoLeaves();
  }

  private seedDemoLeaves() {
    // 3 folhas de demonstração para exibição inicial no preview
    const now = new Date();
    const demo1: Folha = {
      id: crypto.randomUUID(),
      nome: 'Prof. Carlos Eduardo',
      cor: '#10B981',
      profissao: 'Engenheiro de Computação',
      assinatura:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
      mensagem: 'Bem-vindos à Feira de Cursos da EEEP! O futuro começa agora.',
      edit_token: crypto.randomUUID(),
      edit_expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    };

    const demo2: Folha = {
      id: crypto.randomUUID(),
      nome: 'Mariana Silva (3º Ano)',
      cor: '#3B82F6',
      profissao: 'Desenvolvedora Full-Stack',
      assinatura:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
      mensagem: 'Construindo o NEUROTREE com tecnologia e dedicação!',
      edit_token: crypto.randomUUID(),
      edit_expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    };

    const demo3: Folha = {
      id: crypto.randomUUID(),
      nome: 'Gabriel Mendes',
      cor: '#EC4899',
      profissao: 'Designer de Interação & Games',
      assinatura:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
      mensagem: 'A arte e o código transformando ideias em realidade.',
      edit_token: crypto.randomUUID(),
      edit_expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    this.folhas.set(demo1.id, demo1);
    this.folhas.set(demo2.id, demo2);
    this.folhas.set(demo3.id, demo3);
  }

  async create(data: CreateFolhaInput): Promise<Folha> {
    const now = new Date();
    const editExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const folha: Folha = {
      id: crypto.randomUUID(),
      nome: data.nome,
      cor: data.cor,
      profissao: data.profissao,
      assinatura: data.assinatura,
      mensagem: data.mensagem || '',
      edit_token: crypto.randomUUID(),
      edit_expires_at: editExpiresAt.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    this.folhas.set(folha.id, folha);
    return folha;
  }

  async findForTelao(limit = 100): Promise<Folha[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const sorted = Array.from(this.folhas.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted.slice(0, safeLimit);
  }

  async findById(id: string): Promise<Folha | null> {
    return this.folhas.get(id) || null;
  }

  async findByEditToken(token: string): Promise<Folha | null> {
    const now = new Date();
    for (const folha of this.folhas.values()) {
      if (folha.edit_token === token) {
        if (new Date(folha.edit_expires_at) > now) {
          return folha;
        }
        return null; // Expirado
      }
    }
    return null;
  }

  async updateByEditToken(
    token: string,
    data: UpdateFolhaInput
  ): Promise<Folha | null> {
    const folha = await this.findByEditToken(token);
    if (!folha) return null;

    if (data.nome !== undefined) folha.nome = data.nome;
    if (data.cor !== undefined) folha.cor = data.cor;
    if (data.profissao !== undefined) folha.profissao = data.profissao;
    if (data.assinatura !== undefined) folha.assinatura = data.assinatura;
    if (data.mensagem !== undefined) folha.mensagem = data.mensagem;
    folha.updated_at = new Date().toISOString();

    this.folhas.set(folha.id, folha);
    return folha;
  }

  async deleteById(id: string): Promise<boolean> {
    return this.folhas.delete(id);
  }

  async count(): Promise<number> {
    return this.folhas.size;
  }

  async findAll(): Promise<Folha[]> {
    return Array.from(this.folhas.values()).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async resetAll(): Promise<void> {
    this.folhas.clear();
  }

  async importMany(folhas: Folha[]): Promise<number> {
    let count = 0;
    for (const folha of folhas) {
      this.folhas.set(folha.id, folha);
      count++;
    }
    return count;
  }
}
