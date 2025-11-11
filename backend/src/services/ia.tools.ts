import { z } from 'zod';
import { DynamicTool } from '@langchain/core/tools';

// --- Ferramenta 1: Listar Serviços ---
export const listarServicosTool = new DynamicTool({
  name: 'listar_servicos_clinica',
  description:
    'Útil para quando o paciente perguntar quais serviços ou tratamentos a clínica oferece. Retorna uma lista de nomes de serviços e seus preços.',
  schema: z.object({}), // Não precisa de input
  func: async () => {
    // A lógica real será implementada no Passo 2
    return 'Implementação pendente: [Lista de Serviços]';
  },
});

// --- Ferramenta 2: Verificar Disponibilidade ---
export const verificarDisponibilidadeTool = new DynamicTool({
  name: 'verificar_disponibilidade_horarios',
  description:
    'Verifica os horários disponíveis para um doutor específico, em uma data específica, para um serviço específico. Sempre pergunte ao usuário a data desejada antes de usar.',
  schema: z.object({
    doutorId: z.number().describe('O ID do doutor'),
    servicoId: z.number().describe('O ID do serviço'),
    data: z.string().describe('A data para verificar, no formato AAAA-MM-DD'),
  }),
  func: async () => {
    // A lógica real será implementada no Passo 2
    return 'Implementação pendente: [Lista de Horários Disponíveis]';
  },
});

// --- Ferramenta 3: Marcar Agendamento ---
export const marcarAgendamentoTool = new DynamicTool({
  name: 'marcar_agendamento_paciente',
  description:
    'Agenda uma nova consulta. Use esta ferramenta somente após ter confirmado o serviço, o doutor, a data e o horário com o paciente.',
  schema: z.object({
    doutorId: z.number().describe('O ID do doutor'),
    servicoId: z.number().describe('O ID do serviço'),
    dataHora: z.string().describe('A data e hora exata do agendamento, no formato ISO (ex: 2025-11-20T10:30:00)'),
  }),
  func: async () => {
    // A lógica real será implementada no Passo 2
    return 'Implementação pendente: [Confirmação do Agendamento]';
  },
});

