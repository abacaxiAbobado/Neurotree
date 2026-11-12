import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.ts';
import { requireAdminToken } from '../middleware/auth.middleware.ts';
import { validateParams } from '../middleware/validate.middleware.ts';
import { folhaIdParamSchema } from '../schemas/folha.schema.ts';

const router = Router();

// Todas as rotas administrativas requerem o header Authorization: Bearer <ADMIN_TOKEN>
router.use(requireAdminToken);

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
