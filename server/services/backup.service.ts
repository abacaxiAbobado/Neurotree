import fs from 'fs';
import path from 'path';
import { getDbPool, isDatabaseConnected } from '../config/database.ts';
import { Folha } from '../repositories/folha.repository.ts';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

type BackupInfo = {
  filename: string;
  createdAt: string;
  totalFolhas: number;
  label: string;
};

/**
 * Backups de sessão.
 *
 * - Com PostgreSQL conectado: os backups ficam na tabela `folha_backup` (sobrevivem a
 *   reinícios e novos deploys do servidor).
 * - Sem banco (fallback em memória, desenvolvimento/testes): usa arquivos .json na pasta
 *   `backups/`, como antes.
 */
export class BackupService {
  private tableReady = false;

  constructor() {
    // A pasta de arquivos só é criada sob demanda (modo sem banco).
  }

  private usePg(): boolean {
    return isDatabaseConnected() && getDbPool() !== null;
  }

  /** Cria a tabela de backups se ainda não existir (sem precisar rodar migration manual). */
  private async ensureTable(): Promise<void> {
    if (this.tableReady) return;
    const pool = getDbPool();
    if (!pool) throw new Error('Pool do PostgreSQL não está disponível.');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folha_backup (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        label TEXT NOT NULL,
        total_folhas INTEGER NOT NULL DEFAULT 0,
        folhas JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.tableReady = true;
  }

  private ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  private buildFilename(label: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    return `sessao_${label}_${timestamp}.json`;
  }

  /**
   * Salva um snapshot das folhas da sessão atual
   */
  async saveSessionBackup(
    folhas: Folha[],
    label = 'apresentacao'
  ): Promise<{ filename: string; filePath: string; count: number }> {
    const filename = this.buildFilename(label);

    if (this.usePg()) {
      await this.ensureTable();
      const pool = getDbPool()!;
      await pool.query(
        `INSERT INTO folha_backup (filename, label, total_folhas, folhas)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [filename, label, folhas.length, JSON.stringify(folhas)]
      );
      console.log(`💾 Backup de sessão salvo no PostgreSQL: ${filename} (${folhas.length} folhas)`);
      return { filename, filePath: `postgres:folha_backup/${filename}`, count: folhas.length };
    }

    this.ensureBackupDir();
    const filePath = path.join(BACKUP_DIR, filename);
    const payload = {
      createdAt: new Date().toISOString(),
      label,
      totalFolhas: folhas.length,
      folhas,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 Backup de sessão salvo com sucesso em: ${filePath}`);

    return { filename, filePath, count: folhas.length };
  }

  /**
   * Lista todos os backups de sessões disponíveis
   */
  async listBackups(): Promise<BackupInfo[]> {
    if (this.usePg()) {
      await this.ensureTable();
      const pool = getDbPool()!;
      const { rows } = await pool.query<{
        filename: string;
        label: string;
        total_folhas: number;
        created_at: Date | string;
      }>(
        `SELECT filename, label, total_folhas, created_at
           FROM folha_backup
          ORDER BY created_at DESC, id DESC`
      );
      return rows.map((r) => ({
        filename: r.filename,
        createdAt: new Date(r.created_at).toISOString(),
        totalFolhas: Number(r.total_folhas),
        label: r.label,
      }));
    }

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
   * Carrega as folhas de um backup específico
   */
  async readBackup(filename: string): Promise<Folha[]> {
    const safeFilename = path.basename(filename);

    if (this.usePg()) {
      await this.ensureTable();
      const pool = getDbPool()!;
      const { rows } = await pool.query<{ folhas: Folha[] }>(
        `SELECT folhas FROM folha_backup WHERE filename = $1 ORDER BY id DESC LIMIT 1`,
        [safeFilename]
      );
      if (rows.length === 0) {
        throw new Error(`Backup não encontrado: ${safeFilename}`);
      }
      return Array.isArray(rows[0].folhas) ? rows[0].folhas : [];
    }

    this.ensureBackupDir();
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
    const folhaMap = new Map<string, Folha>();
    const absorb = (folhas: Folha[]) => {
      for (const f of folhas) {
        if (f.id && !folhaMap.has(f.id)) {
          folhaMap.set(f.id, f);
        }
      }
    };

    if (this.usePg()) {
      await this.ensureTable();
      const pool = getDbPool()!;
      const { rows } = await pool.query<{ folhas: Folha[] }>(
        `SELECT folhas FROM folha_backup ORDER BY created_at ASC, id ASC`
      );
      for (const row of rows) {
        absorb(Array.isArray(row.folhas) ? row.folhas : []);
      }
      return Array.from(folhaMap.values());
    }

    this.ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf-8');
        const parsed = JSON.parse(content);
        absorb(Array.isArray(parsed) ? parsed : parsed.folhas || []);
      } catch (err) {
        console.warn(`Erro ao ler arquivo de backup ${file}:`, err);
      }
    }

    return Array.from(folhaMap.values());
  }
}

export const backupService = new BackupService();
