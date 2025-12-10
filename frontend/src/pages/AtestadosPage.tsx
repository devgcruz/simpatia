import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  Grid,
  Autocomplete,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PersonIcon from '@mui/icons-material/Person';
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { IPaciente } from '../types/models';
import { IAtestado } from '../types/atestado';
import {
  getAtestados,
  createAtestado,
  updateAtestado,
  deleteAtestado,
  getAtestadoByProtocolo,
  AtestadoFilters,
} from '../services/atestado.service';
import { getPacientes } from '../services/paciente.service';
import { AtestadoFormModal } from '../components/atestados/AtestadoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { pdf } from '@react-pdf/renderer';
import AtestadoPdfView from '../components/AtestadoPdfView';
import { getDoutorById } from '../services/doutor.service';
import moment from 'moment';

export const AtestadosPage: React.FC = () => {
  const { user } = useAuth();
  const [atestados, setAtestados] = useState<IAtestado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPaciente, setSearchPaciente] = useState('');
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<IPaciente | null>(null);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAtestado, setEditingAtestado] = useState<IAtestado | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  // Carregar pacientes para o autocomplete
  useEffect(() => {
    const loadPacientes = async () => {
      try {
        const data = await getPacientes();
        setPacientes(data);
      } catch (err) {
        console.error('Erro ao carregar pacientes:', err);
      }
    };
    loadPacientes();
  }, []);

  const fetchAtestados = async (page: number = 0, pageSize: number = 10) => {
    try {
      setLoading(true);
      const filters: AtestadoFilters = {
        skip: page * pageSize,
        take: pageSize,
      };

      // Se for DOUTOR, filtrar apenas seus atestados
      if (user?.role === 'DOUTOR' && user.id) {
        filters.doutorId = user.id;
      }

      // Filtrar atestados avulsos (sem agendamento)
      filters.agendamentoId = null;

      // Filtrar por paciente se selecionado
      if (pacienteSelecionado) {
        filters.pacienteId = pacienteSelecionado.id;
      }

      const data = await getAtestados(filters);
      setAtestados(data.atestados);
      setTotal(data.total);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao buscar atestados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAtestados(paginationModel.page, paginationModel.pageSize);
  }, [paginationModel.page, paginationModel.pageSize, pacienteSelecionado, user]);

  const handleOpenModal = (atestado?: IAtestado) => {
    if (atestado) {
      setEditingAtestado(atestado);
    } else {
      setEditingAtestado(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAtestado(null);
  };

  const handleSubmitForm = async (data: {
    diasAfastamento: number;
    cid?: string;
    exibirCid: boolean;
    conteudo: string;
    localAtendimento?: string;
    dataAtestado?: string;
    pacienteId: number;
  }) => {
    try {
      if (!user?.id) {
        toast.error('Usuário não autenticado');
        return;
      }

      if (editingAtestado) {
        await updateAtestado(editingAtestado.id, {
          diasAfastamento: data.diasAfastamento,
          cid: data.cid,
          exibirCid: data.exibirCid,
          conteudo: data.conteudo,
          localAtendimento: data.localAtendimento,
          dataAtestado: data.dataAtestado,
        });
        toast.success('Atestado atualizado com sucesso!');
      } else {
        await createAtestado({
          diasAfastamento: data.diasAfastamento,
          cid: data.cid,
          exibirCid: data.exibirCid,
          conteudo: data.conteudo,
          localAtendimento: data.localAtendimento || 'Consultório',
          dataAtestado: data.dataAtestado ? new Date(data.dataAtestado).toISOString() : undefined,
          pacienteId: data.pacienteId,
          doutorId: user.id,
          // agendamentoId não é passado, então será null (atestado avulso)
        });
        toast.success('Atestado criado com sucesso!');
      }
      handleCloseModal();
      fetchAtestados(paginationModel.page, paginationModel.pageSize);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar atestado');
    }
  };

  const handleAtestadoCriado = () => {
    // Atualizar lista após criar atestado
    fetchAtestados(paginationModel.page, paginationModel.pageSize);
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;

    try {
      await deleteAtestado(itemToDeleteId);
      toast.success('Atestado deletado com sucesso!');
      setItemToDeleteId(null);
      fetchAtestados(paginationModel.page, paginationModel.pageSize);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao deletar atestado');
    }
  };

  const handleVisualizarAtestado = async (atestadoProtocolo: string) => {
    try {
      // Buscar atestado completo pelo protocolo
      const atestado = await getAtestadoByProtocolo(atestadoProtocolo);
      
      if (!atestado) {
        toast.error('Atestado não encontrado');
        return;
      }

      if (!atestado.paciente) {
        toast.error('Dados do paciente não encontrados');
        return;
      }

      // Carregar dados completos do doutor
      const doutor = await getDoutorById(atestado.doutorId);

      // Obter dados da clínica
      const clinicaNome = doutor.clinica?.nome || 'Clínica';
      const clinicaEndereco = doutor.clinica?.endereco || '';
      const clinicaTelefone = doutor.clinica?.telefone || '';
      const clinicaEmail = doutor.clinica?.email || doutor.email || '';
      const clinicaSite = doutor.clinica?.site || '';

      // Obter hora do atendimento
      const horaAtendimento = atestado.agendamento?.dataHora
        ? moment(atestado.agendamento.dataHora).format('HH:mm')
        : moment(atestado.createdAt).format('HH:mm');

      // Determinar tipo de afastamento: se tem horaInicial e horaFinal, é horas
      const tipoAfastamento = (atestado.horaInicial && atestado.horaFinal) ? 'horas' : (atestado.diasAfastamento < 1 ? 'horas' : 'dias');

      // Usar data do atestado ou data de criação
      const dataAtestadoFormatada = atestado.dataAtestado
        ? moment(atestado.dataAtestado).format('YYYY-MM-DD')
        : moment(atestado.createdAt).format('YYYY-MM-DD');

      // Gerar PDF
      const pdfDoc = (
        <AtestadoPdfView
          pacienteNome={atestado.paciente.nome || ''}
          pacienteCPF={atestado.paciente.cpf || undefined}
          dataAtendimento={dataAtestadoFormatada}
          horaAtendimento={horaAtendimento}
          diasAfastamento={atestado.diasAfastamento}
          tipoAfastamento={tipoAfastamento}
          horaInicial={atestado.horaInicial || undefined}
          horaFinal={atestado.horaFinal || undefined}
          cid={atestado.cid || undefined}
          exibirCid={atestado.exibirCid}
          conteudo={atestado.conteudo || ''}
          localAtendimento={atestado.localAtendimento || 'Consultório'}
          doutorNome={doutor.nome || ''}
          doutorEspecialidade={doutor.especialidade || ''}
          doutorCRM={doutor.crm}
          doutorCRMUF={doutor.crmUf}
          doutorRQE={doutor.rqe}
          clinicaNome={clinicaNome}
          clinicaEndereco={clinicaEndereco}
          clinicaTelefone={clinicaTelefone}
          clinicaEmail={clinicaEmail}
          clinicaSite={clinicaSite}
        />
      );

      // Gerar blob do PDF e abrir para visualização/impressão
      pdf(pdfDoc).toBlob().then((blob) => {
        if (blob.size === 0) {
          toast.error('Erro: PDF gerado está vazio');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              toast.success('Atestado carregado com sucesso!');
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 250);
          };
          
          printWindow.onerror = () => {
            toast.error('Erro ao abrir janela de visualização');
          };
        } else {
          toast.error('Não foi possível abrir a janela de visualização. Verifique se o pop-up está bloqueado.');
        }
      }).catch((error) => {
        console.error('Erro ao gerar PDF:', error);
        toast.error(`Erro ao gerar atestado: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao visualizar atestado:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao visualizar atestado'}`);
    }
  };

  const columns: GridColDef<IAtestado>[] = [
    {
      field: 'paciente',
      headerName: 'Paciente',
      flex: 1,
      minWidth: 200,
      valueGetter: (value, row) => row.paciente?.nome || 'N/A',
    },
    {
      field: 'doutor',
      headerName: 'Médico',
      flex: 1,
      minWidth: 200,
      valueGetter: (value, row) => row.doutor?.nome || 'N/A',
    },
    {
      field: 'diasAfastamento',
      headerName: 'Afastamento',
      flex: 1,
      minWidth: 120,
      valueFormatter: (value) => {
        if (!value) return '';
        const dias = Number(value);
        if (dias < 1) {
          return `${Math.floor(dias * 24)} horas`;
        }
        return `${Math.floor(dias)} dias`;
      },
    },
    {
      field: 'cid',
      headerName: 'CID',
      flex: 1,
      minWidth: 100,
      valueGetter: (value, row) => {
        if (row.exibirCid && row.cid) {
          return row.cid;
        }
        return row.cid ? 'Sob sigilo' : '-';
      },
    },
    {
      field: 'localAtendimento',
      headerName: 'Local',
      flex: 1,
      minWidth: 150,
      valueGetter: (value) => value || 'Consultório',
    },
    {
      field: 'createdAt',
      headerName: 'Data de Criação',
      flex: 1,
      minWidth: 150,
      valueFormatter: (value) => {
        if (!value) return '';
        return moment(value).format('DD/MM/YYYY HH:mm');
      },
    },
    {
      field: 'protocolo',
      headerName: 'Protocolo',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          key="view"
          icon={<VisibilityIcon />}
          label="Visualizar"
          onClick={() => handleVisualizarAtestado(params.row.protocolo)}
        />,
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Editar"
          onClick={() => handleOpenModal(params.row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Deletar"
          onClick={() => handleDelete(params.row.id)}
        />,
      ],
    },
  ];

  if (loading && atestados.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              options={pacientes}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.nome)}
              value={pacienteSelecionado}
              onChange={(_, newValue) => {
                if (newValue && typeof newValue !== 'string') {
                  setPacienteSelecionado(newValue);
                } else {
                  setPacienteSelecionado(null);
                }
                setPaginationModel({ page: 0, pageSize: paginationModel.pageSize });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Filtrar por paciente"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <PersonIcon fontSize="small" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          {pacienteSelecionado && (
            <Button
              variant="outlined"
              onClick={() => {
                setPacienteSelecionado(null);
                setPaginationModel({ page: 0, pageSize: paginationModel.pageSize });
              }}
            >
              Limpar Filtro
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => handleOpenModal()}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Novo Atestado
          </Button>
        </Box>
      </Box>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DataGrid
          rows={atestados}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={total}
          loading={loading}
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          slots={{
            toolbar: GridToolbar,
          }}
          sx={{
            flex: 1,
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            },
          }}
        />
      </Paper>

      <AtestadoFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        atestado={editingAtestado}
        pacientes={pacientes}
        onAtestadoCriado={handleAtestadoCriado}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar exclusão"
        message="Tem certeza que deseja deletar este atestado? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};

