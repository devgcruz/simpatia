import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import servicosService from './servicos.service';
import disponibilidadeService from './disponibilidade.service';
import pacienteService from './pacientes.service';
import agendamentoService from './agendamento.service';
import { prisma } from '../lib/prisma'; // Usaremos o prisma para uma verificação rápida

// Função auxiliar para formatar R$ 100.5 para "R$ 100,50"
function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

/**
 * Encontra um paciente pelo telefone. Se não existir, cria um novo.
 * Esta função é crucial para a IA saber quem está a pedir o agendamento.
 */
async function getOrCreatePaciente(telefone: string, clinicaId: number) {
  // Tenta encontrar o paciente
  let paciente = await pacienteService.getByTelefone(telefone, clinicaId);
  if (paciente) {
    return paciente;
  }

  // Se não existir, cria um paciente novo com um nome placeholder
  // A IA pode (e deve) perguntar o nome do paciente depois para atualizar o cadastro.
  return pacienteService.create(
    {
      nome: `Paciente ${telefone.slice(-4)}`, // ex: "Paciente 9999"
      telefone: telefone,
    },
    clinicaId,
  );
}

// --- Funções Factory para as Ferramentas ---

/**
 * Cria a ferramenta para listar os serviços da clínica.
 * @param clinicaId O ID da clínica específica.
 */
export function createListarServicosTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'listar_servicos_clinica',
    description:
      'Útil para quando o paciente perguntar quais serviços ou tratamentos a clínica oferece. Retorna uma lista de nomes de serviços, seus preços e duração.',
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
export function createVerificarDisponibilidadeTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'verificar_disponibilidade_horarios',
    description:
      'Verifica os horários disponíveis para um doutor específico, em uma data específica, para um serviço específico. Sempre pergunte ao usuário a data desejada (AAAA-MM-DD) antes de usar.',
    schema: z.object({
      doutorId: z.number().describe('O ID do doutor'),
      servicoId: z.number().describe('O ID do serviço'),
      data: z.string().describe('A data para verificar, no formato AAAA-MM-DD'),
    }),
    func: async ({ doutorId, servicoId, data }) => {
      try {
        // Chama o serviço real que já criámos
        const horarios = await disponibilidadeService.getDisponibilidadeParaIA(
          clinicaId,
          doutorId,
          servicoId,
          data,
        );
        if (horarios.length === 0) {
          return `Não encontrei horários disponíveis para ${data} com esses critérios. Sugira ao paciente tentar outra data.`;
        }
        return `Os horários disponíveis para ${data} são: ${horarios.join(', ')}.`;
      } catch (error: any) {
        console.error('Erro em VerificarDisponibilidadeTool:', error);
        // Tenta dar uma resposta mais útil para a IA
        if (error.message.includes('Serviço ou Doutor não encontrado')) {
          return 'O ID do Doutor ou do Serviço parece estar incorreto. Verifique os IDs e tente novamente.';
        }
        return `Erro ao verificar disponibilidade.`;
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
      'Agenda uma nova consulta. Use esta ferramenta somente após ter confirmado o serviço, o doutor, a data e o horário com o paciente.',
    schema: z.object({
      doutorId: z.number().describe('O ID do doutor'),
      servicoId: z.number().describe('O ID do serviço'),
      dataHora: z.string().describe('A data e hora exata do agendamento, no formato ISO (ex: 2025-11-20T10:30:00)'),
    }),
    func: async ({ doutorId, servicoId, dataHora }) => {
      try {
        // Passo 1: Garantir que o paciente existe no sistema
        const paciente = await getOrCreatePaciente(telefonePaciente, clinicaId);

        // --- PENDENTE PASSO 3 ---
        // O `agendamentoService.create` atual espera um objeto `user` (com `role`, `id`, `clinicaId`).
        // A IA não tem um `user` autenticado. Ela age "em nome" do paciente.
        // Precisamos de um método novo no `agendamento.service.ts`
        // que possa ser chamado pela IA, recebendo apenas os dados necessários.

        // Por enquanto, vamos simular a criação:
        console.log(`[IA SIMULAÇÃO] Tentando agendar para:
          PacienteID: ${paciente.id} (Telefone: ${telefonePaciente})
          ClinicaID: ${clinicaId}
          DoutorID: ${doutorId}
          ServicoID: ${servicoId}
          DataHora: ${dataHora}
        `);

        // const novoAgendamento = await agendamentoService.createParaIA(...)

        // Retorno simulado:
        return `Agendamento pré-reservado com sucesso para ${paciente.nome} no dia ${new Date(
          dataHora,
        ).toLocaleString('pt-BR')}. O status atual é 'pendente_ia'.`;
      } catch (error: any) {
        console.error('Erro em MarcarAgendamentoTool:', error);
        return `Erro ao marcar agendamento. Verifique se o Doutor e o Serviço existem e se a data está no formato correto.`;
      }
    },
  });
}

