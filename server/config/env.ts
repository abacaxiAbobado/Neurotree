import dotenv from 'dotenv';

dotenv.config();

// Render managed PostgreSQL provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT, PGSSLMODE
// Railway provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT, PGSSLMODE (similar)
// Supabase provides DATABASE_URL and optionally DB_HOST, DB_PORT, etc.
// Fallback to Render managed PG env vars for IPv4 connections (connectionString uses IPv6)
// Se DATABASE_URL estiver definida (ex.: string do Supabase), ela é decomposta em
// host/porta/banco/usuário/senha. Variáveis individuais (DB_*) têm prioridade quando definidas.
// O pool usa parâmetros individuais (e não connectionString) para forçar IPv4.
interface ParsedDatabaseUrl {
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
  sslmode?: string;
}

function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) return {};
  try {
    const u = new URL(url);
    return {
      host: u.hostname || undefined,
      port: u.port || undefined,
      database: u.pathname.replace(/^\//, '') || undefined,
      user: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      sslmode: u.searchParams.get('sslmode') || undefined,
    };
  } catch {
    console.warn('⚠️ DATABASE_URL inválida: não foi possível interpretá-la. Ignorando.');
    return {};
  }
}

const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL || '');

const dbHost = process.env.DB_HOST || process.env.PGHOST || fromUrl.host || 'localhost';
const dbPort = process.env.DB_PORT || process.env.PGPORT || fromUrl.port || '5432';
const dbName = process.env.DB_NAME || process.env.PGDATABASE || fromUrl.database || 'neurotree';
const dbUser = process.env.DB_USER || process.env.PGUSER || fromUrl.user || 'postgres';
const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || fromUrl.password || '';
const dbSslMode = (
  process.env.DB_SSL ||
  process.env.PGSSLMODE ||
  fromUrl.sslmode ||
  ''
)
  .trim()
  .toLowerCase();

// Aceita true/1/require/verify-full/verify-ca/no-verify (DB_SSL=true antes era ignorado)
const SSL_ON_VALUES = ['true', '1', 'yes', 'require', 'verify-full', 'verify-ca', 'no-verify'];

// Admin authentication - bcrypt hash (generate with: node -e "console.log(require('bcrypt').hashSync('sua_senha', 12))")
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
// JWT secret for admin session cookies (min 32 chars recommended)
const jwtSecret = process.env.JWT_SECRET || 'neurotree_jwt_secret_change_in_production_32chars';

export const config = {
  port: parseInt(
    process.env.APP_PORT ||
      (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '3000'),
    10
  ),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database configuration
  // Render managed PG connection string (DATABASE_URL) usa IPv6 hostnames
  // Usamos variáveis individuais (DB_HOST, PGHOST, etc.) para forçar IPv4
  databaseUrl: process.env.DATABASE_URL || '',
  dbHost,
  dbPort: parseInt(dbPort, 10),
  dbName,
  dbUser,
  dbPassword,
  dbSsl: SSL_ON_VALUES.includes(dbSslMode),

  // Admin authentication
  adminPasswordHash,
  jwtSecret,
  adminSessionMaxAge: 4 * 60 * 60 * 1000, // 4 hours

  // Rate Limiting settings (adaptive for school Wi-Fi)
  rateLimitMaxPerMinute: parseInt(process.env.RATE_LIMIT_POINTS || '60', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_DURATION || '60', 10) * 1000,
};