import { NextFunction, Request, Response } from 'express';
import { backupService } from '../services/backup.service.ts';
import { folhaService } from '../services/folha.service.ts';
import {
  emitFolhaDeleted,
  emitFolhaReset,
} from '../socket/socket.handler.ts';

export class AdminController {
  /**
   * DELETE /api/admin/folha/:id
   * Exclusão de folha inadequada pelos organizadores da feira
   */
  async deleteFolha(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const deleted = await folhaService.deleteById(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'NotFound',
          message: 'Folha não encontrada para exclusão.',
        });
      }

      // Emite evento em tempo real para remover a folha do telão
      emitFolhaDeleted(id);

      return res.json({
        success: true,
        message: 'Folha removida com sucesso da árvore.',
        deletedId: id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/reset
   * Reseta a árvore para receber uma nova turma de 20 alunos,
   * salvando automaticamente um backup JSON com todas as folhas anteriores.
   */
  async resetTree(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionLabel =
        (req.body.label as string) ||
        `apresentacao_${new Date().toISOString().slice(0, 10)}`;

      const result = await folhaService.resetTree(sessionLabel);

      // Notifica o telão para reiniciar a árvore visualmente
      emitFolhaReset(result.backupFile);

      return res.json({
        success: true,
        message:
          'Árvore resetada com sucesso para a nova turma. O backup completo foi gerado.',
        backupFile: result.backupFile,
        totalFolhasSalvas: result.totalArquivadas,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/export
   * Faz o download de todas as folhas ativas em formato JSON
   */
  async exportLeaves(_req: Request, res: Response, next: NextFunction) {
    try {
      const folhas = await folhaService.exportAll();

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="neurotree_export_${Date.now()}.json"`
      );

      return res.send(JSON.stringify(folhas, null, 2));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/backups
   * Lista os arquivos de backups de apresentações anteriores
   */
  async listBackups(_req: Request, res: Response, next: NextFunction) {
    try {
      const backups = await backupService.listBackups();
      return res.json({
        success: true,
        total: backups.length,
        data: backups,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/restore
   * Restaura todas as folhas de todos os backups salvos para a exibição de encerramento
   */
  async restoreAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await folhaService.restoreAllFromBackups();
      const folhasAtuais = await folhaService.getForTelao(200);

      return res.json({
        success: true,
        message:
          'Todas as folhas arquivadas foram restauradas com sucesso na árvore.',
        totalRestauradas: result.totalRestauradas,
        totalAtivas: folhasAtuais.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
