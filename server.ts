import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  closePool,
  getLastDbErrorCode,
  startReconnectLoop,
  testConnection,
} from './server/config/database.ts';
import { config } from './server/config/env.ts';
import { errorHandler } from './server/middleware/error.middleware.ts';
import adminRoutes from './server/routes/admin.routes.ts';
import folhaRoutes from './server/routes/folha.routes.ts';
import { folhaService } from './server/services/folha.service.ts';
import { initSocketServer } from './server/socket/socket.handler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // 1. Inicializa o servidor Socket.IO no mesmo servidor HTTP
  initSocketServer(httpServer);

  // 2. Middlewares de requisição
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' })); // Suporta Base64 da assinatura
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 3. Health Check
  app.get('/api/health', async (_req, res) => {
    const stats = await folhaService.getStats();
    res.json({
      status: 'ok',
      service: 'NEUROTREE Back-End',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      database: {
        type: stats.repository,
        connected: stats.databaseConnected,
        // Código curto do último erro de conexão (ex.: ECONNREFUSED, ENOTFOUND, 28P01, NO_CONFIG)
        error: stats.databaseConnected ? null : getLastDbErrorCode(),
      },
      totalFolhas: stats.total,
    });
  });

  // 4. Rotas da API REST
  app.use('/api/folha', folhaRoutes);
  app.use('/api/admin', adminRoutes);

  // 5. Middleware de erro para rotas da API
  app.use('/api', errorHandler);

  // 6. Integração do Front-End React
  if (config.isProduction) {
    // Modo Produção: serve os assets compilados do diretório /dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Modo Desenvolvimento: monta o middleware do Vite para HMR e SPA sem conflito
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // 7. Encerramento gracioso
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Sinal ${signal} recebido. Encerrando servidor de forma graciosa...`);
    httpServer.close(async () => {
      await closePool();
      console.log('✅ Servidor encerrado.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('❌ Encerramento forçado por timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 8. Teste de conexão e inicialização
  await testConnection();
  startReconnectLoop();

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(
      `🚀 [NEUROTREE] Servidor unificado rodando na porta ${config.port} (${config.nodeEnv})`
    );
    console.log(
      `🌳 Repositório ativo: ${folhaService.getRepositoryType().toUpperCase()}`
    );
  });
}

startServer().catch((error) => {
  console.error('❌ Falha fatal ao iniciar o servidor:', error);
  process.exit(1);
});
