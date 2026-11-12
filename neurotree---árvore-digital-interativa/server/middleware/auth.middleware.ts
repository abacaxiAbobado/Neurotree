import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.ts';

/**
 * Middleware para proteger rotas administrativas (exclusão de folha, reset de árvore e exportação)
 * Valida o cabeçalho Authorization: Bearer <ADMIN_TOKEN>
 */
export function requireAdminToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message:
        'Acesso administrativo restrito. Cabeçalho Authorization: Bearer <ADMIN_TOKEN> obrigatório.',
    });
  }

  const token = authHeader.slice(7).trim();

  if (token !== config.adminToken) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Token administrativo inválido ou sem privilégios suficientes.',
    });
  }

  next();
}
