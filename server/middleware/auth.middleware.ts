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
 * Middleware para proteger rotas administrativas
 * Valida JWT em cookie HttpOnly 'admin_token'
 */
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.admin_token;

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
 * Gera JWT para sessão admin e define cookie HttpOnly
 */
export function createAdminSession(res: Response): string {
  const token = jwt.sign(
    { role: 'admin' },
    config.jwtSecret,
    { expiresIn: '4h' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: config.adminSessionMaxAge,
    path: '/',
  });

  return token;
}

/**
 * Remove cookie de sessão admin (logout)
 */
export function clearAdminSession(res: Response): void {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
