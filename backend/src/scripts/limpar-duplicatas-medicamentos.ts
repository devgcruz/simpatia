import { prisma } from '../lib/prisma';

/**
 * Normaliza uma string para comparação (remove acentos, espaços extras, etc.)
 */
function normalizarString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim()
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .replace(/[^\w\s]/g, ''); // Remove caracteres especiais
}

/**
 * Conta quantos campos não-nulos um medicamento tem
 */
function contarCamposPreenchidos(medicamento: any): number {
  let count = 0;
  if (medicamento.nomeProduto) count++;
  if (medicamento.numeroRegistroProduto) count++;
  if (medicamento.empresaDetentoraRegistro) count++;
  if (medicamento.principioAtivo) count++;
  if (medicamento.classeTerapeutica) count++;
  if (medicamento.categoriaRegulatoria) count++;
  if (medicamento.situacaoRegistro) count++;
  if (medicamento.tipoProduto) count++;
  return count;
}

/**
 * Identifica e remove duplicatas de medicamentos
 */
async function limparDuplicatasMedicamentos() {
  console.log('🔍 Iniciando limpeza de duplicatas de medicamentos...\n');

  // Buscar todos os medicamentos ativos
  const todosMedicamentos = await prisma.medicamento.findMany({
    where: { ativo: true },
    orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
  });

  console.log(`📊 Total de medicamentos ativos: ${todosMedicamentos.length}\n`);

  // Agrupar por nome normalizado
  const gruposPorNome: { [key: string]: any[] } = {};
  const gruposPorRegistro: { [key: string]: any[] } = {};

  for (const med of todosMedicamentos) {
    const nomeNormalizado = normalizarString(med.nomeProduto);
    if (!gruposPorNome[nomeNormalizado]) {
      gruposPorNome[nomeNormalizado] = [];
    }
    gruposPorNome[nomeNormalizado].push(med);

    // Também agrupar por número de registro se existir
    if (med.numeroRegistroProduto) {
      const registroNormalizado = normalizarString(med.numeroRegistroProduto);
      if (!gruposPorRegistro[registroNormalizado]) {
        gruposPorRegistro[registroNormalizado] = [];
      }
      gruposPorRegistro[registroNormalizado].push(med);
    }
  }

  // Identificar duplicatas por nome
  const duplicatasPorNome: { [key: string]: any[] } = {};
  for (const [nome, medicamentos] of Object.entries(gruposPorNome)) {
    if (medicamentos.length > 1) {
      duplicatasPorNome[nome] = medicamentos;
    }
  }

  // Identificar duplicatas por registro
  const duplicatasPorRegistro: { [key: string]: any[] } = {};
  for (const [registro, medicamentos] of Object.entries(gruposPorRegistro)) {
    if (medicamentos.length > 1) {
      duplicatasPorRegistro[registro] = medicamentos;
    }
  }

  console.log(`🔎 Duplicatas encontradas por nome: ${Object.keys(duplicatasPorNome).length} grupos`);
  console.log(`🔎 Duplicatas encontradas por registro: ${Object.keys(duplicatasPorRegistro).length} grupos\n`);

  const medicamentosParaDeletar: number[] = [];
  const medicamentosParaManter: Set<number> = new Set();

  // Processar duplicatas por nome
  for (const [nome, medicamentos] of Object.entries(duplicatasPorNome)) {
    // Ordenar por: mais campos preenchidos, depois mais recente
    medicamentos.sort((a, b) => {
      const camposA = contarCamposPreenchidos(a);
      const camposB = contarCamposPreenchidos(b);
      if (camposB !== camposA) {
        return camposB - camposA; // Mais campos primeiro
      }
      // Se empate, mais recente primeiro
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Manter o primeiro (melhor)
    const manter = medicamentos[0];
    medicamentosParaManter.add(manter.id);
    console.log(`✅ Mantendo: "${manter.nomeProduto}" (ID: ${manter.id}, campos: ${contarCamposPreenchidos(manter)})`);

    // Marcar os outros para deletar
    for (let i = 1; i < medicamentos.length; i++) {
      const deletar = medicamentos[i];
      medicamentosParaDeletar.push(deletar.id);
      console.log(`   ❌ Marcado para deletar: "${deletar.nomeProduto}" (ID: ${deletar.id}, campos: ${contarCamposPreenchidos(deletar)})`);
    }
  }

  // Processar duplicatas por registro (mas não duplicar remoções)
  for (const [registro, medicamentos] of Object.entries(duplicatasPorRegistro)) {
    // Se todos já foram processados por nome, pular
    if (medicamentos.every(m => medicamentosParaManter.has(m.id) || medicamentosParaDeletar.includes(m.id))) {
      continue;
    }

    // Ordenar por: mais campos preenchidos, depois mais recente
    medicamentos.sort((a, b) => {
      const camposA = contarCamposPreenchidos(a);
      const camposB = contarCamposPreenchidos(b);
      if (camposB !== camposA) {
        return camposB - camposA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Manter o primeiro (melhor)
    const manter = medicamentos[0];
    if (!medicamentosParaManter.has(manter.id) && !medicamentosParaDeletar.includes(manter.id)) {
      medicamentosParaManter.add(manter.id);
      console.log(`✅ Mantendo por registro: "${manter.nomeProduto}" (ID: ${manter.id})`);
    }

    // Marcar os outros para deletar
    for (let i = 1; i < medicamentos.length; i++) {
      const deletar = medicamentos[i];
      if (!medicamentosParaDeletar.includes(deletar.id) && !medicamentosParaManter.has(deletar.id)) {
        medicamentosParaDeletar.push(deletar.id);
        console.log(`   ❌ Marcado para deletar por registro: "${deletar.nomeProduto}" (ID: ${deletar.id})`);
      }
    }
  }

  // Remover duplicatas da lista de deletar se já estão marcados para manter
  const idsParaDeletar = medicamentosParaDeletar.filter(id => !medicamentosParaManter.has(id));

  console.log(`\n📋 Resumo:`);
  console.log(`   - Medicamentos para manter: ${medicamentosParaManter.size}`);
  console.log(`   - Medicamentos para deletar: ${idsParaDeletar.length}\n`);

  if (idsParaDeletar.length === 0) {
    console.log('✨ Nenhuma duplicata encontrada para remover!\n');
    return;
  }

  // Antes de deletar, atualizar referências em AlergiaMedicamento
  console.log('🔄 Atualizando referências em alergias...\n');
  
  for (const idDeletar of idsParaDeletar) {
    const medicamentoDeletar = todosMedicamentos.find(m => m.id === idDeletar);
    if (!medicamentoDeletar) continue;

    // Encontrar o medicamento a manter (mesmo nome normalizado)
    const nomeNormalizado = normalizarString(medicamentoDeletar.nomeProduto);
    const grupo = gruposPorNome[nomeNormalizado];
    if (!grupo || grupo.length === 0) continue;

    const medicamentoManter = grupo.find(m => medicamentosParaManter.has(m.id));
    if (!medicamentoManter) continue;

    // Atualizar alergias que referenciam o medicamento a deletar
    const alergias = await prisma.alergiaMedicamento.findMany({
      where: { medicamentoId: idDeletar },
    });

    if (alergias.length > 0) {
      console.log(`   Atualizando ${alergias.length} alergia(s) do medicamento ID ${idDeletar} para ID ${medicamentoManter.id}`);
      await prisma.alergiaMedicamento.updateMany({
        where: { medicamentoId: idDeletar },
        data: { medicamentoId: medicamentoManter.id },
      });
    }
  }

  // Deletar medicamentos duplicados (soft delete)
  console.log(`\n🗑️  Removendo ${idsParaDeletar.length} medicamento(s) duplicado(s)...\n`);
  
  const resultado = await prisma.medicamento.updateMany({
    where: {
      id: { in: idsParaDeletar },
    },
    data: {
      ativo: false,
    },
  });

  console.log(`✅ ${resultado.count} medicamento(s) marcado(s) como inativo(s)\n`);
  console.log('✨ Limpeza concluída!\n');
}

// Executar
limparDuplicatasMedicamentos()
  .catch((error) => {
    console.error('❌ Erro ao limpar duplicatas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

