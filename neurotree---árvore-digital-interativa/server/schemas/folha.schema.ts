import { z } from 'zod';

// Regex para cor HEX (#RRGGBB)
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

// Regex para assinatura em Base64 PNG (data URI)
const base64PngRegex = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export const createFolhaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(50, 'O nome deve ter no máximo 50 caracteres'),

  cor: z
    .string()
    .regex(hexColorRegex, 'A cor deve estar no formato HEX (#RRGGBB)'),

  profissao: z
    .string()
    .trim()
    .min(1, 'A profissão é obrigatória')
    .max(100, 'A profissão deve ter no máximo 100 caracteres'),

  assinatura: z
    .string()
    .max(1024 * 1024, 'A assinatura não pode exceder 1 MB')
    .refine(
      (val) => base64PngRegex.test(val.replace(/\s+/g, '')),
      'A assinatura deve ser uma imagem Base64 PNG válida (data:image/png;base64,...)'
    ),

  mensagem: z
    .string()
    .trim()
    .max(500, 'A mensagem não pode ter mais de 500 caracteres')
    .optional()
    .default(''),
});

export const updateFolhaSchema = z.object({
  nome: z.string().trim().min(2).max(50).optional(),
  cor: z.string().regex(hexColorRegex).optional(),
  profissao: z.string().trim().min(1).max(100).optional(),
  assinatura: z
    .string()
    .max(1024 * 1024)
    .refine((val) => base64PngRegex.test(val.replace(/\s+/g, '')))
    .optional(),
  mensagem: z.string().trim().max(500).optional(),
});

export const editTokenParamSchema = z.object({
  token: z.string().uuid('Token de edição inválido (formato UUID esperado)'),
});

export const folhaIdParamSchema = z.object({
  id: z.string().uuid('ID inválido (formato UUID esperado)'),
});

export type CreateFolhaInput = z.infer<typeof createFolhaSchema>;
export type UpdateFolhaInput = z.infer<typeof updateFolhaSchema>;
