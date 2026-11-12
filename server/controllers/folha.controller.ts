import { NextFunction, Request, Response } from 'express';
import {
  emitFolhaCreated,
  emitFolhaUpdated,
} from '../socket/socket.handler.ts';
import { folhaService } from '../services/folha.service.ts';

export class FolhaController {
  /**
   * POST /api/folha
   * Cadastra nova folha e notifica o telão em tempo real
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const folha = await folhaService.create(req.body);

      // Emite evento instantâneo para o telão
      emitFolhaCreated(folha);

      return res.status(201).json({
        success: true,
        message: 'Folha adicionada à árvore com sucesso!',
        data: folha,
        editToken: folha.edit_token,
        editExpiresAt: folha.edit_expires_at,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/folha
   * Lista as folhas mais recentes para o telão (padrão: 100, máx: 200)
   */
  async listForTelao(req: Request, res: Response, next: NextFunction) {
    try {
      const limitParam = parseInt(req.query.limit as string, 10);
      const limit = Number.isNaN(limitParam) ? 100 : limitParam;

      const folhas = await folhaService.getForTelao(limit);

      return res.json({
        success: true,
        total: folhas.length,
        data: folhas,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/folha/:id
   * Busca os detalhes de uma folha por ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const folha = await folhaService.getById(id);

      if (!folha) {
        return res.status(404).json({
          success: false,
          error: 'NotFound',
          message: 'Folha não encontrada.',
        });
      }

      return res.json({
        success: true,
        data: folha,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/folha/edit/:token
   * Permite que o participante edite sua folha nos primeiros 15 minutos
   */
  async updateByEditToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const folha = await folhaService.updateByEditToken(token, req.body);

      if (!folha) {
        return res.status(404).json({
          success: false,
          error: 'EditExpiredOrNotFound',
          message:
            'Folha não encontrada ou prazo de edição de 15 minutos expirado.',
        });
      }

      // Emite atualização para o telão
      emitFolhaUpdated(folha);

      return res.json({
        success: true,
        message: 'Folha atualizada com sucesso!',
        data: folha,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/folha/stats
   * Estatísticas de contagem e modo de armazenamento
   */
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await folhaService.getStats();
      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const folhaController = new FolhaController();
