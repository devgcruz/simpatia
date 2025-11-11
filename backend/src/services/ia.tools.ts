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
        const paciente = await pacienteService.getOrCreateByTelefone(telefonePaciente, clinicaId);

        // Passo 2: Chamar o novo método de serviço
        const novoAgendamento = await agendamentoService.createParaIA({
          dataHora,
          pacienteId: paciente.id,
          doutorId,
          servicoId,
          clinicaId,
          status: 'pendente_ia', // Define o status
        });

        // Confirmação para o paciente
        return `Agendamento marcado com sucesso para ${paciente.nome} no dia ${new Date(
          novoAgendamento.dataHora,
        ).toLocaleString('pt-BR')} (Status: ${novoAgendamento.status}).`;
      } catch (error: any) {
        console.error('Erro em MarcarAgendamentoTool:', error);
        // Resposta útil para a IA
        if (error.message.includes('Doutor, Paciente ou Serviço')) {
          return 'Erro: O Doutor, Paciente ou Serviço não foi encontrado para esta clínica.';
        }
        return `Erro ao marcar agendamento. Detalhe: ${error.message}`;
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
      'Útil para atualizar o nome de um paciente no sistema. Use isto depois de perguntar o nome completo do paciente.',
    schema: z.object({
      nome: z.string().describe('O nome completo do paciente'),
    }),
    func: async ({ nome }) => {
      try {
        // Reutiliza a lógica para encontrar o paciente
        const paciente = await pacienteService.getOrCreateByTelefone(telefonePaciente, clinicaId);

        // Chama o serviço de atualização
        await pacienteService.update(paciente.id, { nome: nome }, clinicaId);

        return `O nome do paciente foi atualizado para ${nome} com sucesso.`;
      } catch (error: any) {
        console.error('Erro em AtualizarNomePacienteTool:', error);
        return `Erro ao atualizar o nome do paciente.`;
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
 * Cria a ferramenta para o paciente cancelar um agendamento.
 * @param clinicaId O ID da clínica específica.
 * @param telefonePaciente O número do WhatsApp do paciente.
 */
export function createCancelarAgendamentoTool(clinicaId: number, telefonePaciente: string) {
  return new DynamicStructuredTool({
    name: 'cancelar_agendamento',
    description:
      'Útil para cancelar um agendamento existente. Esta ferramenta precisa do ID (número) do agendamento. Se o paciente não fornecer o ID, use a ferramenta "listar_meus_agendamentos" primeiro para que ele possa identificar qual agendamento deseja cancelar.',
    schema: z.object({
      agendamentoId: z.number().describe('O ID do agendamento a ser cancelado'),
    }),
    func: async ({ agendamentoId }) => {
      try {
        const paciente = await pacienteService.getByTelefone(telefonePaciente, clinicaId);

        if (!paciente) {
          return 'Não encontrei nenhum cadastro para o seu número de telefone.';
        }

        const cancelado = await agendamentoService.cancelarParaPaciente(agendamentoId, paciente.id, clinicaId);
        const data = new Date(cancelado.dataHora).toLocaleString('pt-BR');

        return `Agendamento (ID: ${agendamentoId}) do dia ${data} foi cancelado com sucesso.`;
      } catch (error: any) {
        console.error('Erro em CancelarAgendamentoTool:', error);
        return `Erro ao cancelar: ${error.message}`;
      }
    },
  });
}

