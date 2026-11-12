# NEUROTREE - Back-end Integration Guide

## 📋 Visão Geral

Guia para integrar o banco de dados PostgreSQL ao back-end Node.js/Express com Socket.IO.

## 🗂 Estrutura Sugerida do Projeto

```
src/
├── config/
│   └── database.js          # Pool pg + config
├── db/
│   ├── queries.js           # Prepared statements
│   └── repository.js        # Data access layer
├── validation/
│   └── schemas.js           # Zod schemas
├── routes/
│   └── folha.js             # REST routes
├── socket/
│   └── handlers.js          # Socket.IO events
├── middleware/
│   ├── auth.js              # Admin token auth
│   ├── rateLimit.js         # Rate limiting
│   └── validation.js        # Request validation
└── app.js                   # Express + Socket.IO setup
```

---

## 1. Configuração do Banco (`config/database.js`)

```javascript
// config/database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'neurotree',
  user: process.env.DB_USER || 'neurotree_user',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Pool tuning para 20 conexões simultâneas
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

export async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as now');
    console.log('✅ Database connected:', result.rows[0].now);
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
  console.log('🔌 Database pool closed');
}
```

---

## 2. Prepared Statements (`db/queries.js`)

```javascript
// db/queries.js
// Prepared statements para performance e segurança (SQL injection prevention)

export const queries = {
  // CREATE - Inserir nova folha
  insertFolha: {
    name: 'insert_folha',
    text: `
      INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nome, cor, profissao, assinatura, mensagem,
                edit_token, edit_expires_at, created_at, updated_at
    `,
    values: (nome, cor, profissao, assinatura, mensagem) => [
      nome, cor, profissao, assinatura, mensagem
    ],
  },

  // READ - Listar para telão (tempo real)
  selectFolhasForTelao: {
    name: 'select_folhas_telao',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem, created_at
      FROM folha
      ORDER BY created_at DESC
      LIMIT $1
    `,
    values: (limit = 100) => [limit],
  },

  // READ - Buscar por ID (para admin/debug)
  selectFolhaById: {
    name: 'select_folha_by_id',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem,
             edit_token, edit_expires_at, created_at, updated_at
      FROM folha
      WHERE id = $1
    `,
    values: (id) => [id],
  },

  // READ - Buscar por token de edição
  selectFolhaByEditToken: {
    name: 'select_folha_by_edit_token',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem,
             edit_token, edit_expires_at, created_at, updated_at
      FROM folha
      WHERE edit_token = $1 AND edit_expires_at > now()
    `,
    values: (token) => [token],
  },

  // UPDATE - Editar folha (com validação de token e expiração)
  updateFolha: {
    name: 'update_folha',
    text: `
      UPDATE folha
      SET nome = $2, cor = $3, profissao = $4, assinatura = $5, mensagem = $6
      WHERE edit_token = $1 AND edit_expires_at > now()
      RETURNING id, nome, cor, profissao, assinatura, mensagem,
                edit_token, edit_expires_at, created_at, updated_at
    `,
    values: (token, nome, cor, profissao, assinatura, mensagem) => [
      token, nome, cor, profissao, assinatura, mensagem
    ],
  },

  // DELETE - Admin deleta folha
  deleteFolha: {
    name: 'delete_folha',
    text: 'DELETE FROM folha WHERE id = $1 RETURNING id',
    values: (id) => [id],
  },

  // STATS - Contar total de folhas
  countFolhas: {
    name: 'count_folhas',
    text: 'SELECT COUNT(*) as total FROM folha',
    values: () => [],
  },
};
```

---

## 3. Repository Layer (`db/repository.js`)

```javascript
// db/repository.js
import { pool } from '../config/database.js';
import { queries } from './queries.js';

export class FolhaRepository {
  // Criar nova folha
  async create(folhaData) {
    const { rows } = await pool.query(
      queries.insertFolha.text,
      queries.insertFolha.values(
        folhaData.nome,
        folhaData.cor,
        folhaData.profissao,
        folhaData.assinatura,
        folhaData.mensagem || ''
      )
    );
    return rows[0];
  }

  // Listar para telão (ordenado por mais recente)
  async findForTelao(limit = 100) {
    const { rows } = await pool.query(
      queries.selectFolhasForTelao.text,
      queries.selectFolhasForTelao.values(limit)
    );
    return rows;
  }

  // Buscar por ID
  async findById(id) {
    const { rows } = await pool.query(
      queries.selectFolhaById.text,
      queries.selectFolhaById.values(id)
    );
    return rows[0] || null;
  }

  // Buscar por token de edição (válido e não expirado)
  async findByEditToken(token) {
    const { rows } = await pool.query(
      queries.selectFolhaByEditToken.text,
      queries.selectFolhaByEditToken.values(token)
    );
    return rows[0] || null;
  }

  // Atualizar folha via token de edição
  async updateByEditToken(token, folhaData) {
    const { rows } = await pool.query(
      queries.updateFolha.text,
      queries.updateFolha.values(
        token,
        folhaData.nome,
        folhaData.cor,
        folhaData.profissao,
        folhaData.assinatura,
        folhaData.mensagem || ''
      )
    );
    return rows[0] || null;
  }

  // Deletar folha (admin)
  async deleteById(id) {
    const { rows } = await pool.query(
      queries.deleteFolha.text,
      queries.deleteFolha.values(id)
    );
    return rows[0] || null;
  }

  // Contar total
  async count() {
    const { rows } = await pool.query(
      queries.countFolhas.text,
      queries.countFolhas.values()
    );
    return parseInt(rows[0].total, 10);
  }
}

// Singleton instance
export const folhaRepository = new FolhaRepository();
```

---

## 4. Validação com Zod (`validation/schemas.js`)

```javascript
// validation/schemas.js
import { z } from 'zod';

// Regex para HEX color (#RRGGBB)
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

// Base64 PNG validation (data URI)
const base64PngRegex = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export const createFolhaSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .trim(),
  cor: z.string()
    .regex(hexColorRegex, 'Cor deve ser HEX válido (#RRGGBB)'),
  profissao: z.string()
    .min(1, 'Profissão é obrigatória')
    .max(100, 'Profissão deve ter no máximo 100 caracteres')
    .trim(),
  assinatura: z.string()
    .regex(base64PngRegex, 'Assinatura deve ser Base64 PNG válido (data:image/png;base64,...)'),
  mensagem: z.string()
    .max(500, 'Mensagem deve ter no máximo 500 caracteres')
    .trim()
    .optional()
    .default(''),
});

export const updateFolhaSchema = createFolhaSchema.partial(); // Todos opcionais para edição

export const editTokenSchema = z.object({
  token: z.string().uuid('Token de edição inválido'),
});

export const folhaIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const adminTokenSchema = z.object({
  authorization: z.string().startsWith('Bearer ', 'Token admin deve ser Bearer token'),
});
```

---

## 5. Middleware (`middleware/validation.js`, `middleware/auth.js`, `middleware/rateLimit.js`)

```javascript
// middleware/validation.js
import { ZodError } from 'zod';

export const validate = (schema) => (req, res, next) => {
  try {
    req.validated = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Dados inválidos',
        details: error.flatten().fieldErrors,
      });
    }
    next(error);
  }
};

export const validateParams = (schema) => (req, res, next) => {
  try {
    req.validatedParams = schema.parse(req.params);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Parâmetros inválidos',
        details: error.flatten().fieldErrors,
      });
    }
    next(error);
  }
};
```

```javascript
// middleware/auth.js
export const requireAdminToken = (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const authHeader = req.headers.authorization;

  if (!adminToken) {
    console.error('❌ ADMIN_TOKEN não configurado no .env');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  if (token !== adminToken) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
};
```

```javascript
// middleware/rateLimit.js
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 5 requests por minuto por IP
const createLimiter = () => new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60 * 15, // Block por 15 min se exceder
});

const limiter = createLimiter();

export const rateLimit = async (req, res, next) => {
  try {
    const key = req.ip;
    await limiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    return res.status(429).json({
      error: 'TooManyRequests',
      message: 'Muitas requisições. Tente novamente em alguns segundos.',
      retryAfter: secs,
    });
  }
};
```

---

## 6. Rotas REST (`routes/folha.js`)

```javascript
// routes/folha.js
import { Router } from 'express';
import { folhaRepository } from '../db/repository.js';
import { validate, validateParams } from '../middleware/validation.js';
import { requireAdminToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  createFolhaSchema,
  updateFolhaSchema,
  editTokenSchema,
  folhaIdSchema,
} from '../validation/schemas.js';
import { io } from '../app.js'; // Socket.IO instance (ver app.js)

const router = Router();

// POST /api/folha - Criar nova folha (com rate limit)
router.post('/', rateLimit, validate(createFolhaSchema), async (req, res, next) => {
  try {
    const folha = await folhaRepository.create(req.validated);

    // Emitir evento Socket.IO para telão em tempo real
    io.emit('folha:created', folha);

    res.status(201).json({
      success: true,
      data: folha,
      // Retornar token de edição para o front guardar no localStorage
      editToken: folha.edit_token,
      editExpiresAt: folha.edit_expires_at,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/folha - Listar para telão (últimas 100)
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const folhas = await folhaRepository.findForTelao(limit);
    res.json({ success: true, data: folhas });
  } catch (error) {
    next(error);
  }
});

// GET /api/folha/:id - Buscar por ID (debug/admin)
router.get('/:id', validateParams(folhaIdSchema), async (req, res, next) => {
  try {
    const folha = await folhaRepository.findById(req.validatedParams.id);
    if (!folha) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }
    res.json({ success: true, data: folha });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/folha/edit/:token - Editar via token (15 min)
router.patch('/edit/:token', validateParams(editTokenSchema), validate(updateFolhaSchema), async (req, res, next) => {
  try {
    const folha = await folhaRepository.updateByEditToken(
      req.validatedParams.token,
      req.validated
    );

    if (!folha) {
      return res.status(404).json({
        error: 'Folha não encontrada ou token expirado/inválido',
      });
    }

    // Emitir atualização para telão
    io.emit('folha:updated', folha);

    res.json({ success: true, data: folha });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/folha/:id - Admin deleta folha
router.delete('/:id', requireAdminToken, validateParams(folhaIdSchema), async (req, res, next) => {
  try {
    const deleted = await folhaRepository.deleteById(req.validatedParams.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Folha não encontrada' });
    }

    // Emitir deleção para telão
    io.emit('folha:deleted', { id: req.validatedParams.id });

    res.json({ success: true, message: 'Folha removida' });
  } catch (error) {
    next(error);
  }
});

// GET /api/stats - Estatísticas simples
router.get('/stats', async (req, res, next) => {
  try {
    const total = await folhaRepository.count();
    res.json({ success: true, data: { total } });
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## 7. Socket.IO Integration (`socket/handlers.js`)

```javascript
// socket/handlers.js
import { folhaRepository } from '../db/repository.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Cliente (telão) solicita estado inicial
    socket.on('telao:getInitialState', async (callback) => {
      try {
        const folhas = await folhaRepository.findForTelao(100);
        callback({ success: true, data: folhas });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Cliente (participante) solicita sua folha para edição
    socket.on('folha:getForEdit', async ({ token }, callback) => {
      try {
        const folha = await folhaRepository.findByEditToken(token);
        if (!folha) {
          return callback({ success: false, error: 'Token inválido ou expirado' });
        }
        callback({ success: true, data: folha });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

// Eventos emitidos pelo back-end (chamados nas rotas):
// io.emit('folha:created', folha)      // Nova folha adicionada
// io.emit('folha:updated', folha)      // Folha editada
// io.emit('folha:deleted', { id })     // Folha removida
```

---

## 8. App Principal (`app.js`)

```javascript
// app.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { pool, testConnection, closePool } from './config/database.js';
import folhaRoutes from './routes/folha.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // Base64 PNG ~30KB
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/folha', folhaRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'Rota não encontrada' });
});

// Global error handler
app.use(errorHandler);

// Socket.IO handlers
setupSocketHandlers(io);

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  httpServer.close(async () => {
    await closePool();
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('❌ Force shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await testConnection();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

start();
```

---

## 9. Error Handler (`middleware/errorHandler.js`)

```javascript
// middleware/errorHandler.js
import { ZodError } from 'zod';
import pg from 'pg';

export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Dados inválidos',
      details: err.flatten().fieldErrors,
    });
  }

  // Postgres unique violation (edit_token duplicado - improvável com UUID)
  if (err instanceof pg.DatabaseError && err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Recurso já existe',
    });
  }

  // Postgres check constraint violation
  if (err instanceof pg.DatabaseError && err.code === '23514') {
    const constraint = err.constraint;
    return res.status(400).json({
      error: 'ConstraintViolation',
      message: `Violação de regra: ${constraint}`,
    });
  }

  // Default error
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message,
  });
}
```

---

## 10. Testes Sugeridos

```javascript
// tests/folha.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, io } from '../src/app.js';
import { pool } from '../src/config/database.js';
import { folhaRepository } from '../src/db/repository.js';

const validFolha = {
  nome: 'Teste',
  cor: '#3B82F6',
  profissao: 'Desenvolvedor',
  assinatura: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
  mensagem: 'Teste de integração',
};

describe('Folha API', () => {
  beforeAll(async () => {
    // Limpar tabela antes dos testes
    await pool.query('TRUNCATE TABLE folha RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('POST /api/folha - deve criar folha válida', async () => {
    const res = await request(app)
      .post('/api/folha')
      .send(validFolha)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.nome).toBe('Teste');
    expect(res.body).toHaveProperty('editToken');
  });

  it('POST /api/folha - deve rejeitar nome curto', async () => {
    await request(app)
      .post('/api/folha')
      .send({ ...validFolha, nome: 'A' })
      .expect(400);
  });

  it('POST /api/folha - deve rejeitar cor inválida', async () => {
    await request(app)
      .post('/api/folha')
      .send({ ...validFolha, cor: 'azul' })
      .expect(400);
  });

  it('GET /api/folha - deve listar folhas', async () => {
    const res = await request(app).get('/api/folha').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PATCH /api/folha/edit/:token - deve editar com token válido', async () => {
    // Criar folha
    const createRes = await request(app)
      .post('/api/folha')
      .send(validFolha);

    const token = createRes.body.editToken;

    // Editar
    const res = await request(app)
      .patch(`/api/folha/edit/${token}`)
      .send({ nome: 'Teste Editado', mensagem: 'Editado!' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.nome).toBe('Teste Editado');
  });

  it('PATCH /api/folha/edit/:token - deve rejeitar token inválido', async () => {
    await request(app)
      .patch('/api/folha/edit/00000000-0000-0000-0000-000000000000')
      .send({ nome: 'Hack' })
      .expect(404);
  });

  it('DELETE /api/folha/:id - deve deletar com admin token', async () => {
    const createRes = await request(app)
      .post('/api/folha')
      .send(validFolha);

    const id = createRes.body.data.id;

    await request(app)
      .delete(`/api/folha/${id}`)
      .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);
  });
});
```

---

## 11. Variáveis de Ambiente Completas (`.env`)

```bash
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neurotree
DB_USER=neurotree_user
DB_PASSWORD=sua_senha_segura
DB_SSL=false

# Admin
ADMIN_TOKEN=neurotree2024_admin_secret_change_in_production

# Rate Limit (opcional - usa defaults se não definido)
RATE_LIMIT_POINTS=5
RATE_LIMIT_DURATION=60
```

---

## 12. Dependências Necessárias

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "pg": "^8.11.x",
    "socket.io": "^4.7.x",
    "cors": "^2.8.x",
    "dotenv": "^16.3.x",
    "zod": "^3.22.x",
    "rate-limiter-flexible": "^5.0.x"
  },
  "devDependencies": {
    "vitest": "^1.0.x",
    "supertest": "^6.3.x",
    "@types/node": "^20.x",
    "@types/express": "^4.17.x",
    "@types/pg": "^8.10.x",
    "@types/cors": "^2.8.x"
  }
}
```

---

## 📋 Checklist de Integração

- [ ] Banco criado e migration rodou (`psql -f sql/001_create_folha_table.sql`)
- [ ] `.env` configurado com credenciais corretas
- [ ] `npm install` com dependências listadas
- [ ] `npm run dev` sobe servidor sem erros
- [ ] `POST /api/folha` cria folha e retorna `editToken`
- [ ] `GET /api/folha` retorna lista ordenada por `created_at DESC`
- [ ] `PATCH /api/folha/edit/:token` edita dentro de 15 min
- [ ] `DELETE /api/folha/:id` com `Authorization: Bearer <ADMIN_TOKEN>` funciona
- [ ] Socket.IO emite `folha:created`, `folha:updated`, `folha:deleted`
- [ ] Front-end recebe eventos e atualiza telão em tempo real
- [ ] Testes passam (`npm test`)

---

## 🚨 Pontos de Atenção

1. **Tamanho do Base64**: `express.json({ limit: '1mb' })` — assinatura ~30 KB, bem dentro do limite.

2. **Rate Limit**: 5 req/min por IP — ajustável via env. Em produção, considere Redis (`rate-limiter-flexible` suporta).

3. **Admin Token**: Troque em produção! Use string longa aleatória (`openssl rand -hex 32`).

4. **SSL**: Em produção (RDS, Cloud SQL, etc.), `DB_SSL=true` e certifique-se do CA.

5. **Timezone**: Banco usa `TIMESTAMPTZ` (UTC). Front-end formata no timezone do usuário.

6. **Cleanup de tokens expirados**: Opcional. Índice `idx_folha_edit_expires_at` permite job noturno:
   ```sql
   -- Opcional: limpar tokens expirados (não apaga folhas, só invalida edição)
   UPDATE folha SET edit_token = gen_random_uuid(), edit_expires_at = now() + interval '15 minutes'
   WHERE edit_expires_at < now() - interval '1 day';
   ```