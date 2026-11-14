import dotenv from 'dotenv';

dotenv.config();

// Render managed PostgreSQL provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT, PGSSLMODE
// Railway provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT, PGSSLMODE (similar)
// Supabase provides DATABASE_URL and optionally DB_HOST, DB_PORT, etc.
// Fallback to Render managed PG env vars for IPv4 connections (connectionString uses IPv6)
const dbHost = process.env.DB_HOST || process.env.PGHOST || 'localhost';
const dbPort = process.env.DB_PORT || process.env.PGPORT || '5432';
const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'neurotree';
const dbUser = process.env.DB_USER || process.env.PGUSER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
const dbSslMode = process.env.DB_SSL || process.env.PGSSLMODE || '';

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
  dbSsl: dbSslMode === 'require' || dbSslMode === 'verify-full',

  // Admin security token
  adminToken: process.env.ADMIN_TOKEN || 'neurotree_admin_secret_2026',

  // Rate Limiting settings (adaptive for school Wi-Fi)
  rateLimitMaxPerMinute: parseInt(process.env.RATE_LIMIT_POINTS || '60', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_DURATION || '60', 10) * 1000,
};