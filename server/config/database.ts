import pg from 'pg';
import { config } from './env.ts';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 DNS resolution - Render free tier doesn't support IPv6 outbound
setDefaultResultOrder('ipv4first');

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isConnected = false;

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
 * Testa a conexão com o banco de dados
 */
export async function testConnection(): Promise<boolean> {
  const activePool = getDbPool();
  if (!activePool) {
    isConnected = false;
    return false;
  }

  try {
    const client = await activePool.connect();
    try {
      const res = await client.query('SELECT NOW() as now');
      isConnected = true;
      console.log('✅ Conectado com sucesso ao PostgreSQL:', res.rows[0].now);
      await ensureBackupTable(client);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    isConnected = false;
    console.warn(
      '⚠️ Não foi possível conectar ao PostgreSQL externo. O sistema ativará o fallback em memória resiliente:',
      (error as Error).message
    );
    return false;
  }
}

/**
 * Garante que a tabela de backups exista (idempotente).
 * Falhar aqui não derruba a conexão: só registra o aviso.
 */
async function ensureBackupTable(client: pg.PoolClient): Promise<void> {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_sessao (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label VARCHAR(100) NOT NULL,
        folhas_snapshot JSONB NOT NULL,
        total_folhas INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        repo_type VARCHAR(20) NOT NULL DEFAULT 'memory'
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_backup_sessao_created_at_desc ON backup_sessao (created_at DESC)'
    );
  } catch (error) {
    console.warn('⚠️ Não foi possível garantir a tabela backup_sessao:', (error as Error).message);
  }
}

let reconnectTimer: NodeJS.Timeout | null = null;

/**
 * Enquanto o banco estiver desconectado, tenta reconectar a cada 15 s,
 * para o servidor não ficar preso no fallback em memória.
 */
export function startReconnectLoop(intervalMs = 15000): void {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(async () => {
    if (isConnected) return;
    console.warn('⚠️ Banco desconectado: tentando reconectar...');
    await testConnection();
  }, intervalMs);
  reconnectTimer.unref();
}

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    console.log('🔌 Pool do PostgreSQL encerrado com sucesso.');
  }
}
