import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('❌ Erro capturado no pipeline HTTP:', err);

  // Erros de validação Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Dados inválidos.',
      details: (err.issues || (err as any).errors || []).map((e: any) => ({
        field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
        message: e.message,
      })),
    });
  }

  // Erros específicos do PostgreSQL
  if (err?.code) {
    switch (err.code) {
      case '23505': // Unique violation
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Um registro com estes identificadores já existe.',
        });
      case '23514': // Check constraint violation
        return res.status(400).json({
          success: false,
          error: 'ConstraintViolation',
          message: `Regra de integridade do banco violada: ${err.constraint || 'restrição de campo'}`,
        });
      case '22P02': // Invalid text representation (ex: UUID inválido)
        return res.status(400).json({
          success: false,
          error: 'InvalidFormat',
          message: 'Formato de identificador inválido para o banco de dados.',
        });
      case '08006':
      case 'ECONNREFUSED':
        return res.status(503).json({
          success: false,
          error: 'DatabaseUnavailable',
          message: 'O serviço de banco de dados está temporariamente indisponível.',
        });
    }
  }

  // Erro interno genérico
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalServerError',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Ocorreu um erro interno no servidor.'
        : err.message || 'Erro interno não especificado.',
  });
}
