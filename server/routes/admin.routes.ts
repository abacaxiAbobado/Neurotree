import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.ts';
import { requireAdminAuth, createAdminSession, clearAdminSession } from '../middleware/auth.middleware.ts';
import { validateBody, validateParams } from '../middleware/validate.middleware.ts';
import { folhaIdParamSchema } from '../schemas/folha.schema.ts';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { config } from '../config/env.ts';

const router = Router();

// Schema para login
const loginSchema = z.object({
  password: z.string().min(1, 'Senha é obrigatória'),
});

// POST /api/admin/login - Login com senha (público, sem auth)
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { password } = req.body;

    if (!config.adminPasswordHash) {
      return res.status(503).json({
        success: false,
        error: 'NotConfigured',
        message: 'Autenticação admin não configurada no servidor (ADMIN_PASSWORD_HASH ausente).',
      });
    }

    const isValid = await bcrypt.compare(password, config.adminPasswordHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Senha incorreta.',
      });
    }

    // Cria sessão JWT em cookie HttpOnly
    createAdminSession(res);

    return res.json({
      success: true,
      message: 'Login realizado com sucesso.',
    });
  } catch (error) {
    console.error('Erro no login admin:', error);
    return res.status(500).json({
      success: false,
      error: 'LoginError',
      message: 'Erro interno ao processar login.',
    });
  }
});

// POST /api/admin/logout - Logout (requer auth)
router.post('/logout', requireAdminAuth, (req, res) => {
  clearAdminSession(res);
  return res.json({
    success: true,
    message: 'Logout realizado com sucesso.',
  });
});

// GET /api/admin/me - Verifica sessão atual (requer auth)
router.get('/me', requireAdminAuth, (req, res) => {
  return res.json({
    success: true,
    data: { role: 'admin' },
  });
});

// Rotas abaixo requerem autenticação admin
router.use(requireAdminAuth);

// DELETE /api/admin/folha/:id - Exclusão de folha imprópria
router.delete(
  '/folha/:id',
  validateParams(folhaIdParamSchema),
  adminController.deleteFolha.bind(adminController)
);

// POST /api/admin/reset - Reset seguro da árvore com geração de backup JSON para nova turma
router.post('/reset', adminController.resetTree.bind(adminController));

// GET /api/admin/export - Download de todas as folhas ativas em JSON
router.get('/export', adminController.exportLeaves.bind(adminController));

// GET /api/admin/backups - Listar backups salvos das apresentações
router.get('/backups', adminController.listBackups.bind(adminController));

// POST /api/admin/restore - Restaurar todas as folhas para a árvore coletiva final
router.post('/restore', adminController.restoreAll.bind(adminController));

// POST /api/admin/simulate - Simular 100 folhas de uma vez
router.post('/simulate', adminController.simulateLeaves.bind(adminController));

export default router;
