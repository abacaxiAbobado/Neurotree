import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.ts';

interface AdminJwtPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

/**
 * Extrai token do header Authorization: Bearer <token>
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Middleware para proteger rotas administrativas
 * Valida JWT no header Authorization: Bearer <token>
 */
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Sessão administrativa não encontrada. Faça login novamente.',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AdminJwtPayload;

    if (payload.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Token inválido: role incorreta.',
      });
    }

    req.admin = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'SessionExpired',
        message: 'Sessão expirada. Faça login novamente.',
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Token de sessão inválido.',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'AuthError',
      message: 'Erro ao validar sessão administrativa.',
    });
  }
}

/**
 * Gera JWT para sessão admin (retorna token, não define cookie)
 */
export function createAdminSession(): string {
  const token = jwt.sign(
    { role: 'admin' },
    config.jwtSecret,
    { expiresIn: '4h' }
  );

  return token;
}

/**
 * Remove token de sessão admin (logout) - no token-based, frontend limpa localStorage
 */
export function clearAdminSession(): void {
  // No token-based auth, logout é client-side (remover do localStorage)
  // Mantido para compatibilidade se houver código que chame
}