import pg from 'pg';
import { config } from './env.ts';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 DNS resolution - Render free tier doesn't support IPv6 outbound
setDefaultResultOrder('ipv4first');

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isConnected = false;
// Código do último erro de conexão (ex.: ECONNREFUSED, ENOTFOUND, 28P01) — sem dados sensíveis
let lastErrorCode: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

/**
 * Cria ou retorna o Pool de conexões com o PostgreSQL
 */
export function getDbPool(): pg.Pool | null {
  if (pool) return pool;

  // Verifica se há configuração mínima para conexão
  const hasConfig = Boolean(
    config.databaseUrl || (config.dbHost && config.dbPassword)
  );

  if (!hasConfig) {
    return null;
  }

  try {
    // Use individual params (not connectionString) so `family: 4` is respected
    // connectionString parsing ignores the `family` option in pg
    const poolConfig: pg.PoolConfig = {
      host: config.dbHost,
      port: config.dbPort,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      // Force IPv4 - Render free tier doesn't support IPv6 outbound
      // @ts-expect-error 'family' is valid at runtime but missing from @types/pg
      family: 4,
    };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('❌ Erro inesperado no pool do PostgreSQL:', err.message);
    });

    return pool;
  } catch (error) {
    console.error('⚠️ Falha ao instanciar o pool do PostgreSQL:', error);
    return null;
  }
}

/**
 * Garante que a tabela de backups de sessão (botão "Resetar Árvore") exista.
 * Idempotente: pode rodar a cada conexão sem efeito colateral.
 */
export async function ensureBackupTable(activePool: pg.Pool): Promise<void> {
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS backup_sessao (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label VARCHAR(100) NOT NULL,
      folhas_snapshot JSONB NOT NULL,
      total_folhas INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      repo_type VARCHAR(20) NOT NULL DEFAULT 'postgresql'
    )
  `);
  await activePool.query(
    `CREATE INDEX IF NOT EXISTS idx_backup_sessao_created_at ON backup_sessao (created_at DESC)`
  );
}

/**
 * Testa a conexão com o banco de dados
 */
export async function testConnection(): Promise<boolean> {
  const activePool = getDbPool();
  if (!activePool) {
    isConnected = false;
    lastErrorCode = 'NO_CONFIG';
    return false;
  }

  try {
    const client = await activePool.connect();
    try {
      const res = await client.query('SELECT NOW() as now');
      isConnected = true;
      lastErrorCode = null;
      console.log('✅ Conectado com sucesso ao PostgreSQL:', res.rows[0].now);
    } finally {
      client.release();
    }

    try {
      await ensureBackupTable(activePool);
    } catch (error) {
      // Não derruba a conexão: o salvamento do backup tentará de novo e reportará o erro
      console.warn(
        '⚠️ Conectou, mas não foi possível garantir a tabela backup_sessao:',
        (error as Error).message
      );
    }
    return true;
  } catch (error) {
    isConnected = false;
    const err = error as Error & { code?: string };
    lastErrorCode = err.code || 'UNKNOWN';
    console.warn(
      '⚠️ Não foi possível conectar ao PostgreSQL externo. O sistema ativará o fallback em memória resiliente:',
      err.message
    );
    return false;
  }
}

/**
 * Enquanto o banco estiver desconectado, tenta reconectar a cada intervalo.
 * Evita ficar preso em memória até o próximo deploy depois de uma falha pontual no boot.
 */
export function startReconnectLoop(intervalMs = 30000): void {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(async () => {
    if (isConnected || !getDbPool()) return;
    const ok = await testConnection();
    if (ok) console.log('🔁 Reconexão com o PostgreSQL bem-sucedida.');
  }, intervalMs);
  reconnectTimer.unref();
}

export function stopReconnectLoop(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

export function getLastDbErrorCode(): string | null {
  return lastErrorCode;
}

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export async function closePool(): Promise<void> {
  stopReconnectLoop();
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    console.log('🔌 Pool do PostgreSQL encerrado com sucesso.');
  }
}
