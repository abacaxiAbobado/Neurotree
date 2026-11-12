#!/usr/bin/env bash
# NEUROTREE - Load Test: 20 usuários concorrentes inserindo folhas
# Uso: ./load_test_parallel.sh [num_users=20] [inserts_per_user=50]
# Requisitos: psql, bc (para float math)

set -euo pipefail

NUM_USERS=${1:-20}
INSERTS_PER_USER=${2:-50}

# Configuração do banco
# IMPORTANTE: 127.0.0.1 força TCP (localhost usa socket Unix que não funciona com container)
# PGPASSWORD exportado para funcionar em background subshells
export PGHOST=127.0.0.1
export PGPORT=5432
export PGDATABASE=neurotree
export PGUSER=neurotree_user
export PGPASSWORD=neurotree123

# Verifica dependências
for cmd in psql bc; do
  if ! command -v $cmd &>/dev/null; then
    echo "❌ '$cmd' não encontrado. Instale: sudo dnf install postgresql bc"
    exit 1
  fi
done

# Dados de teste variados
# IMPORTANTE: aspas duplas nas cores para não virar comentário bash (#...)
CORES=("#3B82F6" "#EF4444" "#22C55E" "#F59E0B" "#A855F7" "#EC4899" "#06B6D4" "#84CC16")
PROFISSOES=('Desenvolvedor' 'Médico' 'Professor' 'Engenheiro' 'Designer' 'Cientista' 'Arquiteto' 'Advogado' 'Jornalista' 'Psicólogo')
ASSINATURA='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGggJ/PchI7wAAAABJRU5ErkJggg=='

# Função que cada "usuário" executa em background
insert_folha() {
  local user_id=$1
  local success=0
  local failed=0

  for i in $(seq 1 $INSERTS_PER_USER); do
    local nome="User${user_id}_${i}"
    local cor=${CORES[$((RANDOM % ${#CORES[@]}))]}
    local prof=${PROFISSOES[$((RANDOM % ${#PROFISSOES[@]}))]}
    local msg="Mensagem ${i} do usuário ${user_id} - $(date +%H:%M:%S.%3N)"

    if psql -q -c "
      INSERT INTO folha (nome, cor, profissao, assinatura, mensagem)
      VALUES ('$nome', '$cor', '$prof', '$ASSINATURA', '$msg');
    " >/dev/null 2>&1; then
      ((success++))
    else
      ((failed++))
    fi
  done

  echo "User $user_id: ✅ $success  ❌ $failed"
}

# Testa conexão antes
echo "🔍 Testando conexão com banco..."
if ! psql -q -c "SELECT 1;" >/dev/null 2>&1; then
  echo "❌ Não conectou no banco. Verifique:"
  echo "   - Container rodando? (podman ps)"
  echo "   - Credenciais corretas (PGPASSWORD)?"
  echo "   - Banco 'neurotree' existe?"
  exit 1
fi
echo "✅ Conexão OK"

echo ""
echo "🚀 Iniciando $NUM_USERS usuários concorrentes x $INSERTS_PER_USER inserts cada..."
echo "   Total esperado: $((NUM_USERS * INSERTS_PER_USER)) folhas"
echo ""

start=$(date +%s.%N)

# Dispara todos em background
for u in $(seq 1 $NUM_USERS); do
  insert_folha $u &
done

# Aguarda todos terminarem
wait

end=$(date +%s.%N)
total=$((NUM_USERS * INSERTS_PER_USER))
elapsed=$(echo "$end - $start" | bc)
rate=$(echo "scale=2; $total / $elapsed" | bc)

echo ""
echo "📊 RESULTADO"
echo "   Total inserts: $total"
echo "   Tempo: ${elapsed}s"
echo "   Taxa: ${rate} inserts/seg"
echo ""

# Verificação final no banco
echo "🔍 Verificando no banco..."
psql -c "
  SELECT
    COUNT(*) as total_folhas,
    COUNT(DISTINCT nome) as usuarios_unicos,
    MIN(created_at) as primeira,
    MAX(created_at) as ultima
  FROM folha;
"

# Teste rápido de constraint (deve falhar)
echo ""
echo "🧪 Testando constraint cor inválida (deve falhar)..."
psql -c "
  INSERT INTO folha (nome, cor, profissao, assinatura)
  VALUES ('TesteConstraint', 'invalido', 'Teste', '$ASSINATURA');
" 2>&1 | head -3