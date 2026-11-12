import fs from 'fs';
import path from 'path';
import { Folha } from '../repositories/folha.repository.ts';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export class BackupService {
  constructor() {
    this.ensureBackupDir();
  }

  private ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Salva um snapshot das folhas da sessão atual em disco
   */
  async saveSessionBackup(
    folhas: Folha[],
    label = 'apresentacao'
  ): Promise<{ filename: string; filePath: string; count: number }> {
    this.ensureBackupDir();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    const filename = `sessao_${label}_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    const payload = {
      createdAt: new Date().toISOString(),
      label,
      totalFolhas: folhas.length,
      folhas,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 Backup de sessão salvo com sucesso em: ${filePath}`);

    return {
      filename,
      filePath,
      count: folhas.length,
    };
  }

  /**
   * Lista todos os backups de sessões disponíveis
   */
  async listBackups(): Promise<
    { filename: string; createdAt: string; totalFolhas: number; label: string }[]
  > {
    this.ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    const list = files.map((file) => {
      try {
        const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf-8');
        const parsed = JSON.parse(content);
        return {
          filename: file,
          createdAt: parsed.createdAt || 'Desconhecida',
          totalFolhas: parsed.totalFolhas || parsed.folhas?.length || 0,
          label: parsed.label || 'sessao',
        };
      } catch {
        return {
          filename: file,
          createdAt: 'Erro ao ler',
          totalFolhas: 0,
          label: 'invalido',
        };
      }
    });

    return list.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  /**
   * Carrega as folhas de um arquivo de backup específico
   */
  async readBackup(filename: string): Promise<Folha[]> {
    this.ensureBackupDir();
    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo de backup não encontrado: ${safeFilename}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.folhas || [];
  }

  /**
   * Carrega e consolida todas as folhas de TODOS os backups existentes
   */
  async loadAllArchivedFolhas(): Promise<Folha[]> {
    this.ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
    const folhaMap = new Map<string, Folha>();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf-8');
        const parsed = JSON.parse(content);
        const folhas: Folha[] = Array.isArray(parsed)
          ? parsed
          : parsed.folhas || [];
        for (const f of folhas) {
          if (f.id && !folhaMap.has(f.id)) {
            folhaMap.set(f.id, f);
          }
        }
      } catch (err) {
        console.warn(`Erro ao ler arquivo de backup ${file}:`, err);
      }
    }

    return Array.from(folhaMap.values());
  }
}

export const backupService = new BackupService();
