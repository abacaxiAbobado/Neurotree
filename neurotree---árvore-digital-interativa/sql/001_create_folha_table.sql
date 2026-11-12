-- ============================================================================
-- NEUROTREE - Migration 001: Create folha table
-- ============================================================================
-- Description: Creates the main table for storing visitor contributions
--              to the digital tree at EEEP Feira de Cursos.
-- Author: Database Engineer
-- Date: 2024
-- ============================================================================

-- Enable UUID generation extension (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: folha
-- ============================================================================
-- Stores each visitor's contribution (leaf on the digital tree)
-- ============================================================================
CREATE TABLE folha (
    -- Primary identifier - UUID v4, non-sequential, safe for public URLs
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Visitor name/nickname (2-50 characters)
    nome VARCHAR(50) NOT NULL,

    -- Leaf color in HEX format (#RRGGBB)
    cor CHAR(7) NOT NULL,

    -- Dream profession (free text, max 100 chars)
    profissao VARCHAR(100) NOT NULL,

    -- Digital signature as Base64 PNG (data:image/png;base64,...)
    assinatura TEXT NOT NULL,

    -- Optional message for the future (max 500 chars)
    mensagem VARCHAR(500) NOT NULL DEFAULT '',

    -- Edit token for 15-minute modification window (UUID v4)
    edit_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    -- Token expiration timestamp (created_at + 15 minutes)
    edit_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),

    -- Creation timestamp (UTC, stored with timezone)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Last update timestamp (auto-maintained by trigger)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- CONSTRAINTS: Data integrity checks
-- ============================================================================

-- Name: 2-50 characters
ALTER TABLE folha ADD CONSTRAINT chk_folha_nome_length
    CHECK (char_length(nome) >= 2 AND char_length(nome) <= 50);

-- Color: valid HEX format (#RRGGBB)
ALTER TABLE folha ADD CONSTRAINT chk_folha_cor_format
    CHECK (cor ~ '^#[0-9A-Fa-f]{6}$');

-- Profession: max 100 characters
ALTER TABLE folha ADD CONSTRAINT chk_folha_profissao_length
    CHECK (char_length(profissao) <= 100);

-- Message: max 500 characters
ALTER TABLE folha ADD CONSTRAINT chk_folha_mensagem_length
    CHECK (char_length(mensagem) <= 500);

-- Edit token must expire after creation
ALTER TABLE folha ADD CONSTRAINT chk_folha_edit_expires_after_created
    CHECK (edit_expires_at > created_at);

-- ============================================================================
-- INDEXES: Query performance optimization
-- ============================================================================

-- Telão real-time: ORDER BY created_at DESC LIMIT N
CREATE INDEX idx_folha_created_at_desc ON folha (created_at DESC);

-- Edit endpoint: WHERE edit_token = $1 AND edit_expires_at > now()
CREATE INDEX idx_folha_edit_token ON folha (edit_token);

-- Optional: cleanup expired edit tokens (background job)
CREATE INDEX idx_folha_edit_expires_at ON folha (edit_expires_at);

-- ============================================================================
-- TRIGGER: Auto-update updated_at on row modification
-- ============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to folha table
CREATE TRIGGER trigger_folha_updated_at
    BEFORE UPDATE ON folha
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS: Documentation for developers and DBAs
-- ============================================================================

COMMENT ON TABLE folha IS
    'Armazena cada contribuição (folha) da árvore digital da Feira de Cursos EEEP.';

COMMENT ON COLUMN folha.id IS
    'Identificador único (UUID v4). Usado em URLs públicas e APIs.';

COMMENT ON COLUMN folha.nome IS
    'Nome ou apelido do visitante (2-50 caracteres).';

COMMENT ON COLUMN folha.cor IS
    'Cor da folha em formato HEX (#RRGGBB). Ex: #3B82F6.';

COMMENT ON COLUMN folha.profissao IS
    'Profissão dos sonhos do visitante (texto livre, máx 100 chars).';

COMMENT ON COLUMN folha.assinatura IS
    'Assinatura digital codificada em Base64 PNG (data:image/png;base64,...).';

COMMENT ON COLUMN folha.mensagem IS
    'Mensagem opcional para o futuro (máx 500 chars).';

COMMENT ON COLUMN folha.edit_token IS
    'Token UUID para edição da folha (válido por 15 min após criação).';

COMMENT ON COLUMN folha.edit_expires_at IS
    'Timestamp de expiração do token de edição (created_at + 15 min).';

COMMENT ON COLUMN folha.created_at IS
    'Data/hora de criação (UTC com timezone).';

COMMENT ON COLUMN folha.updated_at IS
    'Data/hora da última atualização (auto-mantido por trigger).';

COMMENT ON INDEX idx_folha_created_at_desc IS
    'Otimiza busca para telão: ORDER BY created_at DESC LIMIT 100.';

COMMENT ON INDEX idx_folha_edit_token IS
    'Otimiza busca por token de edição (endpoint PATCH /folha/:token).';

COMMENT ON INDEX idx_folha_edit_expires_at IS
    'Otimiza limpeza de tokens expirados (job opcional).';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to verify)
-- ============================================================================

-- Verify table structure
-- \d+ folha

-- Verify constraints
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'folha'::regclass;

-- Verify indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'folha';

-- Verify trigger
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'folha'::regclass;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS folha CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto";