import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import servicosService from './servicos.service';
import disponibilidadeService from './disponibilidade.service';
import pacienteService from './pacientes.service';
import agendamentoService from './agendamento.service';
import doutorService from './doutor.service';
import { prisma } from '../lib/prisma'; // Usaremos o prisma para uma verificação rápida

/**
 * Gera um resumo/entendimento da IA sobre o que o paciente relatou
 */
async function gerarEntendimentoIA(relatoPaciente: string): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('[gerarEntendimentoIA] GOOGLE_API_KEY não configurado - retornando resumo básico');
      return `Paciente relatou: ${relatoPaciente.substring(0, 200)}${relatoPaciente.length > 200 ? '...' : ''}`;
    }

    const llm = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash-lite',
      temperature: 0.3, // Temperatura baixa para resumos mais consistentes
    });

    const prompt = `Você é um assistente médico especializado. Analise o relato do paciente abaixo e gere um entendimento completo que inclua:
1. O que o paciente está relatando (sintomas, queixas ou necessidades)
2. Uma análise breve da situação
3. Recomendações de procedimentos ou avaliações adequadas para o caso

Relato do paciente: "${relatoPaciente}"

Gere um entendimento completo em 2-3 frases, em português, que inclua:
- O diagnóstico ou queixa principal do paciente
- Uma análise breve do caso
- Recomendações de procedimentos ou avaliações apropriadas (ex: "recomenda-se uma obturação" ou "recomenda-se uma avaliação para confirmar")

Exemplo de formato esperado: "O paciente relata [queixa]. [Análise breve da situação]. Recomenda-se [procedimento/avaliação]."

Seja específico e profissional.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const entendimento = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);
    
    console.log(`[gerarEntendimentoIA] ✅ Entendimento gerado: "${entendimento}"`);
    return entendimento.trim();
  } catch (error: any) {
    console.error('[gerarEntendimentoIA] ❌ Erro ao gerar entendimento:', error);
    // Fallback: retorna um resumo básico
    return `Paciente relatou: ${relatoPaciente.substring(0, 200)}${relatoPaciente.length > 200 ? '...' : ''}`;
  }
}

// Função auxiliar para formatar R$ 100.5 para "R$ 100,50"
function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

// --- Funções Factory para as Ferramentas ---

/**
 * Cria a ferramenta para classificar sintomas/procedimentos e encontrar o serviço adequado.
 * @param clinicaId O ID da clínica específica.
 */
export function createClassificarSintomaTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'classificar_sintoma_para_servico',
    description:
      'FERRAMENTA DISPONÍVEL: Use esta ferramenta quando o paciente mencionar sintomas ou procedimentos como "cárie", "dor de dente", "botox", "limpeza de pele", "clareamento", "restauração", "retorno da nutri", etc. Esta ferramenta busca no catálogo de serviços e retorna o servicoId e sugestão de doutorId. IMPORTANTE: Esta é uma FERRAMENTA que você DEVE CHAMAR, não código para escrever. Use chamando a ferramenta com o sintoma mencionado pelo paciente. APÓS usar esta ferramenta e obter servicoId e doutorId, você DEVE IMEDIATAMENTE verificar disponibilidade para HOJE usando verificar_disponibilidade_horarios antes de perguntar a data ao paciente.',
    schema: z.object({
      sintomaOuProcedimento: z
        .string()
        .describe(
          'O sintoma ou procedimento mencionado pelo paciente (ex: "dor de dente", "botox", "limpeza de pele", "clareamento")',
        ),
    }),
    func: async ({ sintomaOuProcedimento }) => {
      try {
        const servicos = await servicosService.getAll(clinicaId);
        const doutores = await doutorService.getAllParaIA(clinicaId);

        const termoBusca = sintomaOuProcedimento.toLowerCase().trim();

        // Mapeamento de termos comuns para palavras-chave
        const mapeamentoTermos: Record<string, string[]> = {
          'cárie': ['odontologia', 'dente', 'dental', 'odontológico', 'avaliação', 'restauração', 'tratamento'],
          'carie': ['odontologia', 'dente', 'dental', 'odontológico', 'avaliação', 'restauração', 'tratamento'],
          'dor de dente': ['odontologia', 'dente', 'dental', 'odontológico', 'avaliação'],
          'dor no dente': ['odontologia', 'dente', 'dental', 'odontológico', 'avaliação'],
          'botox': ['botox', 'harmonização', 'facial', 'toxina'],
          'limpeza de pele': ['limpeza', 'facial', 'estética', 'pele'],
          'clareamento': ['clareamento', 'dental', 'dente'],
          'nutri': ['nutrição', 'nutricionista', 'dieta', 'alimentação'],
          'retorno': ['retorno', 'consulta'],
        };

        // Encontrar palavras-chave relevantes
        let palavrasChave: string[] = [];
        for (const [termo, chaves] of Object.entries(mapeamentoTermos)) {
          if (termoBusca.includes(termo) || termo.includes(termoBusca)) {
            palavrasChave.push(...chaves);
          }
        }

        // Se não encontrou no mapeamento, usar o termo original
        if (palavrasChave.length === 0) {
          palavrasChave = [termoBusca];
        }

        // Buscar serviços que correspondem
        let servicosCorrespondentes = servicos.filter((s) => {
          const nomeLower = s.nome.toLowerCase();
          const descLower = s.descricao?.toLowerCase() || '';
          return palavrasChave.some((chave) => nomeLower.includes(chave) || descLower.includes(chave));
        });

        // Se não encontrou correspondência exata, buscar serviço semelhante por categoria
        if (servicosCorrespondentes.length === 0) {
          // Tenta encontrar por categoria geral
          if (termoBusca.includes('dente') || termoBusca.includes('cárie') || termoBusca.includes('carie') || termoBusca.includes('odont')) {
            // Busca qualquer serviço odontológico
            servicosCorrespondentes = servicos.filter((s) => {
              const nomeLower = s.nome.toLowerCase();
              const descLower = s.descricao?.toLowerCase() || '';
              return nomeLower.includes('odont') || nomeLower.includes('dente') || nomeLower.includes('dental') || 
                     descLower.includes('odont') || descLower.includes('dente') || descLower.includes('dental') ||
                     nomeLower.includes('avaliação') || nomeLower.includes('consulta');
            });
          } else if (termoBusca.includes('estética') || termoBusca.includes('estetica') || termoBusca.includes('pele') || termoBusca.includes('botox')) {
            // Busca qualquer serviço estético
            servicosCorrespondentes = servicos.filter((s) => {
              const nomeLower = s.nome.toLowerCase();
              const descLower = s.descricao?.toLowerCase() || '';
              return nomeLower.includes('estética') || nomeLower.includes('estetica') || nomeLower.includes('facial') || 
                     descLower.includes('estética') || descLower.includes('estetica') || descLower.includes('facial');
            });
          } else if (termoBusca.includes('nutri') || termoBusca.includes('dieta') || termoBusca.includes('alimentação')) {
            // Busca qualquer serviço de nutrição
            servicosCorrespondentes = servicos.filter((s) => {
              const nomeLower = s.nome.toLowerCase();
              const descLower = s.descricao?.toLowerCase() || '';
              return nomeLower.includes('nutri') || nomeLower.includes('dieta') || 
                     descLower.includes('nutri') || descLower.includes('dieta');
            });
          }
          
          // Se ainda não encontrou, pega o primeiro serviço disponível como fallback
          if (servicosCorrespondentes.length === 0 && servicos.length > 0 && servicos[0]) {
            servicosCorrespondentes = [servicos[0]];
          }
        }

        // Encontrar doutor adequado baseado na especialidade
        const servicoEncontrado = servicosCorrespondentes[0];
        if (!servicoEncontrado) {
          // Último fallback: retorna erro mas instrui a IA a usar o primeiro serviço disponível
          return `Não encontrei um serviço específico para "${sintomaOuProcedimento}". Use o primeiro serviço disponível no catálogo e prossiga com o agendamento. NÃO pergunte ao paciente qual serviço ele quer - escolha o mais semelhante automaticamente.`;
        }

        const doutorAdequado = doutores.find((d) => {
          if (!d.especialidade) return false;
          const especialidadeLower = d.especialidade.toLowerCase();
          return palavrasChave.some((chave) => especialidadeLower.includes(chave));
        });

        // Se há apenas 1 doutor na clínica, usar automaticamente mesmo sem especialidade correspondente
        let doutorFinal = doutorAdequado;
        if (!doutorFinal && doutores.length === 1 && doutores[0]) {
          console.log(`[ClassificarSintomaTool] Clínica tem apenas 1 doutor - usando automaticamente: ${doutores[0].nome} (ID: ${doutores[0].id})`);
          doutorFinal = doutores[0];
        }

        const resposta = `Encontrei o serviço adequado: "${servicoEncontrado.nome}" (ID: ${servicoEncontrado.id}, Duração: ${servicoEncontrado.duracaoMin} min).`;
        const doutorInfo = doutorFinal
          ? ` Sugiro o doutor ${doutorFinal.nome} (ID: ${doutorFinal.id}${doutorFinal.especialidade ? `, Especialidade: ${doutorFinal.especialidade}` : ''}).`
          : '';

        return resposta + doutorInfo;
      } catch (error: any) {
        console.error('Erro em ClassificarSintomaTool:', error);
        // Em caso de erro, tenta retornar o primeiro serviço disponível
        try {
          const servicos = await servicosService.getAll(clinicaId);
          if (servicos.length > 0 && servicos[0]) {
            return `Erro ao classificar, mas use o serviço "${servicos[0].nome}" (ID: ${servicos[0].id}) e prossiga com o agendamento. NÃO pergunte ao paciente - escolha automaticamente.`;
          }
        } catch (e) {
          // Ignora erro secundário
        }
        return `Erro ao classificar o sintoma. Use o primeiro serviço disponível no catálogo e prossiga. NÃO pergunte ao paciente.`;
      }
    },
  });
}

/**
 * Cria a ferramenta para listar os serviços da clínica.
 * @param clinicaId O ID da clínica específica.
 */
export function createListarServicosTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'listar_servicos_clinica',
    description:
      'ESSA É A FERRAMENTA MAIS IMPORTANTE. Use-a SEMPRE que o paciente perguntar "quais serviços", "quais tratamentos", "quais especialidades", "o que vocês fazem" ou qualquer variação disso. Retorna a lista de serviços, preços e duração.',
    schema: z.object({}),
    func: async () => {
      try {
        // Chama o serviço real que já criámos
        const servicos = await servicosService.getAll(clinicaId);
        if (servicos.length === 0) {
          return 'Nenhum serviço encontrado para esta clínica.';
        }
        const listaFormatada = servicos
          .map((s) => `- ${s.nome} (${s.duracaoMin} min) - ${formatPrice(s.preco)}`)
          .join('\n'); // Usar \n para quebra de linha no WhatsApp
        return `Aqui estão os serviços que oferecemos:\n${listaFormatada}`;
      } catch (error: any) {
        console.error('Erro em ListarServicosTool:', error);
        return `Erro ao buscar serviços.`;
      }
    },
  });
}

/**
 * Cria a ferramenta para verificar horários livres.
 * @param clinicaId O ID da clínica específica.
 */
// Função helper para validar e converter datas
function validarDataFutura(dataStr: string): { valida: boolean; dataISO?: string; mensagem?: string } {
  try {
    // Tenta parsear como AAAA-MM-DD
    let dataObj: Date;
    if (dataStr.includes('/')) {
      // Formato brasileiro DD/MM/YYYY
      const partes = dataStr.split('/');
      if (partes.length !== 3) {
        return { valida: false, mensagem: 'Data inválida. Use o formato DD/MM/YYYY ou AAAA-MM-DD.' };
      }
      const dia = Number(partes[0]);
      const mes = Number(partes[1]);
      const ano = Number(partes[2]);
      if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
        return { valida: false, mensagem: 'Data inválida. Use o formato DD/MM/YYYY ou AAAA-MM-DD.' };
      }
      // Usa construtor local para evitar problemas de fuso horário
      dataObj = new Date(ano, mes - 1, dia, 12, 0, 0); // Meio-dia para evitar problemas de fuso
    } else {
      // Formato ISO AAAA-MM-DD - IMPORTANTE: parsear manualmente para evitar problemas de UTC
      const partes = dataStr.split('-');
      if (partes.length !== 3) {
        return { valida: false, mensagem: 'Data inválida. Use o formato AAAA-MM-DD (ex: 2025-11-13).' };
      }
      const ano = Number(partes[0]);
      const mes = Number(partes[1]);
      const dia = Number(partes[2]);
      if (isNaN(ano) || isNaN(mes) || isNaN(dia)) {
        return { valida: false, mensagem: 'Data inválida. Use o formato AAAA-MM-DD (ex: 2025-11-13).' };
      }
      // Usa construtor local para evitar problemas de fuso horário
      dataObj = new Date(ano, mes - 1, dia, 12, 0, 0); // Meio-dia para evitar problemas de fuso
    }

    // Verifica se a data é válida
    if (isNaN(dataObj.getTime())) {
      return { valida: false, mensagem: 'Data inválida. Use o formato AAAA-MM-DD (ex: 2025-11-13).' };
    }

    // Verifica se a data é futura (a partir de hoje, sem hora)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataComparacao = new Date(dataObj);
    dataComparacao.setHours(0, 0, 0, 0);

    if (dataComparacao < hoje) {
      const hojeFormatado = hoje.toLocaleDateString('pt-BR');
      return {
        valida: false,
        mensagem: `A data informada já passou. Só podemos agendar a partir de hoje (${hojeFormatado}). Por favor, informe uma data futura.`,
      };
    }

    // Retorna a data no formato ISO (AAAA-MM-DD) usando os valores originais para evitar problemas de fuso
    // Extrai ano, mês e dia diretamente da string ou do objeto Date local
    let ano: number, mes: number, dia: number;
    
    if (dataStr.includes('/')) {
      // Já temos os valores do parse brasileiro
      const partes = dataStr.split('/');
      dia = Number(partes[0]);
      mes = Number(partes[1]);
      ano = Number(partes[2]);
    } else {
      // Formato ISO - extrai diretamente da string
      const partes = dataStr.split('-');
      ano = Number(partes[0]);
      mes = Number(partes[1]);
      dia = Number(partes[2]);
    }
    
    // Garante que os valores são válidos
    if (isNaN(ano) || isNaN(mes) || isNaN(dia)) {
      // Fallback: usa getFullYear, getMonth, getDate (mas pode ter problemas de fuso)
      ano = dataObj.getFullYear();
      mes = dataObj.getMonth() + 1;
      dia = dataObj.getDate();
    }
    
    const dataISO = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    console.log(`[validarDataFutura] Data de entrada: "${dataStr}" -> Data ISO: "${dataISO}" (ano=${ano}, mes=${mes}, dia=${dia})`);

    return { valida: true, dataISO };
  } catch (error: any) {
    return { valida: false, mensagem: `Erro ao processar data: ${error.message || 'Erro desconhecido'}` };
  }
}

export function createVerificarDisponibilidadeTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'verificar_disponibilidade_horarios',
    description:
      'CRÍTICO: Use esta ferramenta SEMPRE que tiver servicoId, doutorId e data do paciente. Esta ferramenta analisa a agenda do doutor e retorna os horários disponíveis já formatados para sugestão. A data deve estar no formato AAAA-MM-DD (ex: 2025-11-13) e DEVE ser futura. A ferramenta retorna os horários ordenados (primeiros primeiro). Você DEVE SEMPRE SUGERIR os primeiros 3 horários disponíveis ao paciente de forma proativa. NÃO apenas liste - SUGIRA. Exemplo obrigatório: "Para amanhã (14/11/2025), tenho disponível às 08h, 08h30 ou 09h. Qual prefere?"',
    schema: z.object({
      doutorId: z.number().describe('O ID do doutor'),
      servicoId: z.number().describe('O ID do serviço'),
      data: z.string().describe('A data para verificar, no formato AAAA-MM-DD (ex: 2025-11-13). DEVE ser uma data futura.'),
    }),
    func: async ({ doutorId, servicoId, data }) => {
      console.log(`\n[VerificarDisponibilidadeTool] ========== INÍCIO ==========`);
      console.log(`[VerificarDisponibilidadeTool] 📥 Parâmetros recebidos:`);
      console.log(`  - clinicaId: ${clinicaId}`);
      console.log(`  - doutorId: ${doutorId}`);
      console.log(`  - servicoId: ${servicoId}`);
      console.log(`  - data (entrada): "${data}"`);
      
      try {
        // Valida se a data é futura
        console.log(`[VerificarDisponibilidadeTool] 🔍 Validando data: "${data}"`);
        const validacao = validarDataFutura(data);
        console.log(`[VerificarDisponibilidadeTool] 📋 Resultado da validação:`, {
          valida: validacao.valida,
          dataISO: validacao.dataISO,
          mensagem: validacao.mensagem
        });
        
        if (!validacao.valida) {
          console.warn(`[VerificarDisponibilidadeTool] ⚠️ Data inválida: ${validacao.mensagem}`);
          console.log(`[VerificarDisponibilidadeTool] ========== FIM (erro validação) ==========\n`);
          return validacao.mensagem || 'Data inválida. Use uma data futura no formato AAAA-MM-DD.';
        }

        // Chama o serviço real que já criámos
        console.log(`[VerificarDisponibilidadeTool] 📞 Chamando disponibilidadeService.getDisponibilidadeParaIA`);
        console.log(`  - clinicaId: ${clinicaId}`);
        console.log(`  - doutorId: ${doutorId}`);
        console.log(`  - servicoId: ${servicoId}`);
        console.log(`  - dataISO: ${validacao.dataISO}`);
        
        const inicioChamada = Date.now();
        const horarios = await disponibilidadeService.getDisponibilidadeParaIA(
          clinicaId,
          doutorId,
          servicoId,
          validacao.dataISO!,
        );
        const tempoChamada = Date.now() - inicioChamada;
        
        console.log(`[VerificarDisponibilidadeTool] ⏱️ Tempo de resposta do serviço: ${tempoChamada}ms`);
        console.log(`[VerificarDisponibilidadeTool] 📊 Resultado do serviço:`);
        console.log(`  - Total de horários retornados: ${horarios.length}`);
        if (horarios.length > 0) {
          console.log(`  - Primeiros 5 horários:`, horarios.slice(0, 5));
          console.log(`  - Últimos 3 horários:`, horarios.slice(-3));
        }
        
        // Parse manual da data ISO para evitar problemas de fuso horário
        const partesData = validacao.dataISO!.split('-');
        const anoData = Number(partesData[0]);
        const mesData = Number(partesData[1]);
        const diaData = Number(partesData[2]);
        
        console.log(`[VerificarDisponibilidadeTool] 📅 Processando data:`);
        console.log(`  - partesData: [${partesData.join(', ')}]`);
        console.log(`  - anoData: ${anoData}`);
        console.log(`  - mesData: ${mesData}`);
        console.log(`  - diaData: ${diaData}`);
        
        // Cria data em hora local para calcular dia da semana corretamente
        const dataObjParaDiaSemana = new Date(anoData, mesData - 1, diaData, 12, 0, 0);
        const diaSemana = dataObjParaDiaSemana.getDay();
        const nomesDias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        
        console.log(`  - dataObjParaDiaSemana: ${dataObjParaDiaSemana.toISOString()}`);
        console.log(`  - diaSemana (número): ${diaSemana} (${nomesDias[diaSemana]})`);
        
        // Formata data em formato brasileiro manualmente
        const dataFormatada = `${String(diaData).padStart(2, '0')}/${String(mesData).padStart(2, '0')}/${anoData}`;
        console.log(`  - dataFormatada (BR): ${dataFormatada}`);
        
        if (horarios.length === 0) {
          console.warn(`[VerificarDisponibilidadeTool] ⚠️ Nenhum horário disponível`);
          console.warn(`  - Data: ${dataFormatada} (${nomesDias[diaSemana]})`);
          console.warn(`  - Possíveis causas: doutor sem horário cadastrado para este dia da semana ou agenda completamente ocupada`);
          console.log(`[VerificarDisponibilidadeTool] ========== FIM (sem horários) ==========\n`);
          
          // Retorna mensagem mais específica para a IA entender o contexto
          return `Nenhum horário disponível encontrado para ${dataFormatada} (${nomesDias[diaSemana]}). Possíveis motivos: o doutor não tem horário cadastrado para este dia da semana, ou a agenda está completamente ocupada. Sugira ao paciente tentar outra data ou pergunte qual dia ele prefere.`;
        }
        
        // Prioriza os primeiros horários do dia (já estão ordenados)
        // Pega os 3 primeiros horários para sugerir
        const horariosSugeridos = horarios.slice(0, 3);
        
        console.log(`[VerificarDisponibilidadeTool] ✨ Preparando sugestão:`);
        console.log(`  - Total disponível: ${horarios.length}`);
        console.log(`  - Horários a sugerir: ${horariosSugeridos.length}`);
        console.log(`  - Horários selecionados:`, horariosSugeridos);
        
        // Formata horários para brasileiro (08:00 -> 08h, 08:30 -> 08h30)
        const horariosFormatados = horariosSugeridos.map(h => {
          const [hora, minuto] = h.split(':');
          if (minuto === '00') {
            return `${hora}h`;
          }
          return `${hora}h${minuto}`;
        });
        
        console.log(`  - Horários formatados:`, horariosFormatados);
        
        // Formata a resposta para a IA sugerir os primeiros horários de forma proativa
        let respostaFinal: string;
        if (horariosSugeridos.length === 1) {
          respostaFinal = `SUGESTÃO DE HORÁRIO: Para ${dataFormatada}, tenho disponível às ${horariosFormatados[0]}. Posso agendar para você? (Este é o primeiro horário disponível do dia)`;
        } else if (horariosSugeridos.length === 2) {
          respostaFinal = `SUGESTÃO DE HORÁRIOS: Para ${dataFormatada}, tenho disponível às ${horariosFormatados[0]} ou ${horariosFormatados[1]}. Qual prefere? (Estes são os primeiros horários disponíveis do dia)`;
        } else {
          respostaFinal = `SUGESTÃO DE HORÁRIOS: Para ${dataFormatada}, tenho disponível às ${horariosFormatados[0]}, ${horariosFormatados[1]} ou ${horariosFormatados[2]}. Qual prefere? (Estes são os primeiros horários disponíveis do dia para melhor aproveitamento da agenda)`;
        }
        
        console.log(`[VerificarDisponibilidadeTool] ✅ Resposta final gerada:`);
        console.log(`  "${respostaFinal}"`);
        console.log(`[VerificarDisponibilidadeTool] ========== FIM (sucesso) ==========\n`);
        
        return respostaFinal;
      } catch (error: any) {
        console.error(`[VerificarDisponibilidadeTool] ❌ ERRO CAPTURADO:`);
        console.error(`  - Tipo: ${error.constructor.name}`);
        console.error(`  - Mensagem: ${error.message}`);
        console.error(`  - Stack:`, error.stack);
        
        // Tenta dar uma resposta mais útil para a IA
        let respostaErro: string;
        if (error.message && error.message.includes('Serviço ou Doutor não encontrado')) {
          console.error(`[VerificarDisponibilidadeTool] ❌ Erro: Serviço ou Doutor não encontrado`);
          respostaErro = 'O ID do Doutor ou do Serviço parece estar incorreto. Verifique os IDs e tente novamente.';
        } else {
          console.error(`[VerificarDisponibilidadeTool] ❌ Erro genérico`);
          respostaErro = `Erro ao verificar disponibilidade. Detalhe: ${error.message || 'Erro desconhecido'}`;
        }
        
        console.log(`[VerificarDisponibilidadeTool] ========== FIM (erro) ==========\n`);
        return respostaErro;
      }
    },
  });
}

/**
 * Cria a ferramenta para marcar o agendamento.
 * @param clinicaId O ID da clínica específica.
 * @param telefonePaciente O número do WhatsApp do paciente.
 */
export function createMarcarAgendamentoTool(clinicaId: number, telefonePaciente: string) {
  return new DynamicStructuredTool({
    name: 'marcar_agendamento_paciente',
    description:
      'CRÍTICO: Use esta ferramenta APENAS quando o paciente ESCOLHEU EXPLICITAMENTE um horário que você sugeriu. NUNCA agende sem o paciente ter escolhido um horário primeiro. FLUXO OBRIGATÓRIO: 1) Pergunte o que está acontecendo/qual a queixa do paciente, 2) Aguarde a resposta do paciente sobre o que está acontecendo, 3) Sugira horários usando verificar_disponibilidade_horarios, 4) Espere o paciente escolher um horário (dizer "08h", "o primeiro", "pode ser às 09h", etc.), 5) SÓ ENTÃO use esta ferramenta. IMPORTANTE: A dataHora deve estar no formato ISO (ex: 2025-11-20T10:30:00) e DEVE ser uma data/hora futura. O relatoPaciente deve ser a resposta completa do paciente sobre o que está acontecendo (ex: "estou com uma cárie no dente de trás", "quero fazer limpeza de pele porque tenho muitas espinhas").',
    schema: z.object({
      doutorId: z.number().describe('O ID do doutor'),
      servicoId: z.number().describe('O ID do serviço'),
      dataHora: z.string().describe('A data e hora exata do agendamento, no formato ISO (ex: 2025-11-20T10:30:00). DEVE ser uma data/hora futura.'),
      relatoPaciente: z.string().optional().describe('A resposta completa do paciente sobre o que está acontecendo ou qual é a queixa dele. Use o histórico da conversa para encontrar a resposta do paciente à pergunta "o que está acontecendo?" ou "qual é a sua queixa?". Se o paciente não respondeu explicitamente, use a primeira mensagem substancial do paciente que menciona sintomas ou necessidades (ex: "estou com uma cárie no dente de trás", "quero fazer limpeza de pele porque tenho muitas espinhas").'),
    }),
    func: async ({ doutorId, servicoId, dataHora, relatoPaciente }) => {
      try {
        console.log(`[MarcarAgendamentoTool] Iniciando agendamento - doutorId: ${doutorId}, servicoId: ${servicoId}, dataHora: ${dataHora}, clinicaId: ${clinicaId}, telefone: ${telefonePaciente}`);

        // Valida se a data/hora é futura
        const dataHoraObj = new Date(dataHora);
        if (isNaN(dataHoraObj.getTime())) {
          console.error(`[MarcarAgendamentoTool] Data/hora inválida: ${dataHora}`);
          return 'Data/hora inválida. Use o formato ISO (ex: 2025-11-20T10:30:00).';
        }

        const agora = new Date();
        if (dataHoraObj <= agora) {
          const hojeFormatado = agora.toLocaleDateString('pt-BR');
          console.warn(`[MarcarAgendamentoTool] Data/hora passada: ${dataHora}`);
          return `A data/hora informada já passou. Só podemos agendar a partir de agora. Por favor, informe uma data/hora futura.`;
        }

        // Passo 1: Garantir que o paciente existe no sistema
        console.log(`[MarcarAgendamentoTool] Buscando/criando paciente para telefone: ${telefonePaciente}`);
        const paciente = await pacienteService.getOrCreateByTelefone(telefonePaciente, clinicaId);
        console.log(`[MarcarAgendamentoTool] Paciente encontrado/criado - ID: ${paciente.id}, Nome: ${paciente.nome}`);

        // Passo 2: Gerar entendimento da IA se houver relato do paciente
        let entendimentoIA: string | undefined = undefined;
        if (relatoPaciente && relatoPaciente.trim().length > 0) {
          console.log(`[MarcarAgendamentoTool] Gerando entendimento da IA para o relato do paciente...`);
          entendimentoIA = await gerarEntendimentoIA(relatoPaciente);
        }

        // Passo 3: Chamar o novo método de serviço
        console.log(`[MarcarAgendamentoTool] Criando agendamento no banco de dados...`);
        const novoAgendamento = await agendamentoService.createParaIA({
          dataHora: dataHoraObj.toISOString(),
          pacienteId: paciente.id,
          doutorId,
          servicoId,
          clinicaId,
          status: 'pendente_ia', // Define o status
          relatoPaciente: relatoPaciente || undefined, // Salva o relato do paciente
          entendimentoIA: entendimentoIA, // Salva o entendimento da IA
        });

        console.log(`[MarcarAgendamentoTool] ✅ Agendamento criado com sucesso - ID: ${novoAgendamento.id}`);

        // Confirmação para o paciente
        const dataFormatada = new Date(novoAgendamento.dataHora).toLocaleString('pt-BR');
        return `Agendamento marcado com sucesso para ${paciente.nome} no dia ${dataFormatada} (Status: ${novoAgendamento.status}).`;
      } catch (error: any) {
        console.error('[MarcarAgendamentoTool] ❌ ERRO ao marcar agendamento:', error);
        console.error('[MarcarAgendamentoTool] Stack trace:', error.stack);
        // Resposta útil para a IA
        if (error.message && error.message.includes('Doutor, Paciente ou Serviço')) {
          return 'Erro: O Doutor, Paciente ou Serviço não foi encontrado para esta clínica.';
        }
        return `Erro ao marcar agendamento. Detalhe: ${error.message || 'Erro desconhecido'}`;
      }
    },
  });
}

/**
 * Cria a ferramenta para atualizar o nome do paciente.
 * @param clinicaId O ID da clínica específica.
 * @param telefonePaciente O número do WhatsApp do paciente.
 */
export function createAtualizarNomePacienteTool(clinicaId: number, telefonePaciente: string) {
  return new DynamicStructuredTool({
    name: 'atualizar_nome_paciente',
    description:
      'CRÍTICO: Use esta ferramenta IMEDIATAMENTE quando o paciente informar seu nome completo. Se o paciente disser "meu nome é X", "eu sou X", "chamo-me X", "sou o X", ou qualquer variação onde ele menciona seu nome, você DEVE chamar esta ferramenta para salvar o nome no sistema. NÃO apenas confirme verbalmente - SEMPRE chame esta ferramenta para atualizar o cadastro. O nome deve ser o nome completo informado pelo paciente.',
    schema: z.object({
      nome: z.string().describe('O nome completo do paciente conforme informado por ele (ex: "Guilherme Felipe Ramos Cruz")'),
    }),
    func: async ({ nome }) => {
      try {
        console.log(`[AtualizarNomePacienteTool] Atualizando nome do paciente - telefone: ${telefonePaciente}, nome recebido: "${nome}"`);
        
        // Reutiliza a lógica para encontrar o paciente
        const paciente = await pacienteService.getOrCreateByTelefone(telefonePaciente, clinicaId);
        console.log(`[AtualizarNomePacienteTool] Paciente encontrado - ID: ${paciente.id}, nome atual: "${paciente.nome}"`);

        // Chama o serviço de atualização
        await pacienteService.update(paciente.id, { nome: nome }, clinicaId);
        console.log(`[AtualizarNomePacienteTool] ✅ Nome atualizado com sucesso para "${nome}"`);

        return `O nome do paciente foi atualizado para ${nome} com sucesso.`;
      } catch (error: any) {
        console.error('[AtualizarNomePacienteTool] ❌ ERRO ao atualizar nome do paciente:', error);
        return `Erro ao atualizar o nome do paciente: ${error.message || 'Erro desconhecido'}`;
      }
    },
  });
}

/**
 * Cria a ferramenta para o paciente listar seus agendamentos futuros.
 * @param clinicaId O ID da clínica específica.
 * @param telefonePaciente O número do WhatsApp do paciente.
 */
export function createListarMeusAgendamentosTool(clinicaId: number, telefonePaciente: string) {
  return new DynamicStructuredTool({
    name: 'listar_meus_agendamentos',
    description:
      'Útil para quando o paciente perguntar sobre seus agendamentos futuros ou "minhas consultas". Retorna uma lista das próximas consultas marcadas para este paciente.',
    schema: z.object({}),
    func: async () => {
      try {
        // Encontra o paciente pelo telefone
        const paciente = await pacienteService.getByTelefone(telefonePaciente, clinicaId);

        if (!paciente) {
          return 'Não encontrei nenhum cadastro para o seu número de telefone nesta clínica. Você já é nosso paciente?';
        }

        // Chama o novo método de serviço
        const agendamentos = await agendamentoService.getFuturosByPacienteId(paciente.id);

        if (agendamentos.length === 0) {
          return `Você não possui nenhum agendamento futuro connosco, ${paciente.nome}.`;
        }

        const listaFormatada = agendamentos
          .map((ag) => {
            const data = new Date(ag.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            return `- ${ag.servico.nome} com ${ag.doutor.nome} no dia ${data} (Status: ${ag.status})`;
          })
          .join('\n');

        return `Encontrei os seguintes agendamentos futuros para você, ${paciente.nome}:\n${listaFormatada}`;
      } catch (error: any) {
        console.error('Erro em ListarMeusAgendamentosTool:', error);
        return `Erro ao consultar seus agendamentos.`;
      }
    },
  });
}

/**
 * Cria a ferramenta para transferir o chat para um humano.
 * @param pacienteId O ID do paciente que será atualizado.
 */
export function createHandoffTool(pacienteId: number) {
  return new DynamicStructuredTool({
    name: 'solicitar_atendimento_humano',
    description:
      'CRÍTICO: Use esta ferramenta IMEDIATAMENTE se detectar urgência médica (dor forte, sangramento, emergência, acidente, febre alta, dificuldade para respirar, desmaio, convulsão, etc.) ou se o paciente pedir explicitamente para falar com um humano, atendente ou doutor. NUNCA tente agendar urgências - transfira imediatamente para o doutor.',
    schema: z.object({
      motivo: z.string().describe('O motivo pelo qual o paciente pediu para falar com um humano (opcional).').optional(),
    }),
    func: async ({ motivo }) => {
      try {
        await prisma.paciente.update({
          where: { id: pacienteId },
          data: { chatStatus: 'HANDOFF' },
        });

        console.log(
          `[IA HANDOFF] Paciente ${pacienteId} transferido para atendimento humano.${
            motivo ? ` Motivo: ${motivo}` : ''
          }`,
        );

        return 'Por favor, aguarde um momento. Um de nossos atendentes humanos irá continuar a conversa consigo em breve.';
      } catch (error: any) {
        console.error('Erro em createHandoffTool:', error);
        return 'Erro ao tentar transferir o atendimento.';
      }
    },
  });
}

/**
 * Cria a ferramenta para o paciente cancelar um agendamento.
 * @param clinicaId O ID da clínica específica.
 * @param telefonePaciente O número do WhatsApp do paciente.
 */
export function createCancelarAgendamentoTool(clinicaId: number, telefonePaciente: string) {
  return new DynamicStructuredTool({
    name: 'cancelar_agendamento',
    description:
      'CRÍTICO: Use esta ferramenta para cancelar um agendamento existente. Você NUNCA deve pedir o ID do agendamento ao paciente. Em vez disso, identifique automaticamente o agendamento usando a data, horário e nome do serviço que o paciente mencionou. Se o paciente disse "cancelar meu agendamento às 16h", você DEVE usar dataHora (formato ISO: AAAA-MM-DDTHH:MM:00) e nomeServico (ex: "limpeza", "botox", "análise de dor no dente"). A ferramenta identificará automaticamente qual agendamento cancelar. Se houver múltiplos agendamentos no mesmo horário, liste-os primeiro usando "listar_meus_agendamentos" e depois pergunte qual serviço o paciente quer cancelar (ex: "limpeza" ou "botox").',
    schema: z.object({
      dataHora: z.string().describe('A data e hora do agendamento no formato ISO (ex: 2025-11-14T16:00:00). Se o paciente disse "às 16h hoje", use a data de hoje com o horário 16:00:00. Se disse "às 16h amanhã", use a data de amanhã com 16:00:00.'),
      nomeServico: z.string().describe('O nome do serviço mencionado pelo paciente (ex: "limpeza", "botox", "análise de dor no dente", "clareamento"). Use o nome exato ou similar que o paciente mencionou.'),
      agendamentoId: z.number().optional().describe('O ID do agendamento (opcional). Se você tiver o ID, pode usá-lo diretamente. Caso contrário, deixe vazio e use dataHora + nomeServico para identificar automaticamente.'),
    }),
    func: async ({ dataHora, nomeServico, agendamentoId }) => {
      try {
        console.log(`[CancelarAgendamentoTool] Tentando cancelar agendamento - dataHora: ${dataHora}, nomeServico: ${nomeServico}, agendamentoId: ${agendamentoId || 'não fornecido'}`);
        
        const paciente = await pacienteService.getByTelefone(telefonePaciente, clinicaId);

        if (!paciente) {
          return 'Não encontrei nenhum cadastro para o seu número de telefone.';
        }

        let agendamentoParaCancelar;

        // Se temos ID, usar diretamente
        if (agendamentoId) {
          console.log(`[CancelarAgendamentoTool] Usando agendamentoId fornecido: ${agendamentoId}`);
          const agendamento = await prisma.agendamento.findFirst({
            where: {
              id: agendamentoId,
              pacienteId: paciente.id,
            },
            include: { servico: true, doutor: true },
          });

          if (!agendamento) {
            throw new Error("Agendamento não encontrado ou não pertence a este paciente.");
          }

          agendamentoParaCancelar = agendamento;
        } else {
          // Tentar buscar por data, horário e nome do serviço
          console.log(`[CancelarAgendamentoTool] Buscando agendamento por detalhes - dataHora: ${dataHora}, nomeServico: ${nomeServico}`);
          try {
            agendamentoParaCancelar = await agendamentoService.buscarAgendamentoPorDetalhes(
              paciente.id,
              dataHora,
              nomeServico,
              clinicaId
            );
          } catch (error: any) {
            console.error(`[CancelarAgendamentoTool] Erro ao buscar agendamento: ${error.message}`);
            // Se não encontrou, sugerir listar agendamentos
            return `Não encontrei um agendamento de ${nomeServico} para o horário informado. Use a ferramenta 'listar_meus_agendamentos' para ver todos os agendamentos disponíveis e depois tente cancelar novamente com as informações corretas.`;
          }
        }

        if (!agendamentoParaCancelar) {
          return 'Não encontrei o agendamento para cancelar. Verifique a data, horário e serviço informados.';
        }

        if (agendamentoParaCancelar.status === 'cancelado' || agendamentoParaCancelar.status === 'finalizado') {
          return `Este agendamento já está ${agendamentoParaCancelar.status === 'cancelado' ? 'cancelado' : 'finalizado'} e não pode ser cancelado.`;
        }

        const cancelado = await agendamentoService.cancelarParaPaciente(
          agendamentoParaCancelar.id,
          paciente.id,
          clinicaId
        );
        
        const dataFormatada = new Date(cancelado.dataHora).toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        console.log(`[CancelarAgendamentoTool] ✅ Agendamento cancelado com sucesso - ID: ${agendamentoParaCancelar.id}, data: ${dataFormatada}`);

        return `Agendamento de ${agendamentoParaCancelar.servico.nome} do dia ${dataFormatada} foi cancelado com sucesso.`;
      } catch (error: any) {
        console.error('[CancelarAgendamentoTool] ❌ ERRO ao cancelar agendamento:', error);
        return `Erro ao cancelar: ${error.message || 'Erro desconhecido'}`;
      }
    },
  });
}

