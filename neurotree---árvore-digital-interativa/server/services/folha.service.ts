import { isDatabaseConnected } from '../config/database.ts';
import { Folha, IFolhaRepository } from '../repositories/folha.repository.ts';
import { MemoryFolhaRepository } from '../repositories/memory-folha.repository.ts';
import { PgFolhaRepository } from '../repositories/pg-folha.repository.ts';
import { CreateFolhaInput, UpdateFolhaInput } from '../schemas/folha.schema.ts';
import { backupService } from './backup.service.ts';

export class FolhaService {
  private pgRepo: PgFolhaRepository;
  private memoryRepo: MemoryFolhaRepository;

  constructor() {
    this.pgRepo = new PgFolhaRepository();
    this.memoryRepo = new MemoryFolhaRepository();
  }

  private getRepository(): IFolhaRepository {
    if (isDatabaseConnected()) {
      return this.pgRepo;
    }
    return this.memoryRepo;
  }

  public getRepositoryType(): 'postgresql' | 'memory' {
    return isDatabaseConnected() ? 'postgresql' : 'memory';
  }

  async create(data: CreateFolhaInput): Promise<Folha> {
    const repo = this.getRepository();
    return repo.create(data);
  }

  async getForTelao(limit = 100): Promise<Folha[]> {
    const repo = this.getRepository();
    return repo.findForTelao(limit);
  }

  async getById(id: string): Promise<Folha | null> {
    const repo = this.getRepository();
    return repo.findById(id);
  }

  async getByEditToken(token: string): Promise<Folha | null> {
    const repo = this.getRepository();
    return repo.findByEditToken(token);
  }

  async updateByEditToken(
    token: string,
    data: UpdateFolhaInput
  ): Promise<Folha | null> {
    const repo = this.getRepository();
    return repo.updateByEditToken(token, data);
  }

  async deleteById(id: string): Promise<boolean> {
    const repo = this.getRepository();
    return repo.deleteById(id);
  }

  async getStats(): Promise<{
    total: number;
    repository: 'postgresql' | 'memory';
    databaseConnected: boolean;
  }> {
    const repo = this.getRepository();
    const total = await repo.count();
    return {
      total,
      repository: this.getRepositoryType(),
      databaseConnected: isDatabaseConnected(),
    };
  }

  async exportAll(): Promise<Folha[]> {
    const repo = this.getRepository();
    return repo.findAll();
  }

  /**
   * Reseta a árvore para uma nova turma/apresentação:
   * 1. Salva todas as folhas atuais em um backup JSON com carimbo de tempo
   * 2. Limpa o repositório ativo
   */
  async resetTree(
    sessionLabel = 'turma'
  ): Promise<{ backupFile: string; totalArquivadas: number }> {
    const repo = this.getRepository();
    const currentFolhas = await repo.findAll();

    // Salva o backup apenas se houver folhas cadastradas
    let backupFile = 'nenhuma_folha_para_arquivar';
    if (currentFolhas.length > 0) {
      const backupResult = await backupService.saveSessionBackup(
        currentFolhas,
        sessionLabel
      );
      backupFile = backupResult.filename;
    }

    await repo.resetAll();
    return {
      backupFile,
      totalArquivadas: currentFolhas.length,
    };
  }

  /**
   * Restaura todas as folhas de todos os backups salvos para o encerramento da feira
   */
  async restoreAllFromBackups(): Promise<{ totalRestauradas: number }> {
    const repo = this.getRepository();
    const allArchived = await backupService.loadAllArchivedFolhas();

    if (allArchived.length > 0) {
      await repo.importMany(allArchived);
    }

    return { totalRestauradas: allArchived.length };
  }
}

export const folhaService = new FolhaService();
