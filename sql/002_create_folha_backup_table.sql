-- ============================================================================
-- NEUROTREE - Migration 002: Create folha_backup table
-- ============================================================================
-- Guarda os backups de sessão (botão "Resetar Árvore") no PostgreSQL, para que
-- sobrevivam a reinícios e novos deploys do servidor.
--
-- Não é obrigatório rodar manualmente: o servidor cria a tabela sozinho na
-- primeira vez que um backup é salvo ou listado. O script fica aqui como
-- documentação e para quem preferir criar a tabela com antecedência.
-- ============================================================================
CREATE TABLE IF NOT EXISTS folha_backup (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    label TEXT NOT NULL,
    total_folhas INTEGER NOT NULL DEFAULT 0,
    folhas JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folha_backup_created_at ON folha_backup (created_at DESC);
