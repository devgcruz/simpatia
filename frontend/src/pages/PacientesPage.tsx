import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Button, Paper, CircularProgress, TextField, InputAdornment, Chip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import { DataGrid, GridColDef, GridActionsCellItem, GridToolbar } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { toast } from 'sonner';
import { IPaciente, IDoutor } from '../types/models';
import { getPacientes, createPaciente, updatePaciente, deletePaciente } from '../services/paciente.service';
import { getAgendamentos } from '../services/agendamento.service';
import { PacienteFormModal } from '../components/pacientes/PacienteFormModal';
import { HistoricoPacienteModal } from '../components/pacientes/HistoricoPacienteModal';
import { ProntuarioModal } from '../components/pacientes/ProntuarioModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { IAgendamento } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { useDoutorSelecionado } from '../context/DoutorSelecionadoContext';

export const PacientesPage: React.FC = () => {
  const { user } = useAuth();
  const { doutorSelecionado, isLoading: isLoadingDoutor } = useDoutorSelecionado();
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Verificar se o usuário é SECRETARIA
  const isSecretaria = user?.role === 'SECRETARIA';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<IPaciente | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [pacienteHistorico, setPacienteHistorico] = useState<IPaciente | null>(null);
  const [isProntuarioModalOpen, setIsProntuarioModalOpen] = useState(false);
  const [agendamentoProntuario, setAgendamentoProntuario] = useState<IAgendamento | null>(null);

  const fetchPacientes = useCallback(async () => {
    try {
      setLoading(true);
      // Para SECRETARIA, usar doutor selecionado; para DOUTOR, não passar doutorId (backend filtra automaticamente)
      const doutorId = isSecretaria && doutorSelecionado ? doutorSelecionado.id : undefined;
      const data = await getPacientes(doutorId);
      setPacientes(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar pacientes');
    } finally {
      setLoading(false);
    }
  }, [isSecretaria, doutorSelecionado]);

  useEffect(() => {
    fetchPacientes();
  }, [fetchPacientes]);

  const handleOpenModal = (paciente: IPaciente | null = null) => {
    setEditingPaciente(paciente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPaciente(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: Omit<IPaciente, 'id' | 'clinicaId'>) => {
    try {
      if (editingPaciente) {
        await updatePaciente(editingPaciente.id, data);
        toast.success('Paciente atualizado com sucesso!');
      } else {
        // O modal já preenche o doutorId automaticamente para SECRETARIA
        await createPaciente(data);
        toast.success('Paciente criado com sucesso!');
      }
      await fetchPacientes();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar paciente');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleOpenHistoricoModal = (paciente: IPaciente) => {
    // SECRETARIA não pode acessar histórico
    if (isSecretaria) {
      toast.error('Você não tem permissão para visualizar o histórico do paciente.');
      return;
    }
    setPacienteHistorico(paciente);
    setIsHistoricoModalOpen(true);
  };

  const handleCloseHistoricoModal = () => {
    setPacienteHistorico(null);
    setIsHistoricoModalOpen(false);
  };

  const handleOpenProntuario = async (paciente: IPaciente) => {
    // SECRETARIA não pode acessar prontuário
    if (isSecretaria) {
      toast.error('Você não tem permissão para visualizar o prontuário do paciente.');
      return;
    }
    try {
      // Buscar agendamentos do paciente
      const agendamentos = await getAgendamentos();
      let agendamento: IAgendamento | null = null;

      // Filtrar agendamentos do paciente e pegar o mais recente
      const agendamentosPaciente = agendamentos
        .filter((a) => a.pacienteId === paciente.id)
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

      if (agendamentosPaciente.length > 0) {
        // Usar o último agendamento
        agendamento = agendamentosPaciente[0];
      } else {
        // Criar um agendamento mínimo para o ProntuarioModal funcionar
        agendamento = {
          id: 0,
          dataHora: new Date().toISOString(),
          status: 'finalizado',
          pacienteId: paciente.id,
          doutorId: paciente.doutorId || 0,
          servicoId: 0,
          paciente: paciente,
          doutor: paciente.doutor || null,
          servico: {
            id: 0,
            nome: 'Consulta',
            duracaoMin: 30,
            descricao: '',
            preco: 0,
            clinicaId: paciente.clinicaId,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as IAgendamento;
      }

      setAgendamentoProntuario(agendamento);
      setIsProntuarioModalOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao abrir prontuário');
    }
  };

  const handleCloseProntuario = () => {
    setAgendamentoProntuario(null);
    setIsProntuarioModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;
    
    // SECRETARIA não pode deletar
    if (isSecretaria) {
      toast.error('Você não tem permissão para deletar pacientes.');
      setItemToDeleteId(null);
      return;
    }

    try {
      await deletePaciente(itemToDeleteId);
      await fetchPacientes();
      setItemToDeleteId(null);
      toast.success('Paciente excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar paciente');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IPaciente>[] = [
    { field: 'nome', headerName: 'Nome', flex: 1 },
    { field: 'telefone', headerName: 'Telefone', width: 200 },
    {
      field: 'doutor',
      headerName: 'Doutor',
      width: 200,
      valueGetter: (_value, row) => {
        return row.doutor?.nome || 'Não vinculado';
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 180,
      getActions: ({ row }) => {
        const actions = [];
        
        // SECRETARIA não pode ver prontuário
        if (!isSecretaria) {
          actions.push(
            <GridActionsCellItem
              key="prontuario"
              icon={<DescriptionIcon />}
              label="Prontuário"
              onClick={() => handleOpenProntuario(row)}
            />
          );
        }
        
        // SECRETARIA não pode ver histórico
        if (!isSecretaria) {
          actions.push(
            <GridActionsCellItem
              key="historico"
              icon={<HistoryIcon />}
              label="Histórico"
              onClick={() => handleOpenHistoricoModal(row)}
            />
          );
        }
        
        // SECRETARIA pode editar
        actions.push(
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Editar"
            onClick={() => handleOpenModal(row)}
          />
        );
        
        // SECRETARIA não pode deletar
        if (!isSecretaria) {
          actions.push(
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Excluir"
              onClick={() => handleDelete(row.id)}
            />
          );
        }
        
        return actions;
      },
    },
  ];

  const filteredPacientes = useMemo(() => {
    // Se for SECRETARIA e não tiver doutor selecionado, não mostrar pacientes
    if (isSecretaria && !doutorSelecionado) {
      return [];
    }
    
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pacientes;
    return pacientes.filter((paciente) => {
      const nome = paciente.nome?.toLowerCase() ?? '';
      const telefone = paciente.telefone?.toLowerCase() ?? '';
      return nome.includes(term) || telefone.includes(term);
    });
  }, [pacientes, searchTerm, isSecretaria, doutorSelecionado]);

  // Se for SECRETARIA e ainda estiver carregando o contexto, mostrar loading
  if (isSecretaria && isLoadingDoutor) {
    return <CircularProgress />;
  }

  // Se for SECRETARIA e não houver doutor selecionado, mostrar mensagem
  if (isSecretaria && !doutorSelecionado) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Selecione um doutor no menu lateral para visualizar os pacientes.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <TextField
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Pesquisar paciente"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: { xs: '100%', md: 260 },
            flex: { xs: '0 1 auto', md: 1 },
          }}
          disabled={isSecretaria && !doutorSelecionado}
        />
        <Button
          variant="contained"
          onClick={() => handleOpenModal()}
          disabled={isSecretaria && !doutorSelecionado}
          sx={{ alignSelf: { xs: 'stretch', md: 'center' }, whiteSpace: 'nowrap' }}
        >
          Novo Paciente
        </Button>
      </Box>

      <Paper
        sx={{
          flex: 1,
          width: '100%',
          p: 2,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <DataGrid
          rows={filteredPacientes}
          columns={columns}
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          loading={loading}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          pageSizeOptions={[5, 10, 25]}
          slots={{ toolbar: GridToolbar }}
          disableRowSelectionOnClick
          sx={{ border: 0, flex: 1 }}
        />
      </Paper>

      <PacienteFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingPaciente}
        doutorIdForcado={isSecretaria && doutorSelecionado ? doutorSelecionado.id : undefined}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita."
      />


      {!isSecretaria && (
        <HistoricoPacienteModal
          open={isHistoricoModalOpen}
          onClose={handleCloseHistoricoModal}
          paciente={pacienteHistorico}
        />
      )}

      {!isSecretaria && agendamentoProntuario && (
        <ProntuarioModal
          open={isProntuarioModalOpen}
          onClose={handleCloseProntuario}
          agendamento={agendamentoProntuario}
        />
      )}
    </Box>
  );
};

