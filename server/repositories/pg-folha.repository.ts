import { getDbPool } from '../config/database.ts';
import { queries } from '../constants/queries.ts';
import { CreateFolhaInput, UpdateFolhaInput } from '../schemas/folha.schema.ts';
import { Folha, IFolhaRepository } from './folha.repository.ts';

export class PgFolhaRepository implements IFolhaRepository {
  private getPool() {
    const pool = getDbPool();
    if (!pool) {
      throw new Error('Pool do PostgreSQL não está disponível.');
    }
    return pool;
  }

  async create(data: CreateFolhaInput): Promise<Folha> {
    const pool = this.getPool();
    const { rows } = await pool.query<Folha>(queries.insertFolha.text, [
      data.nome,
      data.cor,
      data.profissao,
      data.assinatura,
      data.mensagem || '',
    ]);
    return rows[0];
  }

  async findForTelao(limit = 100): Promise<Folha[]> {
    const pool = this.getPool();
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const { rows } = await pool.query<Folha>(queries.selectFolhasForTelao.text, [
      safeLimit,
    ]);
    return rows;
  }

  async findById(id: string): Promise<Folha | null> {
    const pool = this.getPool();
    const { rows } = await pool.query<Folha>(queries.selectFolhaById.text, [id]);
    return rows[0] || null;
  }

  async findByEditToken(token: string): Promise<Folha | null> {
    const pool = this.getPool();
    const { rows } = await pool.query<Folha>(queries.selectFolhaByEditToken.text, [
      token,
    ]);
    return rows[0] || null;
  }

  async updateByEditToken(
    token: string,
    data: UpdateFolhaInput
  ): Promise<Folha | null> {
    const pool = this.getPool();
    const { rows } = await pool.query<Folha>(queries.updateFolha.text, [
      token,
      data.nome ?? null,
      data.cor ?? null,
      data.profissao ?? null,
      data.assinatura ?? null,
      data.mensagem ?? null,
    ]);
    return rows[0] || null;
  }

  async deleteById(id: string): Promise<boolean> {
    const pool = this.getPool();
    const { rowCount } = await pool.query(queries.deleteFolha.text, [id]);
    return (rowCount ?? 0) > 0;
  }

  async count(): Promise<number> {
    const pool = this.getPool();
    const { rows } = await pool.query<{ total: number }>(queries.countFolhas.text);
    return Number(rows[0]?.total || 0);
  }

  async findAll(): Promise<Folha[]> {
    const pool = this.getPool();
    const { rows } = await pool.query<Folha>(queries.selectAllFolhas.text);
    return rows;
  }

  async resetAll(): Promise<void> {
    const pool = this.getPool();
    await pool.query(queries.truncateFolha.text);
  }

  async importMany(folhas: Folha[]): Promise<number> {
    const pool = this.getPool();
    let importedCount = 0;
    for (const folha of folhas) {
      await pool.query(
        `INSERT INTO folha (id, nome, cor, profissao, assinatura, mensagem, edit_token, edit_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          folha.id,
          folha.nome,
          folha.cor,
          folha.profissao,
          folha.assinatura,
          folha.mensagem || '',
          folha.edit_token,
          folha.edit_expires_at,
          folha.created_at,
          folha.updated_at,
        ]
      );
      importedCount++;
    }
    return importedCount;
  }
}
