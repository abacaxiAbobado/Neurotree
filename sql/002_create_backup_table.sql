-- ============================================================================
-- NEUROTREE - Migration 002: Create backup_sessao table
-- ============================================================================
-- Description: Creates table for storing session backups (tree resets)
--              instead of only filesystem JSON files.
-- Author: Database Engineer
-- Date: 2024
-- ============================================================================

-- Enable UUID generation extension (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: backup_sessao
-- ============================================================================
-- Stores each session backup when "Resetar Árvore" is triggered
-- Contains full snapshot of all folhas at that moment as JSONB
-- ============================================================================
CREATE TABLE backup_sessao (
    -- Primary identifier - UUID v4
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Human-readable label for the session (e.g., "Turma 3º Ano Informática")
    label VARCHAR(100) NOT NULL,

    -- Full snapshot of all folhas as JSONB (queryable, indexable)
    folhas_snapshot JSONB NOT NULL,

    -- Total number of folhas in this backup
    total_folhas INTEGER NOT NULL DEFAULT 0,

    -- Creation timestamp (UTC, stored with timezone)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Source repository type at backup time ('postgresql' | 'memory')
    repo_type VARCHAR(20) NOT NULL DEFAULT 'memory'
);

-- ============================================================================
-- CONSTRAINTS: Data integrity checks
-- ============================================================================

-- Label: 1-100 characters
ALTER TABLE backup_sessao ADD CONSTRAINT chk_backup_label_length
    CHECK (char_length(label) >= 1 AND char_length(label) <= 100);

-- Total folhas must be non-negative
ALTER TABLE backup_sessao ADD CONSTRAINT chk_backup_total_folhas_nonneg
    CHECK (total_folhas >= 0);

-- Repo type must be valid
ALTER TABLE backup_sessao ADD CONSTRAINT chk_backup_repo_type_valid
    CHECK (repo_type IN ('postgresql', 'memory'));

-- ============================================================================
-- INDEXES: Query performance optimization
-- ============================================================================

-- List backups ordered by most recent first
CREATE INDEX idx_backup_sessao_created_at_desc ON backup_sessao (created_at DESC);

-- Filter by repo type if needed
CREATE INDEX idx_backup_sessao_repo_type ON backup_sessao (repo_type);

-- GIN index for JSONB queries on folhas_snapshot (e.g., search by nome inside backup)
CREATE INDEX idx_backup_sessao_folhas_gin ON backup_sessao USING GIN (folhas_snapshot);

-- ============================================================================
-- COMMENTS: Documentation for developers and DBAs
-- ============================================================================

COMMENT ON TABLE backup_sessao IS
    'Armazena snapshots completos da árvore ao clicar em "Resetar Árvore" no painel admin. Cada linha = uma sessão/turma arquivada.';

COMMENT ON COLUMN backup_sessao.id IS
    'Identificador único do backup (UUID v4).';

COMMENT ON COLUMN backup_sessao.label IS
    'Nome amigável da turma/sessão (ex: "Turma 3º Ano Informática").';

COMMENT ON COLUMN backup_sessao.folhas_snapshot IS
    'Array JSONB com todas as folhas da sessão no momento do reset. Estrutura: [{"id": "...", "nome": "...", "cor": "...", "profissao": "...", "assinatura": "...", "mensagem": "...", "created_at": "...", "updated_at": "..."}, ...]';

COMMENT ON COLUMN backup_sessao.total_folhas IS
    'Quantidade de folhas contidas neste backup (redundância para consultas rápidas).';

COMMENT ON COLUMN backup_sessao.created_at IS
    'Data/hora em que o backup foi gerado (UTC com timezone).';

COMMENT ON COLUMN backup_sessao.repo_type IS
    'Tipo de repositório ativo no momento do backup: "postgresql" ou "memory".';

COMMENT ON INDEX idx_backup_sessao_created_at_desc IS
    'Otimiza listagem de backups: ORDER BY created_at DESC.';

COMMENT ON INDEX idx_backup_sessao_folhas_gin IS
    'Permite buscar dentro dos backups (ex: folhas_snapshot @> \'[{"nome": "Ana"}]\').';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to verify)
-- ============================================================================

-- Verify table structure
-- \d+ backup_sessao

-- Verify constraints
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'backup_sessao'::regclass;

-- Verify indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'backup_sessao';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS backup_sessao CASCADE;