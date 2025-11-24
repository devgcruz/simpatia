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
import { IPrescricao, IPaciente } from '../types/models';
import {
  getPrescricoes,
  createPrescricao,
  updatePrescricao,
  deletePrescricao,
  getPrescricaoByProtocolo,
  PrescricaoFilters,
} from '../services/prescricao.service';
import { getPacientes } from '../services/paciente.service';
import { PrescricaoFormModal } from '../components/prescricoes/PrescricaoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../components/PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../types/prescricao';
import moment from 'moment';

export const PrescricoesPage: React.FC = () => {
  const { user } = useAuth();
  const [prescricoes, setPrescricoes] = useState<IPrescricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPaciente, setSearchPaciente] = useState('');
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<IPaciente | null>(null);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrescricao, setEditingPrescricao] = useState<IPrescricao | null>(null);
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

  const fetchPrescricoes = async (page: number = 0, pageSize: number = 10) => {
    try {
      setLoading(true);
      const filters: PrescricaoFilters = {
        skip: page * pageSize,
        take: pageSize,
      };

      // Se for DOUTOR, filtrar apenas suas prescrições
      if (user?.role === 'DOUTOR' && user.id) {
        filters.doutorId = user.id;
      }

      // Filtrar prescrições avulsas (sem agendamento)
      filters.agendamentoId = null;

      // Filtrar por paciente se selecionado
      if (pacienteSelecionado) {
        filters.pacienteId = pacienteSelecionado.id;
      }

      const data = await getPrescricoes(filters);
      setPrescricoes(data.prescricoes);
      setTotal(data.total);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao buscar prescrições');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescricoes(paginationModel.page, paginationModel.pageSize);
  }, [paginationModel.page, paginationModel.pageSize, pacienteSelecionado, user]);

  const handleOpenModal = (prescricao?: IPrescricao) => {
    if (prescricao) {
      setEditingPrescricao(prescricao);
    } else {
      setEditingPrescricao(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPrescricao(null);
  };

  const handleSubmitForm = async (data: { conteudo: string; pacienteId: number }) => {
    try {
      if (!user?.id) {
        toast.error('Usuário não autenticado');
        return;
      }

      if (editingPrescricao) {
        await updatePrescricao(editingPrescricao.id, { conteudo: data.conteudo });
        toast.success('Prescrição atualizada com sucesso!');
      } else {
        await createPrescricao({
          conteudo: data.conteudo,
          pacienteId: data.pacienteId,
          doutorId: user.id,
          // agendamentoId não é passado, então será null (prescrição avulsa)
        });
        toast.success('Prescrição criada com sucesso!');
      }
      handleCloseModal();
      fetchPrescricoes(paginationModel.page, paginationModel.pageSize);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar prescrição');
    }
  };

  const handlePrescricaoCriada = () => {
    // Atualizar lista após criar prescrição
    fetchPrescricoes(paginationModel.page, paginationModel.pageSize);
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;

    try {
      await deletePrescricao(itemToDeleteId);
      toast.success('Prescrição deletada com sucesso!');
      setItemToDeleteId(null);
      fetchPrescricoes(paginationModel.page, paginationModel.pageSize);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao deletar prescrição');
    }
  };

  const handleVisualizarPrescricao = async (prescricaoProtocolo: string) => {
    try {
      // Buscar prescrição completa pelo protocolo
      const prescricao = await getPrescricaoByProtocolo(prescricaoProtocolo);
      
      if (!prescricao) {
        toast.error('Prescrição não encontrada');
        return;
      }

      if (!prescricao.paciente) {
        toast.error('Dados do paciente não encontrados');
        return;
      }

      // Carregar modelo do doutor ou usar padrão
      let modeloPrescricao: IModeloPrescricaoPDF = modeloPrescricaoPadrao;
      let logoURL = '';
      
      const modeloStr = prescricao.doutor.modeloPrescricao || '';
      if (modeloStr) {
        try {
          const modeloCarregado = JSON.parse(modeloStr) as IModeloPrescricaoPDF;
          modeloPrescricao = {
            ...modeloPrescricaoPadrao,
            ...modeloCarregado,
            logoWatermark: {
              ...modeloPrescricaoPadrao.logoWatermark,
              ...(modeloCarregado.logoWatermark || {}),
            },
            header: {
              ...modeloPrescricaoPadrao.header,
              ...(modeloCarregado.header || {}),
            },
            medicoInfo: {
              ...modeloPrescricaoPadrao.medicoInfo,
              ...(modeloCarregado.medicoInfo || {}),
            },
            pacienteInfo: {
              ...modeloPrescricaoPadrao.pacienteInfo,
              ...(modeloCarregado.pacienteInfo || {}),
              showCPF: true,
              showEndereco: true,
            },
            prescricao: {
              ...modeloPrescricaoPadrao.prescricao,
              ...(modeloCarregado.prescricao || {}),
            },
            assinatura: {
              ...modeloPrescricaoPadrao.assinatura,
              ...(modeloCarregado.assinatura || {}),
            },
            footer: {
              ...modeloPrescricaoPadrao.footer,
              ...(modeloCarregado.footer || {}),
            },
          };
          logoURL = modeloPrescricao.logoUrl || '';
        } catch (error) {
          console.warn('Modelo de prescrição não é JSON válido, usando padrão:', error);
          modeloPrescricao = modeloPrescricaoPadrao;
          logoURL = '';
        }
      }
      
      // Montar endereço do paciente
      const enderecoPaciente = [
        prescricao.paciente.logradouro,
        prescricao.paciente.numero,
        prescricao.paciente.bairro,
        prescricao.paciente.cidade,
        prescricao.paciente.estado
      ].filter(Boolean).join(', ') || '';
      
      // Separar texto da prescrição em linhas
      const itensPrescricao = prescricao.conteudo.split('\n').filter(line => line.trim());
      
      // Obter dados da clínica
      const clinicaNome = prescricao.doutor.clinica?.nome || 'Clínica';
      const clinicaEndereco = prescricao.doutor.clinica?.endereco || '';
      const clinicaTelefone = prescricao.doutor.clinica?.telefone || '';
      const clinicaEmail = prescricao.doutor.clinica?.email || '';
      const clinicaSite = prescricao.doutor.clinica?.site || '';
      const clinicaCNPJ = prescricao.doutor.clinica?.cnpj;

      // Gerar PDF
      const pdfDoc = (
        <PrescricaoPdfView
          pacienteNome={prescricao.paciente.nome || ''}
          pacienteEndereco={enderecoPaciente}
          pacienteCPF={prescricao.paciente.cpf || undefined}
          data={moment(prescricao.createdAt).format('YYYY-MM-DD')}
          seguroSaude={prescricao.paciente.convenio || ''}
          diagnostico=""
          doutorNome={prescricao.doutor.nome || ''}
          doutorEspecialidade={prescricao.doutor.especialidade || ''}
          doutorTagline={modeloPrescricao.medicoInfo.tagline || ''}
          doutorCRM={prescricao.doutor.crm}
          doutorCRMUF={prescricao.doutor.crmUf}
          doutorRQE={prescricao.doutor.rqe}
          itensPrescricao={itensPrescricao}
          clinicaNome={clinicaNome}
          clinicaEndereco={clinicaEndereco}
          clinicaTelefone={clinicaTelefone}
          clinicaEmail={clinicaEmail}
          clinicaSite={clinicaSite}
          clinicaCNPJ={clinicaCNPJ}
          clinicaLogoUrl={logoURL}
          modelo={modeloPrescricao}
          isControleEspecial={false}
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
              toast.success('Prescrição carregada com sucesso!');
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
        toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao visualizar prescrição:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao visualizar prescrição'}`);
    }
  };

  const columns: GridColDef<IPrescricao>[] = [
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
      field: 'conteudo',
      headerName: 'Conteúdo',
      flex: 2,
      minWidth: 300,
      valueGetter: (value) => {
        if (typeof value === 'string') {
          return value.length > 100 ? value.substring(0, 100) + '...' : value;
        }
        return '';
      },
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
          onClick={() => handleVisualizarPrescricao(params.row.protocolo)}
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

  if (loading && prescricoes.length === 0) {
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
            Nova Prescrição
          </Button>
        </Box>
      </Box>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DataGrid
          rows={prescricoes}
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

      <PrescricaoFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        prescricao={editingPrescricao}
        pacientes={pacientes}
        onPrescricaoCriada={handlePrescricaoCriada}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar exclusão"
        message="Tem certeza que deseja deletar esta prescrição? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};

