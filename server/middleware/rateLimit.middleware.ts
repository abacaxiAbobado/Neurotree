import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.ts';

// Armazena contagem de requisições por IP na janela de tempo
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

// Armazena cooldown por participante (via cabeçalho x-client-session ou IP)
const submissionCooldowns = new Map<string, number>();

// Limpeza periódica para evitar acúmulo de memória
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestCounts.entries()) {
    if (now > data.resetAt) {
      ipRequestCounts.delete(ip);
    }
  }
  for (const [key, expiresAt] of submissionCooldowns.entries()) {
    if (now > expiresAt) {
      submissionCooldowns.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Rate Limiter adaptado para a rede da escola:
 * - Permite volume de até 60 req/min no IP coletivo da escola (Wi-Fi compartilhado)
 * - Aplica cooldown de 10 segundos no participante específico (para evitar duplo clique/spam acidental)
 */
export function folhaRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = Date.now();
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const clientSession =
    (req.headers['x-client-session'] as string) || clientIp;

  // 1. Checagem de cooldown do participante (evita duplo envio imediato)
  const lastSubmission = submissionCooldowns.get(clientSession);
  if (lastSubmission && now < lastSubmission) {
    const waitSeconds = Math.ceil((lastSubmission - now) / 1000);
    return res.status(429).json({
      success: false,
      error: 'CooldownActive',
      message: `Aguarde ${waitSeconds} segundo(s) antes de enviar outra folha.`,
      retryAfter: waitSeconds,
    });
  }

  // 2. Checagem de limite por IP (para proteção geral contra flood)
  let ipData = ipRequestCounts.get(clientIp);
  if (!ipData || now > ipData.resetAt) {
    ipData = {
      count: 1,
      resetAt: now + config.rateLimitWindowMs,
    };
    ipRequestCounts.set(clientIp, ipData);
  } else {
    ipData.count++;
    if (ipData.count > config.rateLimitMaxPerMinute) {
      const waitSeconds = Math.ceil((ipData.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(waitSeconds));
      return res.status(429).json({
        success: false,
        error: 'TooManyRequests',
        message:
          'Muitas requisições originadas desta rede no momento. Tente novamente em alguns segundos.',
        retryAfter: waitSeconds,
      });
    }
  }

  // Registra cooldown de 10 segundos para esse participante
  submissionCooldowns.set(clientSession, now + 10 * 1000);

  next();
}
