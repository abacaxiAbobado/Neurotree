/**
 * Prepared statements SQL para o banco PostgreSQL conforme definido em
 * sql/001_create_folha_table.sql
 */

export const queries = {
  // CREATE - Inserir nova folha
  insertFolha: {
    name: 'insert_folha',
    text: `
      INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nome, cor, profissao, assinatura, mensagem,
                edit_token, edit_expires_at, created_at, updated_at
    `,
  },

  // READ - Listar para telão (ordenado por mais recente com limit)
  selectFolhasForTelao: {
    name: 'select_folhas_telao',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem, created_at, updated_at
      FROM folha
      ORDER BY created_at DESC
      LIMIT $1
    `,
  },

  // READ - Buscar folha por ID
  selectFolhaById: {
    name: 'select_folha_by_id',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem,
             edit_token, edit_expires_at, created_at, updated_at
      FROM folha
      WHERE id = $1
    `,
  },

  // READ - Buscar por token de edição válido (não expirado)
  selectFolhaByEditToken: {
    name: 'select_folha_by_edit_token',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem,
             edit_token, edit_expires_at, created_at, updated_at
      FROM folha
      WHERE edit_token = $1 AND edit_expires_at > now()
    `,
  },

  // UPDATE - Atualizar folha via token de edição válido (dentro de 15 minutos)
  updateFolha: {
    name: 'update_folha',
    text: `
      UPDATE folha
      SET nome = COALESCE($2, nome),
          cor = COALESCE($3, cor),
          profissao = COALESCE($4, profissao),
          assinatura = COALESCE($5, assinatura),
          mensagem = COALESCE($6, mensagem)
      WHERE edit_token = $1 AND edit_expires_at > now()
      RETURNING id, nome, cor, profissao, assinatura, mensagem,
                edit_token, edit_expires_at, created_at, updated_at
    `,
  },

  // DELETE - Remover folha por ID (moderação administrativa)
  deleteFolha: {
    name: 'delete_folha',
    text: 'DELETE FROM folha WHERE id = $1 RETURNING id',
  },

  // COUNT - Contar total de folhas
  countFolhas: {
    name: 'count_folhas',
    text: 'SELECT COUNT(*)::int as total FROM folha',
  },

  // SELECT ALL - Para exportação de backup
  selectAllFolhas: {
    name: 'select_all_folhas',
    text: `
      SELECT id, nome, cor, profissao, assinatura, mensagem,
             edit_token, edit_expires_at, created_at, updated_at
      FROM folha
      ORDER BY created_at ASC
    `,
  },

  // TRUNCATE - Para reset de turma após backup
  truncateFolha: {
    name: 'truncate_folha',
    text: 'TRUNCATE TABLE folha RESTART IDENTITY CASCADE',
  },
};
