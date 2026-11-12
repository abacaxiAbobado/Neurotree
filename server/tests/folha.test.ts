import assert from 'node:assert';
import test, { describe } from 'node:test';
import { MemoryFolhaRepository } from '../repositories/memory-folha.repository.ts';
import {
  createFolhaSchema,
  editTokenParamSchema,
  folhaIdParamSchema,
  updateFolhaSchema,
} from '../schemas/folha.schema.ts';
import { backupService } from '../services/backup.service.ts';
import { FolhaService } from '../services/folha.service.ts';

const validFolhaInput = {
  nome: 'Lucas Oliveira',
  cor: '#10B981',
  profissao: 'Engenheiro de Software',
  assinatura:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
  mensagem: 'Que a tecnologia construa um futuro sustentável.',
};

describe('1. Validações de Schemas (Zod)', () => {
  test('Deve aceitar folha com dados válidos', () => {
    const parsed = createFolhaSchema.parse(validFolhaInput);
    assert.strictEqual(parsed.nome, 'Lucas Oliveira');
    assert.strictEqual(parsed.cor, '#10B981');
    assert.strictEqual(parsed.profissao, 'Engenheiro de Software');
  });

  test('Deve rejeitar nome com menos de 2 caracteres', () => {
    assert.throws(
      () => {
        createFolhaSchema.parse({ ...validFolhaInput, nome: 'A' });
      },
      (err: any) => {
        const issues = err.issues || err.errors || [];
        return issues.some((i: any) => i.message.includes('pelo menos 2 caracteres') || i.code === 'too_small');
      }
    );
  });

  test('Deve rejeitar cor com formato HEX inválido', () => {
    assert.throws(
      () => {
        createFolhaSchema.parse({ ...validFolhaInput, cor: 'verde' });
      },
      (err: any) => {
        const issues = err.issues || err.errors || [];
        return issues.some((i: any) => i.message.includes('formato HEX') || i.code === 'invalid_format');
      }
    );
  });

  test('Deve rejeitar assinatura que não seja data URI Base64 PNG', () => {
    assert.throws(
      () => {
        createFolhaSchema.parse({
          ...validFolhaInput,
          assinatura: 'https://exemplo.com/foto.jpg',
        });
      },
      (err: any) => {
        const issues = err.issues || err.errors || [];
        return issues.some((i: any) => i.message.includes('Base64 PNG') || i.code === 'custom');
      }
    );
  });

  test('Deve validar UUID correto nos parâmetros', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const parsedId = folhaIdParamSchema.parse({ id: validUuid });
    assert.strictEqual(parsedId.id, validUuid);

    const parsedToken = editTokenParamSchema.parse({ token: validUuid });
    assert.strictEqual(parsedToken.token, validUuid);
  });

  test('Deve rejeitar UUID inválido', () => {
    assert.throws(() => {
      folhaIdParamSchema.parse({ id: '123-invalido' });
    });
  });
});

describe('2. Repositório e Regras de Negócio', () => {
  const repo = new MemoryFolhaRepository();

  test('Deve criar nova folha com UUID e token de edição válido por 15 minutos', async () => {
    const folha = await repo.create(validFolhaInput);
    assert.ok(folha.id, 'ID deve ser gerado');
    assert.ok(folha.edit_token, 'Token de edição deve ser gerado');
    assert.strictEqual(folha.nome, validFolhaInput.nome);

    const expiresAt = new Date(folha.edit_expires_at).getTime();
    const createdAt = new Date(folha.created_at).getTime();
    const diffMinutes = Math.round((expiresAt - createdAt) / (60 * 1000));
    assert.strictEqual(diffMinutes, 15, 'Expiração deve ser de 15 minutos');
  });

  test('Deve buscar folha por token de edição válido', async () => {
    const folha = await repo.create({
      ...validFolhaInput,
      nome: 'Participante Teste',
    });
    const found = await repo.findByEditToken(folha.edit_token);
    assert.ok(found, 'Folha deve ser encontrada pelo token');
    assert.strictEqual(found?.id, folha.id);
  });

  test('Deve atualizar folha com token de edição válido', async () => {
    const folha = await repo.create({
      ...validFolhaInput,
      nome: 'Nome Antigo',
    });
    const updated = await repo.updateByEditToken(folha.edit_token, {
      nome: 'Nome Novo Atualizado',
      profissao: 'Cientista de Dados',
    });
    assert.ok(updated);
    assert.strictEqual(updated?.nome, 'Nome Novo Atualizado');
    assert.strictEqual(updated?.profissao, 'Cientista de Dados');
  });

  test('Deve excluir folha por ID', async () => {
    const folha = await repo.create(validFolhaInput);
    const deleted = await repo.deleteById(folha.id);
    assert.strictEqual(deleted, true);

    const verify = await repo.findById(folha.id);
    assert.strictEqual(verify, null, 'Folha excluída não deve mais existir');
  });
});

describe('3. Sistema de Backup de Sessões e Reset da Árvore', () => {
  const service = new FolhaService();

  test('Deve resetar a árvore gerando arquivo de backup das folhas anteriores', async () => {
    // Garante que existem folhas
    await service.create(validFolhaInput);

    const resetResult = await service.resetTree('turma_teste_3a');
    assert.ok(resetResult.backupFile.includes('sessao_turma_teste_3a'));
    assert.ok(resetResult.totalArquivadas >= 1);

    // Árvore deve estar limpa após o reset
    const folhasAtivas = await service.getForTelao(100);
    assert.strictEqual(folhasAtivas.length, 0, 'A árvore deve ter 0 folhas após o reset');
  });

  test('Deve ser capaz de restaurar folhas dos backups para a exibição de encerramento', async () => {
    const restoreResult = await service.restoreAllFromBackups();
    assert.ok(restoreResult.totalRestauradas >= 1);

    const folhasRestauradas = await service.getForTelao(100);
    assert.ok(folhasRestauradas.length >= 1, 'Folhas devem voltar a aparecer na árvore');
  });
});
