import fs from 'fs';
import path from 'path';
import { getDbPool, isDatabaseConnected } from '../config/database.ts';
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
   * Salva um snapshot das folhas da sessão atual
   * - Se PostgreSQL conectado: salva na tabela backup_sessao
   * - Senão: salva em arquivo JSON no disco (fallback)
   */
  async saveSessionBackup(
    folhas: Folha[],
    label = 'apresentacao'
  ): Promise<{ filename: string; filePath: string; count: number }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    const filename = `sessao_${label}_${timestamp}.json`;

    const payload = {
      createdAt: new Date().toISOString(),
      label,
      totalFolhas: folhas.length,
      folhas,
    };

    // Tenta salvar no banco se PostgreSQL estiver conectado
    if (isDatabaseConnected()) {
      const pool = getDbPool();
      if (pool) {
        try {
          const client = await pool.connect();
          try {
            const folhasJson = JSON.stringify(folhas);
            const result = await client.query(
              `INSERT INTO backup_sessao (label, folhas_snapshot, total_folhas, repo_type)
               VALUES ($1, $2::jsonb, $3, 'postgresql')
               RETURNING id, created_at`,
              [label, folhasJson, folhas.length]
            );
            console.log(`💾 Backup de sessão salvo no PostgreSQL (id: ${result.rows[0].id})`);
            return {
              filename: result.rows[0].id, // UUID do banco
              filePath: `db://backup_sessao/${result.rows[0].id}`,
              count: folhas.length,
            };
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('❌ Erro ao salvar backup no PostgreSQL, caindo para filesystem:', error);
          // Cai para fallback de filesystem
        }
      }
    }

    // Fallback: salva no filesystem
    this.ensureBackupDir();
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`💾 Backup de sessão salvo em arquivo: ${filePath}`);

    return {
      filename,
      filePath,
      count: folhas.length,
    };
  }

  /**
   * Lista todos os backups de sessões disponíveis
   * - Se PostgreSQL conectado: lê da tabela backup_sessao
   * - Senão: lê do filesystem
   */
  async listBackups(): Promise<
    { filename: string; createdAt: string; totalFolhas: number; label: string }[]
  > {
    // Tenta ler do banco se PostgreSQL estiver conectado
    if (isDatabaseConnected()) {
      const pool = getDbPool();
      if (pool) {
        try {
          const result = await pool.query(
            `SELECT id, label, total_folhas, created_at
             FROM backup_sessao
             ORDER BY created_at DESC`
          );
          return result.rows.map((row) => ({
            filename: row.id,
            label: row.label,
            totalFolhas: row.total_folhas,
            createdAt: row.created_at.toISOString(),
          }));
        } catch (error) {
          console.error('❌ Erro ao listar backups do PostgreSQL, caindo para filesystem:', error);
          // Cai para fallback de filesystem
        }
      }
    }

    // Fallback: lê do filesystem
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
   * - Se filename for UUID: tenta buscar no banco
   * - Senão: lê do filesystem
   */
  async readBackup(filename: string): Promise<Folha[]> {
    // Se parece UUID, tenta buscar no banco
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filename);

    if (isUuid && isDatabaseConnected()) {
      const pool = getDbPool();
      if (pool) {
        try {
          const result = await pool.query(
            `SELECT folhas_snapshot FROM backup_sessao WHERE id = $1`,
            [filename]
          );
          if (result.rows.length > 0) {
            const snapshot = result.rows[0].folhas_snapshot;
            return Array.isArray(snapshot) ? snapshot : snapshot.folhas || [];
          }
        } catch (error) {
          console.error('❌ Erro ao ler backup do PostgreSQL, caindo para filesystem:', error);
          // Cai para fallback
        }
      }
    }

    // Fallback: lê do filesystem
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
   * - Se PostgreSQL conectado: lê da tabela backup_sessao
   * - Senão: lê do filesystem
   */
  async loadAllArchivedFolhas(): Promise<Folha[]> {
    // Tenta ler do banco se PostgreSQL estiver conectado
    if (isDatabaseConnected()) {
      const pool = getDbPool();
      if (pool) {
        try {
          const result = await pool.query(
            `SELECT folhas_snapshot FROM backup_sessao ORDER BY created_at DESC`
          );
          const folhaMap = new Map<string, Folha>();

          for (const row of result.rows) {
            const folhas: Folha[] = Array.isArray(row.folhas_snapshot)
              ? row.folhas_snapshot
              : row.folhas_snapshot.folhas || [];
            for (const f of folhas) {
              if (f.id && !folhaMap.has(f.id)) {
                folhaMap.set(f.id, f);
              }
            }
          }

          return Array.from(folhaMap.values());
        } catch (error) {
          console.error('❌ Erro ao carregar backups do PostgreSQL, caindo para filesystem:', error);
          // Cai para fallback
        }
      }
    }

    // Fallback: lê do filesystem
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