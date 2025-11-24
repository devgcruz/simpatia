import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script para re-importar medicamentos com encoding correto
 * Limpa a tabela e re-importa do CSV usando Latin1
 */
async function reimportMedicamentos() {
  try {
    console.log('🗑️  Limpando tabela de medicamentos...');
    const deleted = await prisma.medicamento.deleteMany({});
    console.log(`   ${deleted.count} medicamentos removidos`);

    const csvPath = path.join(__dirname, '../DADOS_ABERTOS_MEDICAMENTOS.csv');
    
    console.log('\n📖 Lendo arquivo CSV com encoding Latin1...');
    // Ler como buffer e converter de latin1 para utf-8
    const buffer = fs.readFileSync(csvPath);
    const fileContent = buffer.toString('latin1');
    
    // Dividir em linhas
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      console.log('❌ Arquivo CSV vazio ou sem dados.');
      return;
    }

    // Primeira linha são os cabeçalhos
    const headers = lines[0].split(';').map(h => h.trim());
    console.log(`📋 Cabeçalhos encontrados: ${headers.join(', ')}`);
    
    // Processar linhas de dados
    const medicamentos: any[] = [];
    let processed = 0;
    let errors = 0;

    console.log(`\n🔄 Processando ${lines.length - 1} linhas...`);

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(';');
        
        // Criar objeto a partir dos valores
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || null;
        });

        // Mapear campos do CSV para o modelo
        const medicamento = {
          tipoProduto: row.TIPO_PRODUTO || null,
          nomeProduto: row.NOME_PRODUTO || null,
          dataFinalizacaoProcesso: null, // Não está no CSV
          categoriaRegulatoria: row.CATEGORIA_REGULATORIA || null,
          numeroRegistroProduto: row.NUMERO_REGISTRO_PRODUTO || null,
          dataVencimentoRegistro: null, // Não está no CSV
          numeroProcesso: null, // Não está no CSV
          classeTerapeutica: row.CLASSE_TERAPEUTICA || null,
          empresaDetentoraRegistro: row.LABORATORIO || null, // Usar LABORATORIO como empresa detentora
          situacaoRegistro: row.SITUACAO_REGISTRO || null,
          principioAtivo: row.PRINCIPIO_ATIVO || null,
        };

        // Validar que pelo menos o nome do produto existe
        if (!medicamento.nomeProduto) {
          errors++;
          continue;
        }

        medicamentos.push(medicamento);
        processed++;

        // Log de progresso a cada 1000 registros
        if (processed % 1000 === 0) {
          console.log(`   Processados: ${processed} registros...`);
        }
      } catch (error: any) {
        errors++;
        if (errors <= 10) {
          console.warn(`   ⚠️  Erro na linha ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Processamento concluído:`);
    console.log(`   Total processado: ${processed} registros`);
    console.log(`   Erros: ${errors}`);

    if (medicamentos.length === 0) {
      console.log('❌ Nenhum medicamento válido para importar.');
      return;
    }

    // Inserir em lotes de 1000
    const batchSize = 1000;
    let inserted = 0;

    console.log(`\n💾 Inserindo no banco de dados com encoding correto...`);

    for (let i = 0; i < medicamentos.length; i += batchSize) {
      const batch = medicamentos.slice(i, i + batchSize);
      
      try {
        const result = await prisma.medicamento.createMany({
          data: batch,
          skipDuplicates: true,
        });
        
        inserted += result.count;
        
        console.log(`   Lote ${Math.floor(i / batchSize) + 1}: ${result.count} inseridos`);
      } catch (error: any) {
        console.error(`   ❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      }
    }

    const finalCount = await prisma.medicamento.count();
    
    console.log(`\n✅ Re-importação concluída!`);
    console.log(`   Total inserido: ${inserted}`);
    console.log(`   Total no banco: ${finalCount}`);
    console.log(`\n✨ Agora os medicamentos devem estar com acentuação correta!`);
  } catch (error: any) {
    console.error('❌ Erro ao re-importar medicamentos:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reimportMedicamentos();

