import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/**
 * Script para corrigir o encoding dos medicamentos já importados
 * Converte caracteres mal codificados de volta para UTF-8
 */
async function fixMedicamentosEncoding() {
  try {
    console.log('🔄 Buscando medicamentos para corrigir encoding...');
    
    const medicamentos = await prisma.medicamento.findMany({
      take: 10000, // Processar em lotes se necessário
    });

    console.log(`📊 Encontrados ${medicamentos.length} medicamentos`);

    // Verificar quantos têm o caractere de substituição
    const comProblema = medicamentos.filter(m => 
      (m.nomeProduto && (m.nomeProduto.includes('') || m.nomeProduto.includes('\uFFFD'))) ||
      (m.categoriaRegulatoria && (m.categoriaRegulatoria.includes('') || m.categoriaRegulatoria.includes('\uFFFD'))) ||
      (m.situacaoRegistro && (m.situacaoRegistro.includes('') || m.situacaoRegistro.includes('\uFFFD'))) ||
      (m.empresaDetentoraRegistro && (m.empresaDetentoraRegistro.includes('') || m.empresaDetentoraRegistro.includes('\uFFFD'))) ||
      (m.classeTerapeutica && (m.classeTerapeutica.includes('') || m.classeTerapeutica.includes('\uFFFD'))) ||
      (m.principioAtivo && (m.principioAtivo.includes('') || m.principioAtivo.includes('\uFFFD')))
    );

    console.log(`\n⚠️  Medicamentos com problema de encoding: ${comProblema.length}`);
    
    if (comProblema.length > 0) {
      console.log('\n📋 Exemplos de dados com problema:');
      comProblema.slice(0, 5).forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.nomeProduto} - ${m.categoriaRegulatoria} - ${m.situacaoRegistro}`);
      });
      console.log('\n💡 NOTA: Quando há o símbolo no banco, a informação original foi perdida.');
      console.log('   A melhor solução é re-importar do CSV original usando: npm run reimport-medicamentos');
      console.log('   Este script tentará corrigir o que for possível, mas pode não recuperar tudo.\n');
    }

    let updated = 0;
    let errors = 0;

    // Função para corrigir encoding de uma string
    // O problema: texto contém (U+FFFD) que indica encoding incorreto
    // Quando o CSV foi lido como UTF-8 mas estava em Latin1, alguns bytes
    // foram interpretados como sequências UTF-8 inválidas e substituídos por
    const fixEncoding = (text: string | null | undefined): string | null => {
      if (!text) return text;
      
      // Se não contém o caractere de substituição, não precisa corrigir
      if (!text.includes('') && !text.includes('\uFFFD')) {
        return text;
      }
      
      try {
        // O problema: quando salvamos no banco, o texto já estava mal codificado
        // Mas podemos tentar re-interpretar os bytes que foram salvos
        
        // Estratégia: tentar diferentes interpretações dos bytes salvos
        // 1. Pegar os bytes como estão salvos (UTF-8 atual)
        const utf8Bytes = Buffer.from(text, 'utf-8');
        
        // 2. Re-interpretar esses bytes como Latin1
        // Isso pode recuperar alguns caracteres se os bytes originais foram preservados
        const latin1Interpretation = utf8Bytes.toString('latin1');
        
        // 3. Se a interpretação Latin1 não tem, pode ser a correta
        if (!latin1Interpretation.includes('') && !latin1Interpretation.includes('\uFFFD')) {
          // Mas precisamos garantir que faz sentido - verificar se tem acentos comuns
          const hasCommonAccents = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(latin1Interpretation);
          if (hasCommonAccents || latin1Interpretation.length === text.length) {
            return latin1Interpretation;
          }
        }
        
        // 4. Tentar outra abordagem: assumir que o texto foi salvo como UTF-8
        // mas os bytes originais (Latin1) foram convertidos incorretamente
        // Tentar converter de volta: UTF-8 -> bytes -> Latin1 -> UTF-8 correto
        try {
          // Se o texto contém, pode ser que os bytes originais ainda estejam lá
          // mas mal interpretados. Vamos tentar uma conversão reversa.
          const reencoded = Buffer.from(text, 'utf-8').toString('latin1');
          
          // Verificar se melhorou
          if (reencoded && reencoded !== text) {
            // Se não tem mais, pode ser correto
            if (!reencoded.includes('') && !reencoded.includes('\uFFFD')) {
              return reencoded;
            }
          }
        } catch (err) {
          // Ignorar erro
        }
        
        // Se nada funcionou, retornar original (melhor que perder dados)
        return text;
      } catch (err) {
        // Se houver erro, retornar o texto original
        return text;
      }
    };

    console.log('\n💾 Corrigindo medicamentos...');

    for (const medicamento of medicamentos) {
      try {
        const updates: any = {};

        // Corrigir cada campo de texto
        if (medicamento.tipoProduto) {
          updates.tipoProduto = fixEncoding(medicamento.tipoProduto);
        }
        if (medicamento.nomeProduto) {
          updates.nomeProduto = fixEncoding(medicamento.nomeProduto);
        }
        if (medicamento.categoriaRegulatoria) {
          updates.categoriaRegulatoria = fixEncoding(medicamento.categoriaRegulatoria);
        }
        if (medicamento.classeTerapeutica) {
          updates.classeTerapeutica = fixEncoding(medicamento.classeTerapeutica);
        }
        if (medicamento.empresaDetentoraRegistro) {
          updates.empresaDetentoraRegistro = fixEncoding(medicamento.empresaDetentoraRegistro);
        }
        if (medicamento.situacaoRegistro) {
          updates.situacaoRegistro = fixEncoding(medicamento.situacaoRegistro);
        }
        if (medicamento.principioAtivo) {
          updates.principioAtivo = fixEncoding(medicamento.principioAtivo);
        }

        // Verificar se há mudanças (comparar valores corrigidos)
        let hasChanges = false;
        Object.keys(updates).forEach((key) => {
          const original = (medicamento as any)[key];
          const corrected = updates[key];
          // Verificar se mudou E se não contém mais
          if (corrected !== original && corrected && !corrected.includes('') && !corrected.includes('\uFFFD')) {
            hasChanges = true;
          }
        });

        if (hasChanges) {
          await prisma.medicamento.update({
            where: { id: medicamento.id },
            data: updates,
          });
          updated++;

          if (updated % 100 === 0) {
            console.log(`   Corrigidos: ${updated} medicamentos...`);
          }
        }
      } catch (error: any) {
        errors++;
        if (errors <= 10) {
          console.warn(`   ⚠️  Erro ao corrigir medicamento ID ${medicamento.id}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Correção concluída!`);
    console.log(`   Total corrigido: ${updated}`);
    console.log(`   Erros: ${errors}`);
  } catch (error: any) {
    console.error('❌ Erro ao corrigir encoding:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixMedicamentosEncoding();

