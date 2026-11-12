import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

export function validateBody(schema: ZodType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Os dados enviados contêm inconsistências.',
          details: (error.issues || (error as any).errors || []).map((e: any) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

export function validateParams(schema: ZodType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'InvalidParameters',
          message: 'Os parâmetros da URL são inválidos.',
          details: (error.issues || (error as any).errors || []).map((e: any) => ({
            param: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
