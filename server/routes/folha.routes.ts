import { Router } from 'express';
import { folhaController } from '../controllers/folha.controller.ts';
import { folhaRateLimiter } from '../middleware/rateLimit.middleware.ts';
import {
  validateBody,
  validateParams,
} from '../middleware/validate.middleware.ts';
import {
  createFolhaSchema,
  editTokenParamSchema,
  folhaIdParamSchema,
  updateFolhaSchema,
} from '../schemas/folha.schema.ts';

const router = Router();

// POST /api/folha - Cadastro com rate limit inteligente e validação Zod
router.post(
  '/',
  folhaRateLimiter,
  validateBody(createFolhaSchema),
  folhaController.create.bind(folhaController)
);

// GET /api/folha - Listagem para o telão
router.get('/', folhaController.listForTelao.bind(folhaController));

// GET /api/folha/stats - Estatísticas e contagem
router.get('/stats', folhaController.getStats.bind(folhaController));

// GET /api/folha/:id - Detalhes de uma folha por ID
router.get(
  '/:id',
  validateParams(folhaIdParamSchema),
  folhaController.getById.bind(folhaController)
);

// PATCH /api/folha/edit/:token - Edição nos 15 minutos iniciais
router.patch(
  '/edit/:token',
  validateParams(editTokenParamSchema),
  validateBody(updateFolhaSchema),
  folhaController.updateByEditToken.bind(folhaController)
);

export default router;
