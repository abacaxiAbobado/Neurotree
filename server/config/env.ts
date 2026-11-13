import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(
    process.env.APP_PORT ||
      (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '3000'),
    10
  ),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || '',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '5432', 10),
  dbName: process.env.DB_NAME || 'neurotree',
  dbUser: process.env.DB_USER || 'neurotree_user',
  dbPassword: process.env.DB_PASSWORD || '',
  dbSsl: process.env.DB_SSL === 'true',

  // Admin security token
  adminToken: process.env.ADMIN_TOKEN || 'neurotree_admin_secret_2026',

  // Rate Limiting settings (adaptive for school Wi-Fi)
  rateLimitMaxPerMinute: parseInt(process.env.RATE_LIMIT_POINTS || '60', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_DURATION || '60', 10) * 1000,
};
