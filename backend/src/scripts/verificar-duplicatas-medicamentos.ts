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
 * Verifica duplicatas de medicamentos (apenas relatório, não deleta)
 */
async function verificarDuplicatasMedicamentos() {
  console.log('🔍 Verificando duplicatas de medicamentos...\n');

  // Buscar todos os medicamentos ativos
  const todosMedicamentos = await prisma.medicamento.findMany({
    where: { ativo: true },
    orderBy: { createdAt: 'desc' },
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

  let totalDuplicatas = 0;

  // Mostrar duplicatas por nome
  if (Object.keys(duplicatasPorNome).length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('DUPLICATAS POR NOME:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const [nome, medicamentos] of Object.entries(duplicatasPorNome)) {
      // Ordenar por: mais campos preenchidos, depois mais recente
      medicamentos.sort((a, b) => {
        const camposA = contarCamposPreenchidos(a);
        const camposB = contarCamposPreenchidos(b);
        if (camposB !== camposA) {
          return camposB - camposA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      console.log(`📦 "${medicamentos[0].nomeProduto}" (${medicamentos.length} duplicatas)`);
      console.log(`   ✅ MANTER: ID ${medicamentos[0].id} - ${contarCamposPreenchidos(medicamentos[0])} campos preenchidos`);
      
      for (let i = 1; i < medicamentos.length; i++) {
        const med = medicamentos[i];
        console.log(`   ❌ DELETAR: ID ${med.id} - ${contarCamposPreenchidos(med)} campos preenchidos`);
        totalDuplicatas++;
      }
      console.log('');
    }
  }

  // Mostrar duplicatas por registro (apenas as que não foram já mostradas por nome)
  if (Object.keys(duplicatasPorRegistro).length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('DUPLICATAS POR REGISTRO:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const [registro, medicamentos] of Object.entries(duplicatasPorRegistro)) {
      // Verificar se já foi processado por nome
      const jaProcessado = medicamentos.every(m => {
        const nomeNorm = normalizarString(m.nomeProduto);
        return duplicatasPorNome[nomeNorm] && duplicatasPorNome[nomeNorm].length > 1;
      });
      
      if (jaProcessado) continue;

      medicamentos.sort((a, b) => {
        const camposA = contarCamposPreenchidos(a);
        const camposB = contarCamposPreenchidos(b);
        if (camposB !== camposA) {
          return camposB - camposA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      console.log(`📦 Registro: "${medicamentos[0].numeroRegistroProduto}" (${medicamentos.length} duplicatas)`);
      console.log(`   ✅ MANTER: ID ${medicamentos[0].id} - "${medicamentos[0].nomeProduto}"`);
      
      for (let i = 1; i < medicamentos.length; i++) {
        const med = medicamentos[i];
        console.log(`   ❌ DELETAR: ID ${med.id} - "${med.nomeProduto}"`);
        totalDuplicatas++;
      }
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📋 RESUMO:`);
  console.log(`   - Total de medicamentos: ${todosMedicamentos.length}`);
  console.log(`   - Grupos duplicados por nome: ${Object.keys(duplicatasPorNome).length}`);
  console.log(`   - Grupos duplicados por registro: ${Object.keys(duplicatasPorRegistro).length}`);
  console.log(`   - Total de duplicatas a remover: ${totalDuplicatas}`);
  console.log(`   - Medicamentos únicos após limpeza: ${todosMedicamentos.length - totalDuplicatas}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('💡 Para remover as duplicatas, execute:');
  console.log('   npm run limpar-duplicatas-medicamentos\n');
}

// Executar
verificarDuplicatasMedicamentos()
  .catch((error) => {
    console.error('❌ Erro ao verificar duplicatas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



