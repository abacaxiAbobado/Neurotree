-- ============================================================================
-- NEUROTREE - Test Migration Script
-- ============================================================================
-- Run this AFTER 001_create_folha_table.sql to verify everything works
-- Usage: psql -h localhost -U neurotree_user -d neurotree -f sql/test_migration.sql
-- ============================================================================

-- ============================================================================
-- TEST 1: Verify table structure
-- ============================================================================
\echo '=== TEST 1: Table Structure ==='
\d+ folha

-- ============================================================================
-- TEST 2: Verify constraints
-- ============================================================================
\echo '=== TEST 2: Constraints ==='
SELECT conname as constraint_name,
       contype as type,
       pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'folha'::regclass
ORDER BY contype, conname;

-- ============================================================================
-- TEST 3: Verify indexes
-- ============================================================================
\echo '=== TEST 3: Indexes ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'folha'
ORDER BY indexname;

-- ============================================================================
-- TEST 4: Verify trigger
-- ============================================================================
\echo '=== TEST 4: Trigger ==='
SELECT tgname as trigger_name,
       pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'folha'::regclass;

-- ============================================================================
-- TEST 5: Insert valid folha (should succeed)
-- ============================================================================
\echo '=== TEST 5: Valid Insert ==='
INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
VALUES (
  'João Silva',
  '#3B82F6',
  'Desenvolvedor',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
  'O futuro pertence a quem acredita na beleza dos seus sonhos.'
)
RETURNING id, nome, cor, profissao, edit_token, edit_expires_at, created_at;

-- ============================================================================
-- TEST 6: Insert second folha (different color)
-- ============================================================================
\echo '=== TEST 6: Second Insert ==='
INSERT INTO folha (nome, cor, profissao, assinatura)
VALUES (
  'Maria Santos',
  '#EF4444',
  'Médica',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg=='
)
RETURNING id, nome, cor, profissao, edit_token, edit_expires_at, created_at;

-- ============================================================================
-- TEST 7: Verify created_at ordering (telão query)
-- ============================================================================
\echo '=== TEST 7: Telão Query (ORDER BY created_at DESC) ==='
SELECT id, nome, cor, profissao, mensagem, created_at
FROM folha
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- TEST 8: Test edit_token lookup (valid token)
-- ============================================================================
\echo '=== TEST 8: Edit Token Lookup ==='
-- Pegar token da primeira folha inserida
\set token_joao (SELECT edit_token FROM folha WHERE nome = 'João Silva')

SELECT id, nome, edit_token, edit_expires_at, edit_expires_at > now() as token_valid
FROM folha
WHERE edit_token = :'token_joao';

-- ============================================================================
-- TEST 9: Test UPDATE with valid edit_token (should succeed)
-- ============================================================================
\echo '=== TEST 9: Valid Update via Token ==='
UPDATE folha
SET nome = 'João Silva Editado', mensagem = 'Mensagem atualizada!'
WHERE edit_token = :'token_joao'
RETURNING id, nome, mensagem, updated_at, edit_expires_at > now() as token_still_valid;

-- ============================================================================
-- TEST 10: Test constraint - nome too short (should FAIL)
-- ============================================================================
\echo '=== TEST 10: Constraint - Nome too short (EXPECTED TO FAIL) ==='
INSERT INTO folha (nome, cor, profissao, assinatura)
VALUES ('A', '#3B82F6', 'Teste', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==');

-- ============================================================================
-- TEST 11: Test constraint - invalid color format (should FAIL)
-- ============================================================================
\echo '=== TEST 11: Constraint - Invalid Color (EXPECTED TO FAIL) ==='
INSERT INTO folha (nome, cor, profissao, assinatura)
VALUES ('Teste', 'azul', 'Teste', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==');

-- ============================================================================
-- TEST 12: Test constraint - message too long (should FAIL)
-- ============================================================================
\echo '=== TEST 12: Constraint - Message > 500 chars (EXPECTED TO FAIL) ==='
INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
VALUES (
  'Teste Longo',
  '#3B82F6',
  'Teste',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg==',
  repeat('A', 501)
);

-- ============================================================================
-- TEST 13: Test constraint - profession too long (should FAIL)
-- ============================================================================
\echo '=== TEST 13: Constraint - Profession > 100 chars (EXPECTED TO FAIL) ==='
INSERT INTO folha (nome, cor, profissao, assinatura)
VALUES (
  'Teste',
  '#3B82F6',
  repeat('X', 101),
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg=='
);

-- ============================================================================
-- TEST 14: Test UPDATE with expired/invalid token (should not update)
-- ============================================================================
\echo '=== TEST 14: Update with Invalid Token (should affect 0 rows) ==='
UPDATE folha
SET nome = 'Hacker'
WHERE edit_token = '00000000-0000-0000-0000-000000000000'
RETURNING id;

-- ============================================================================
-- TEST 15: Test DELETE (admin simulation)
-- ============================================================================
\echo '=== TEST 15: Delete by ID ==='
DELETE FROM folha
WHERE nome = 'Maria Santos'
RETURNING id;

-- ============================================================================
-- TEST 16: Final count
-- ============================================================================
\echo '=== TEST 16: Final Count ==='
SELECT COUNT(*) as total_folhas FROM folha;

-- ============================================================================
-- TEST 17: Verify updated_at trigger works
-- ============================================================================
\echo '=== TEST 17: Verify updated_at Trigger ==='
SELECT id, nome, created_at, updated_at, updated_at > created_at as was_updated
FROM folha
WHERE nome = 'João Silva Editado';

-- ============================================================================
-- CLEANUP (optional - uncomment to clean test data)
-- ============================================================================
-- \echo '=== CLEANUP ==='
-- TRUNCATE TABLE folha RESTART IDENTITY CASCADE;

\echo '=== ALL TESTS COMPLETED ==='