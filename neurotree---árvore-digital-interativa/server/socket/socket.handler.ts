import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Folha } from '../repositories/folha.repository.ts';
import { folhaService } from '../services/folha.service.ts';

let ioInstance: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Cliente Socket.IO conectado: ${socket.id}`);

    // Telão solicita estado inicial para renderizar a árvore
    socket.on('telao:getInitialState', async (callback) => {
      try {
        const folhas = await folhaService.getForTelao(100);
        if (typeof callback === 'function') {
          callback({ success: true, data: folhas });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({
            success: false,
            error: (error as Error).message,
          });
        }
      }
    });

    // Participante consulta sua folha para edição usando seu token
    socket.on('folha:getForEdit', async ({ token }, callback) => {
      try {
        if (!token) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Token de edição ausente.' });
          }
          return;
        }

        const folha = await folhaService.getByEditToken(token);
        if (!folha) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'Folha não encontrada ou prazo de edição expirado (15 min).',
            });
          }
          return;
        }

        if (typeof callback === 'function') {
          callback({ success: true, data: folha });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({ success: false, error: (error as Error).message });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Cliente Socket.IO desconectado: ${socket.id} (${reason})`);
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketIo(): Server {
  if (!ioInstance) {
    throw new Error('Servidor Socket.IO não foi inicializado.');
  }
  return ioInstance;
}

/**
 * Emite evento em tempo real informando que uma nova folha foi cadastrada
 */
export function emitFolhaCreated(folha: Folha) {
  if (ioInstance) {
    ioInstance.emit('folha:created', folha);
  }
}

/**
 * Emite evento informando que uma folha foi editada
 */
export function emitFolhaUpdated(folha: Folha) {
  if (ioInstance) {
    ioInstance.emit('folha:updated', folha);
  }
}

/**
 * Emite evento informando que uma folha inadequada foi removida
 */
export function emitFolhaDeleted(id: string) {
  if (ioInstance) {
    ioInstance.emit('folha:deleted', { id });
  }
}

/**
 * Emite evento informando reset da árvore para uma nova turma da feira
 */
export function emitFolhaReset(sessionId: string) {
  if (ioInstance) {
    ioInstance.emit('folha:reset', { sessionId });
  }
}
