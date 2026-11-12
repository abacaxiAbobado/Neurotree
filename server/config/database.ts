import pg from 'pg';
import { config } from './env.ts';

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
    const poolConfig: pg.PoolConfig = config.databaseUrl
      ? {
          connectionString: config.databaseUrl,
          ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        }
      : {
          host: config.dbHost,
          port: config.dbPort,
          database: config.dbName,
          user: config.dbUser,
          password: config.dbPassword,
          ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
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
