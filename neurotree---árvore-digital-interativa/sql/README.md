# NEUROTREE - Database Setup

## 📋 Visão Geral

Este diretório contém os scripts de migração do banco de dados PostgreSQL para o projeto NEUROTREE.

## 🗂 Estrutura

```
sql/
├── 001_create_folha_table.sql    # Migration principal (tabela folha)
└── README.md                      # Este arquivo
```

## 🚀 Como Executar

### Pré-requisitos

- PostgreSQL 14+ instalado e rodando
- Acesso `psql` ou cliente GUI (DBeaver, pgAdmin, TablePlus)
- Variáveis de ambiente configuradas (ver abaixo)

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (ou configure no sistema):

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neurotree
DB_USER=neurotree_user
DB_PASSWORD=sua_senha_segura
DB_SSL=false  # true se usar SSL (ex: managed PG na nuvem)

# Admin token para deleção (painel admin mínimo)
ADMIN_TOKEN=neurotree2024_admin_secret
```

### Opção 1: Via psql (Recomendado)

```bash
# 1. Criar banco e usuário (execute como postgres superuser)
sudo -u postgres psql -c "CREATE DATABASE neurotree;"
sudo -u postgres psql -c "CREATE USER neurotree_user WITH ENCRYPTED PASSWORD 'sua_senha_segura';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE neurotree TO neurotree_user;"

# 2. Rodar migration
psql -h localhost -U neurotree_user -d neurotree -f sql/001_create_folha_table.sql
```

### Opção 2: Via Docker (Desenvolvimento)

```bash
# Subir PostgreSQL
docker run --name neurotree-db \
  -e POSTGRES_DB=neurotree \
  -e POSTGRES_USER=neurotree_user \
  -e POSTGRES_PASSWORD=sua_senha_segura \
  -p 5432:5432 \
  -d postgres:16

# Aguardar subir (~5s) e rodar migration
sleep 5
psql -h localhost -U neurotree_user -d neurotree -f sql/001_create_folha_table.sql
```

### Opção 3: Via Node.js (Back-end)

```javascript
// src/db/migrate.js
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const sql = readFileSync(join(process.cwd(), 'sql', '001_create_folha_table.sql'), 'utf-8');
  await pool.query(sql);
  console.log('✅ Migration 001 executada com sucesso');
  await pool.end();
}

runMigration().catch(console.error);
```

## ✅ Verificação Pós-Migration

```sql
-- Conectar e verificar
psql -h localhost -U neurotree_user -d neurotree

-- 1. Estrutura da tabela
\d+ folha

-- 2. Constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'folha'::regclass;

-- 3. Índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'folha';

-- 4. Trigger
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'folha'::regclass;

-- 5. Testar insert
INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
VALUES ('Teste', '#3B82F6', 'Desenvolvedor', 'data:image/png;base64,iVBORw0KGgo...', 'Olá futuro!');
```

## 🔄 Rollback (Se Necessário)

```sql
-- CUIDADO: Apaga TODOS os dados
DROP TABLE IF EXISTS folha CASCADE;
DROP EXTENSION IF EXISTS "pgcrypto";
```

## 📦 Integração com Back-end (Node.js/Express)

Veja `INTEGRATION_GUIDE.md` (criado separadamente) para:
- Pool de conexões pg
- Queries parametrizadas (prepared statements)
- Validação com Zod
- Rotas CRUD completas
- Integração Socket.IO para tempo real
- Tratamento de erros
- Testes sugeridos

## 📝 Notas Importantes

1. **UUID v4**: Usamos `gen_random_uuid()` (extensão `pgcrypto`) — não sequencial, seguro para URLs públicas.

2. **Timezone**: Todas as timestamps são `TIMESTAMPTZ` (UTC armazenado, convertido no cliente).

3. **Assinatura**: Armazenada como `TEXT` Base64 PNG (~30 KB/folha). Renderiza direto em `<img src={assinatura} />`.

4. **Edição**: Token `edit_token` válido por 15 min. Front guarda no `localStorage`.

5. **Admin**: Deleção via header `Authorization: Bearer <ADMIN_TOKEN>` — sem tabela de usuários.

6. **Performance**: Índice em `created_at DESC` otimiza o telão em tempo real (< 1ms para 1000 rows).

## 🆘 Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `extension "pgcrypto" does not exist` | Extensão não instalada | `CREATE EXTENSION pgcrypto;` (precisa superuser) |
| `permission denied for database` | Usuário sem grants | `GRANT ALL ON DATABASE neurotree TO neurotree_user;` |
| `violates check constraint chk_folha_cor_format` | Cor inválida | Validar HEX no front: `/^#[0-9A-Fa-f]{6}$/` |
| `violates check constraint chk_folha_edit_expires_after_created` | Trigger bug | Verificar se `updated_at` não mexe em `edit_expires_at` |