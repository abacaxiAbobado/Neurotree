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

  /**
   * POST /api/admin/simulate
   * Simula a criação em massa de 100 folhas de visitantes para teste de carga e telão
   */
  async simulateLeaves(req: Request, res: Response, next: NextFunction) {
    try {
      const count = Math.min(Math.max(parseInt(req.body.count as string, 10) || 100, 1), 200);

      const NOMES = [
        'Lucas Ferreira', 'Beatriz Lima', 'Enzo Gabriel', 'Camila Rocha', 'Rafael Albuquerque',
        'Larissa Souza', 'Matheus Pinheiro', 'Yasmin Santos', 'Guilherme Morais', 'Letícia Castro',
        'Pedro Henrique', 'Mariana Duarte', 'Gabriel Cavalcante', 'Júlia Azevedo', 'Thiago Nogueira',
        'Sofia Ribeiro', 'Felipe Barbosa', 'Bruna Carvalho', 'Vinícius Monteiro', 'Carolina Braga',
        'Rodrigo Mendes', 'Alice Fagundes', 'Arthur Peixoto', 'Isabela Freitas', 'Diego Silveira',
        'Manuela Ramos', 'Eduardo Vasconcelos', 'Luana Pires', 'Leonardo Gusmão', 'Helena Farias',
      ];

      const PROFISSOES = [
        'Engenheira de Software', 'Cientista de Dados', 'Médico Neurocirurgião', 'Astrônomo',
        'Designer de Jogos', 'Arquiteta Sustentável', 'Especialista em Robótica', 'Bióloga Marinha',
        'Piloto de Aeronave', 'Engenheiro de IA', 'Psicóloga Comportamental', 'Perita Forense',
        'Engenheiro Mecatrônico', 'Cineasta & Roteirista', 'Professor Universitário', 'Veterinária',
        'Empreendedor Tech', 'Desenvolvedora Full-Stack', 'Economista', 'Físico Quântico',
      ];

      const CORES = [
        '#F5C451', '#F59E0B', '#FDE68A', '#38BDF8',
        '#6366F1', '#A855F7', '#FB7185', '#2DD4BF',
        '#EAB308', '#818CF8', '#F472B6', '#60A5FA',
      ];

      const MENSAGENS = [
        'O futuro pertence a quem acredita na beleza dos seus sonhos!',
        'A tecnologia e a educação transformarão o nosso país.',
        'Daqui a 10 anos quero liderar projetos de inteligência artificial sustentável.',
        'Orgulho de fazer parte da Feira de Cursos da EEEP!',
        'Nunca deixe ninguém dizer que o seu sonho é grande demais.',
        'Inovação com propósito e empatia pelas pessoas.',
        'Construindo pontes entre o conhecimento e a prática.',
        'Que a nossa turma seja lembrada pela coragem de criar coisas novas.',
      ];

      const baseSignature =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==';

      const createdLeaves = [];
      for (let i = 0; i < count; i++) {
        const nome = `${NOMES[i % NOMES.length]} #${i + 1}`;
        const profissao = PROFISSOES[Math.floor(Math.random() * PROFISSOES.length)];
        const cor = CORES[Math.floor(Math.random() * CORES.length)];
        const mensagem = MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)];

        const folha = await folhaService.create({
          nome,
          profissao,
          cor,
          mensagem,
          assinatura: baseSignature,
        });
        createdLeaves.push(folha);
      }

      // Emite evento para o telão recarregar o estado completo
      const allLeaves = await folhaService.getForTelao(200);

      return res.json({
        success: true,
        message: `${createdLeaves.length} folhas simuladas criadas com sucesso na árvore!`,
        totalCriadas: createdLeaves.length,
        totalAtivas: allLeaves.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
