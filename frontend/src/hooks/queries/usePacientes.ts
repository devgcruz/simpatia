import { useQuery } from '@tanstack/react-query';
import { getPacientes } from '../../services/paciente.service';
import { IPaciente } from '../../types/models';

interface UsePacientesParams {
  doutorId?: number;
  enabled?: boolean;
}

export const usePacientes = ({ doutorId, enabled = true }: UsePacientesParams = {}) => {
  return useQuery<IPaciente[]>({
    queryKey: ['pacientes', doutorId],
    queryFn: () => getPacientes(doutorId),
    enabled,
    // Mantém os dados anteriores enquanto carrega novos (evita flickering)
    placeholderData: (previousData) => previousData,
  });
};

