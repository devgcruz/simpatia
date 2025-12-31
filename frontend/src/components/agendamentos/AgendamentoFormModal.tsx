import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Alert,
  FormControlLabel,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoIcon from '@mui/icons-material/Info';
import DescriptionIcon from '@mui/icons-material/Description';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'sonner';
import { AgendamentoCreateInput, confirmarEncaixe } from '../../services/agendamento.service';
import { IDoutor, IPaciente, IServico, IAgendamento, IHistoricoPaciente } from '../../types/models';
import { getDoutores } from '../../services/doutor.service';
import { getPacientes, getPacienteHistoricos, updateHistoricoPaciente } from '../../services/paciente.service';
import { getServicos } from '../../services/servico.service';
import { getPrescricaoByProtocolo } from '../../services/prescricao.service';
import { useAuth } from '../../hooks/useAuth';
import { useDoutorSelecionado } from '../../context/DoutorSelecionadoContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePacientes } from '../../hooks/queries/usePacientes';
import moment from 'moment';
import WarningIcon from '@mui/icons-material/Warning';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AgendamentoCreateInput) => void;
  initialData?: { dataHora: Date } | null;
  agendamento?: IAgendamento | null;
  onRequestDelete?: () => void;
  onRequestIndisponibilidade?: () => void;
  doutorId?: number; // ID do doutor da agenda selecionada para filtrar serviços
}

const initialState = {
  dataHora: '',
  status: 'confirmado',
  pacienteId: '',
  doutorId: '',
  servicoId: '',
  isEncaixe: false,
};

type FormState = typeof initialState;

export const AgendamentoFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  agendamento,
  onRequestDelete,
  onRequestIndisponibilidade,
  doutorId,
}) => {
  const { user } = useAuth();
  const { doutorSelecionado } = useDoutorSelecionado();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [openCancelModal, setOpenCancelModal] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [statusAnterior, setStatusAnterior] = useState<string>('');

  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [servicos, setServicos] = useState<IServico[]>([]);
  
  // Estados para busca de paciente com debounce
  const [buscaPaciente, setBuscaPaciente] = useState<string>('');
  const buscaDebounced = useDebounce(buscaPaciente, 600);
  
  // Hook para buscar pacientes
  const doutorIdParaPacientes = user?.role === 'SECRETARIA' && doutorSelecionado ? doutorSelecionado.id : undefined;
  const { data: pacientesData = [], isLoading: loadingPacientes, isFetching: fetchingPacientes } = usePacientes({
    doutorId: doutorIdParaPacientes,
    enabled: open, // Só busca quando o modal estiver aberto
  });
  
  // Filtrar pacientes baseado na busca debounced (client-side filtering)
  const pacientesFiltrados = useMemo(() => {
    if (!buscaDebounced.trim()) {
      return pacientesData;
    }
    const termo = buscaDebounced.toLowerCase();
    return pacientesData.filter((paciente) => {
      const nome = paciente.nome?.toLowerCase() || '';
      const cpf = paciente.cpf?.toLowerCase() || '';
      const telefone = paciente.telefone?.toLowerCase() || '';
      return nome.includes(termo) || cpf.includes(termo) || telefone.includes(termo);
    });
  }, [pacientesData, buscaDebounced]);
  
  // Encontrar paciente selecionado para o Autocomplete
  const pacienteSelecionado = useMemo(() => {
    if (!form.pacienteId) return null;
    return pacientesData.find((p) => p.id === Number(form.pacienteId)) || null;
  }, [form.pacienteId, pacientesData]);
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [filtroData, setFiltroData] = useState('');
  const [filtroPrescricao, setFiltroPrescricao] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [historicoSelecionado, setHistoricoSelecionado] = useState<IHistoricoPaciente | null>(null);
  const [descricaoEditando, setDescricaoEditando] = useState('');
  const [openHistoricoModal, setOpenHistoricoModal] = useState(false);
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Se doutorId foi passado, buscar apenas serviços desse doutor
        const [doutoresData, servicosData] = await Promise.all([
          getDoutores(),
          getServicos(doutorId),
        ]);
        setDoutores(doutoresData);
        setServicos(servicosData);
      } catch (error) {
        toast.error('Erro ao carregar dados do formulário.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, doutorId]);

  useEffect(() => {
    if (!open) return;

    // Para SECRETARIA, sempre mostrar apenas a aba de dados
    setActiveTab('dados');
    setHistoricoError(null);
    setFiltroData('');
    setFiltroPrescricao('');
    setFiltroDescricao('');
    setHistoricoSelecionado(null);
    setDescricaoEditando('');
    setOpenHistoricoModal(false);
    setOpenCancelModal(false);
    setMotivoCancelamento('');
    setStatusAnterior('');
    setBuscaPaciente(''); // Limpar busca ao abrir/fechar modal

    if (agendamento) {
      setForm({
        dataHora: moment(agendamento.dataHora).format('YYYY-MM-DDTHH:mm'),
        status: agendamento.status,
        pacienteId: String(agendamento.paciente.id),
        doutorId: String(agendamento.doutor.id),
        servicoId: String(agendamento.servico.id),
        isEncaixe: agendamento.isEncaixe || false,
      });
      return;
    }

    if (initialData?.dataHora) {
      setForm({
        ...initialState,
        dataHora: moment(initialData.dataHora).format('YYYY-MM-DDTHH:mm'),
        status: user?.role === 'SECRETARIA' ? 'pendente' : initialState.status,
        doutorId: user?.role === 'DOUTOR' 
          ? String(user.id) 
          : user?.role === 'SECRETARIA' && doutorSelecionado
          ? String(doutorSelecionado.id)
          : '',
      });
    } else {
      setForm({
        ...initialState,
        status: user?.role === 'SECRETARIA' ? 'pendente' : initialState.status,
        doutorId: user?.role === 'DOUTOR' 
          ? String(user.id) 
          : user?.role === 'SECRETARIA' && doutorSelecionado
          ? String(doutorSelecionado.id)
          : '',
      });
    }
  }, [agendamento, initialData, user, open, doutorSelecionado]);

  // Atualizar doutorId quando o doutor selecionado mudar (para SECRETARIA)
  useEffect(() => {
    if (user?.role === 'SECRETARIA' && doutorSelecionado && !agendamento && open) {
      setForm((prev) => ({
        ...prev,
        doutorId: String(doutorSelecionado.id),
      }));
    }
  }, [doutorSelecionado, user?.role, agendamento, open]);

  useEffect(() => {
    if (!open) {
      setHistoricos([]);
      return;
    }

    if (!agendamento) {
      setHistoricos([]);
      return;
    }

    // SECRETARIA não tem permissão para ver histórico
    if (user?.role === 'SECRETARIA') {
      setHistoricos([]);
      return;
    }

    const loadHistoricos = async () => {
      try {
        setHistoricoLoading(true);
        const data = await getPacienteHistoricos(agendamento.paciente.id);
        setHistoricos(data);
      } catch (error) {
        setHistoricoError('Erro ao carregar histórico do paciente.');
      } finally {
        setHistoricoLoading(false);
      }
    };

    loadHistoricos();
  }, [open, agendamento, user?.role]);

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    if (!name) return;
    
    // Se está tentando cancelar, interceptar e mostrar modal
    if (name === 'status' && value === 'cancelado' && form.status !== 'cancelado') {
      // Verificar se é admin
      const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'CLINICA_ADMIN';
      
      // Permitir cancelar agendamentos finalizados (independente de serem passados ou futuros)
      const isFinalizado = agendamento?.status === 'finalizado' || form.status === 'finalizado';
      
      // Verificar se o agendamento está no futuro (exceto para admin ou se estiver finalizado)
      if (agendamento && !isFinalizado) {
        const agora = moment();
        const dataHoraAgendamento = moment(agendamento.dataHora);
        const isFuturo = dataHoraAgendamento.isAfter(agora);
        
        if (!isAdmin && !isFuturo) {
          toast.error('Não é possível cancelar agendamentos retroativos. Apenas administradores podem cancelar agendamentos passados.');
          return;
        }
      } else if (!isAdmin && !isFinalizado && form.dataHora) {
        const agora = moment();
        const dataHoraAgendamento = moment(form.dataHora);
        const isFuturo = dataHoraAgendamento.isAfter(agora);
        
        if (!isFuturo) {
          toast.error('Não é possível cancelar agendamentos retroativos. Apenas administradores podem cancelar agendamentos passados.');
          return;
        }
      }
      
      // Salvar status anterior e abrir modal de cancelamento
      setStatusAnterior(form.status);
      setOpenCancelModal(true);
      return;
    }
    
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (!name) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    if (!name) return;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const extrairPrimeiroMedicamento = (conteudo: string): string => {
    if (!conteudo) return '';
    const linhas = conteudo.split('\n').filter((line) => line.trim());
    if (linhas.length === 0) return '';
    const primeiraLinha = linhas[0].trim();
    return primeiraLinha.length > 30 ? `${primeiraLinha.substring(0, 30)}...` : primeiraLinha;
  };

  const handleAbrirHistoricoModal = (historico: IHistoricoPaciente) => {
    setHistoricoSelecionado(historico);
    setDescricaoEditando(historico.descricao || '');
    setOpenHistoricoModal(true);
  };

  const handleFecharHistoricoModal = () => {
    setHistoricoSelecionado(null);
    setDescricaoEditando('');
    setOpenHistoricoModal(false);
  };

  const handleSalvarHistoricoDescricao = async () => {
    if (!historicoSelecionado || !descricaoEditando.trim()) {
      toast.error('A descrição não pode ficar vazia.');
      return;
    }
    try {
      setSalvandoHistorico(true);
      await updateHistoricoPaciente(historicoSelecionado.id, descricaoEditando.trim());
      setHistoricos((prev) =>
        prev.map((hist) =>
          hist.id === historicoSelecionado.id ? { ...hist, descricao: descricaoEditando.trim() } : hist
        )
      );
      toast.success('Descrição atualizada com sucesso!');
      handleFecharHistoricoModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar descrição.');
    } finally {
      setSalvandoHistorico(false);
    }
  };

  const handleVisualizarPrescricao = async (prescricaoProtocolo: string) => {
    try {
      const prescricao = await getPrescricaoByProtocolo(prescricaoProtocolo);

      if (!prescricao) {
        toast.error('Prescrição não encontrada');
        return;
      }

      if (!prescricao.paciente) {
        toast.error('Dados do paciente não encontrados');
        return;
      }

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
          console.warn('Modelo de prescrição inválido, usando padrão:', error);
          modeloPrescricao = modeloPrescricaoPadrao;
          logoURL = '';
        }
      }

      const enderecoPaciente =
        [
          prescricao.paciente.logradouro,
          prescricao.paciente.numero,
          prescricao.paciente.bairro,
          prescricao.paciente.cidade,
          prescricao.paciente.estado,
        ]
          .filter(Boolean)
          .join(', ') || '';

      const itensPrescricao = prescricao.conteudo.split('\n').filter((line) => line.trim());

      const clinicaNome = prescricao.doutor.clinica?.nome || 'Clínica';
      const clinicaEndereco = prescricao.doutor.clinica?.endereco || '';
      const clinicaTelefone = prescricao.doutor.clinica?.telefone || '';
      const clinicaEmail = prescricao.doutor.clinica?.email || '';
      const clinicaSite = prescricao.doutor.clinica?.site || '';
      const clinicaCNPJ = prescricao.doutor.clinica?.cnpj;

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

      pdf(pdfDoc)
        .toBlob()
        .then((blob) => {
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
              toast.error('Erro ao abrir janela de impressão');
            };
          } else {
            toast.error('Não foi possível abrir a janela de impressão. Verifique se o pop-up está bloqueado.');
          }
        })
        .catch((error) => {
          console.error('Erro ao gerar PDF:', error);
          toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
        });
    } catch (error: any) {
      console.error('Erro ao visualizar prescrição:', error);
      toast.error(error?.message || 'Erro ao visualizar prescrição');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação para SECRETARIA: deve ter doutor selecionado
    if (user?.role === 'SECRETARIA' && !doutorSelecionado) {
      toast.error('Por favor, selecione um doutor no menu lateral antes de criar um agendamento.');
      return;
    }

    // Se for SECRETARIA e for um novo agendamento (não edição), mostrar modal de confirmação
    if (user?.role === 'SECRETARIA' && !agendamento && doutorSelecionado) {
      setOpenConfirmModal(true);
      return;
    }

    // Se não for SECRETARIA ou já confirmou, prosseguir normalmente
    // Para SECRETARIA, garantir que o doutorId seja do doutor selecionado
    const doutorIdFinal = user?.role === 'SECRETARIA' && doutorSelecionado
      ? doutorSelecionado.id
      : Number(form.doutorId || user?.id || 0);
    
    // Se for encaixe novo (não edição), definir status automaticamente
    // Para SECRETARIA em novo agendamento, permitir "pendente" ou "confirmado"
    let statusFinal = form.status;
    if (!agendamento && form.isEncaixe) {
      statusFinal = 'encaixe_pendente';
    } else if (user?.role === 'SECRETARIA' && !agendamento) {
      // Permitir apenas "pendente" ou "confirmado" para SECRETARIA em novos agendamentos
      if (form.status !== 'pendente' && form.status !== 'confirmado') {
        statusFinal = 'pendente'; // Padrão para novos agendamentos
      }
    }
    
    const dataToSend: AgendamentoCreateInput = {
      ...form,
      pacienteId: Number(form.pacienteId),
      doutorId: doutorIdFinal,
      servicoId: Number(form.servicoId),
      dataHora: new Date(form.dataHora).toISOString(),
      isEncaixe: form.isEncaixe,
      status: statusFinal,
    };
    onSubmit(dataToSend);
  };

  const handleConfirmSubmit = () => {
    setOpenConfirmModal(false);
    // Para SECRETARIA, garantir que o doutorId seja do doutor selecionado
    const doutorIdFinal = user?.role === 'SECRETARIA' && doutorSelecionado
      ? doutorSelecionado.id
      : Number(form.doutorId || user?.id || 0);
    
    // Se for encaixe novo, definir status automaticamente
    // Para SECRETARIA em novo agendamento, permitir "pendente" ou "confirmado"
    let statusFinal = form.status;
    if (form.isEncaixe) {
      statusFinal = 'encaixe_pendente';
    } else if (user?.role === 'SECRETARIA' && !agendamento) {
      // Permitir apenas "pendente" ou "confirmado" para SECRETARIA em novos agendamentos
      if (form.status !== 'pendente' && form.status !== 'confirmado') {
        statusFinal = 'pendente'; // Padrão para novos agendamentos
      }
    }
    
    const dataToSend: AgendamentoCreateInput = {
      ...form,
      pacienteId: Number(form.pacienteId),
      doutorId: doutorIdFinal,
      servicoId: Number(form.servicoId),
      dataHora: new Date(form.dataHora).toISOString(),
      isEncaixe: form.isEncaixe,
      status: statusFinal,
    };
    onSubmit(dataToSend);
  };

  const handleConfirmCancelamento = () => {
    if (!motivoCancelamento.trim()) {
      toast.error('Por favor, informe o motivo do cancelamento.');
      return;
    }

    setOpenCancelModal(false);
    
    // Atualizar o form com status cancelado e motivo
    setForm((prev) => ({ ...prev, status: 'cancelado' }));
    
    // Para SECRETARIA, garantir que o doutorId seja do doutor selecionado
    const doutorIdFinal = user?.role === 'SECRETARIA' && doutorSelecionado
      ? doutorSelecionado.id
      : Number(form.doutorId || user?.id || 0);
    
    const dataToSend: AgendamentoCreateInput = {
      ...form,
      status: 'cancelado',
      motivoCancelamento: motivoCancelamento.trim(),
      pacienteId: Number(form.pacienteId),
      doutorId: doutorIdFinal,
      servicoId: Number(form.servicoId),
      dataHora: new Date(form.dataHora).toISOString(),
      isEncaixe: form.isEncaixe,
    };
    onSubmit(dataToSend);
    
    // Limpar motivo após enviar
    setMotivoCancelamento('');
  };

  const handleCancelCancelamento = () => {
    setOpenCancelModal(false);
    setMotivoCancelamento('');
    // Restaurar status anterior
    setForm((prev) => ({ ...prev, status: statusAnterior }));
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: 'dados' | 'historico') => {
    setActiveTab(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="body">
      <DialogTitle sx={{ m: 0, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {agendamento ? (
              'Editar Agendamento'
            ) : (
              <>
                Novo Agendamento Manual
                {user?.role === 'SECRETARIA' && doutorSelecionado && (
                  <>
                    {' para '}
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: 'warning.main',
                      }}
                    >
                      <WarningAmberIcon sx={{ fontSize: '1.2em' }} />
                      <Box component="span" sx={{ fontWeight: 600 }}>
                        Dr. {doutorSelecionado.nome}
                      </Box>
                    </Box>
                  </>
                )}
              </>
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {agendamento && (
              <>
                {onRequestDelete && (() => {
                  // Verificar se o agendamento está finalizado e é do dia atual
                  const hoje = moment().startOf('day');
                  const isFinalizadoHoje = agendamento?.status === 'finalizado' && 
                    agendamento?.dataHora && 
                    moment(agendamento.dataHora).startOf('day').isSame(hoje, 'day');
                  const canDelete = !isFinalizadoHoje;
                  
                  return (
                    <Tooltip title={isFinalizadoHoje ? 'Não é possível excluir um atendimento finalizado hoje' : 'Excluir agendamento'}>
                      <span>
                        <IconButton
                          aria-label="Excluir agendamento"
                          onClick={onRequestDelete}
                          disabled={loading || !canDelete}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  );
                })()}
              </>
            )}
            <Tooltip title="Fechar">
              <IconButton aria-label="Fechar" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ overflow: 'visible' }}>
          {agendamento && user?.role !== 'SECRETARIA' && (
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab value="dados" label="Dados do agendamento" />
              <Tab value="historico" label="Histórico do paciente" />
            </Tabs>
          )}

          {(activeTab === 'dados' || user?.role === 'SECRETARIA') && (
            <Box>
              {loading ? (
                <CircularProgress />
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={pacientesFiltrados}
                      value={pacienteSelecionado}
                      onChange={(_, newValue) => {
                        setForm((prev) => ({
                          ...prev,
                          pacienteId: newValue ? String(newValue.id) : '',
                        }));
                        setBuscaPaciente(''); // Limpar busca ao selecionar
                      }}
                      onInputChange={(_, newInputValue) => {
                        setBuscaPaciente(newInputValue);
                      }}
                      inputValue={buscaPaciente}
                      getOptionLabel={(option) => option.nome || ''}
                      loading={loadingPacientes || fetchingPacientes}
                      disabled={Boolean(agendamento)}
                      noOptionsText={
                        buscaDebounced.trim()
                          ? 'Nenhum paciente encontrado'
                          : loadingPacientes
                          ? 'Carregando pacientes...'
                          : 'Digite para buscar pacientes'
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Paciente"
                          required
                          margin="normal"
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingPacientes || fetchingPacientes ? (
                                  <CircularProgress color="inherit" size={20} />
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id}>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {option.nome}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              {option.cpf && (
                                <Typography variant="caption" color="text.secondary">
                                  CPF: {option.cpf}
                                </Typography>
                              )}
                              {option.telefone && (
                                <Typography variant="caption" color="text.secondary">
                                  {option.cpf ? ' • ' : ''}Tel: {option.telefone}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      )}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="servico-label">Serviço</InputLabel>
                      <Select
                        name="servicoId"
                        labelId="servico-label"
                        value={form.servicoId}
                        label="Serviço"
                        onChange={handleSelectChange}
                      >
                        {servicos.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.nome} ({s.duracaoMin} min)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {user?.role !== 'SECRETARIA' && (
                    <Grid item xs={12}>
                      <FormControl fullWidth required margin="normal">
                        <InputLabel id="doutor-label">Doutor</InputLabel>
                        <Select
                          name="doutorId"
                          labelId="doutor-label"
                          value={form.doutorId}
                          label="Doutor"
                          onChange={handleSelectChange}
                          disabled={user?.role === 'DOUTOR'}
                        >
                          {doutores.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.nome}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="dataHora"
                      label="Data e Hora"
                      type="datetime-local"
                      value={form.dataHora}
                      onChange={handleInputChange}
                      fullWidth
                      required
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required margin="normal">
                      <InputLabel id="status-label">Status</InputLabel>
                      <Select
                        name="status"
                        labelId="status-label"
                        value={form.status || (user?.role === 'SECRETARIA' ? 'pendente' : 'confirmado')}
                        label="Status"
                        onChange={handleSelectChange}
                        disabled={form.isEncaixe && !agendamento} // Desabilitar se for encaixe novo (será definido automaticamente)
                      >
                        {/* Para SECRETARIA: mostrar Pendente e Confirmado, e manter status atual se for outro */}
                        {(() => {
                          const isSecretaria = user?.role === 'SECRETARIA';
                          const statusOptions: JSX.Element[] = [];
                          const currentStatus = form.status || '';
                          
                          if (isSecretaria) {
                            // Sempre incluir Pendente e Confirmado para SECRETARIA
                            statusOptions.push(<MenuItem key="pendente" value="pendente">Pendente</MenuItem>);
                            statusOptions.push(<MenuItem key="confirmado" value="confirmado">Confirmado</MenuItem>);
                            
                            // Se estiver editando um agendamento existente, sempre permitir cancelar
                            // (isso permite cancelar agendamentos finalizados e outros status)
                            if (agendamento) {
                              statusOptions.push(<MenuItem key="cancelado" value="cancelado">Cancelado</MenuItem>);
                            }
                            
                            // Se o status atual não for pendente ou confirmado, incluir também para manter o valor
                            if (currentStatus && currentStatus !== 'pendente' && currentStatus !== 'confirmado' && currentStatus !== 'cancelado') {
                              const statusLabel = 
                                currentStatus === 'finalizado' ? 'Finalizado' :
                                currentStatus === 'pendente_ia' ? 'Pendente (IA)' :
                                currentStatus === 'encaixe_pendente' ? 'Encaixe Pendente' :
                                currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
                              
                              statusOptions.push(
                                <MenuItem key={currentStatus} value={currentStatus}>{statusLabel}</MenuItem>
                              );
                            }
                          } else {
                            // Para outras roles, mostrar todas as opções
                            statusOptions.push(<MenuItem key="confirmado" value="confirmado">Confirmado</MenuItem>);
                            statusOptions.push(<MenuItem key="pendente_ia" value="pendente_ia">Pendente (IA)</MenuItem>);
                            if (form.isEncaixe && !agendamento) {
                              statusOptions.push(<MenuItem key="encaixe_pendente" value="encaixe_pendente">Encaixe Pendente</MenuItem>);
                            }
                            statusOptions.push(<MenuItem key="cancelado" value="cancelado">Cancelado</MenuItem>);
                            statusOptions.push(<MenuItem key="finalizado" value="finalizado">Finalizado</MenuItem>);
                            
                            // Se o status atual for 'pendente', incluir também (para casos de edição de agendamento criado por SECRETARIA)
                            if (currentStatus === 'pendente') {
                              statusOptions.push(<MenuItem key="pendente" value="pendente">Pendente</MenuItem>);
                            }
                            
                            // Se o status atual não estiver nas opções acima, incluir também
                            if (currentStatus && 
                                currentStatus !== 'confirmado' && 
                                currentStatus !== 'pendente_ia' && 
                                currentStatus !== 'encaixe_pendente' && 
                                currentStatus !== 'cancelado' && 
                                currentStatus !== 'finalizado' &&
                                currentStatus !== 'pendente') {
                              const statusLabel = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
                              statusOptions.push(
                                <MenuItem key={currentStatus} value={currentStatus}>{statusLabel}</MenuItem>
                              );
                            }
                          }
                          
                          return statusOptions;
                        })()}
                      </Select>
                      {form.isEncaixe && !agendamento && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                          Status será automaticamente definido como "Encaixe Pendente"
                        </Typography>
                      )}
                      {user?.role === 'SECRETARIA' && !agendamento && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                          Para novos agendamentos, você pode escolher entre "Pendente" ou "Confirmado"
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  {!agendamento && (
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.isEncaixe}
                            onChange={handleCheckboxChange}
                            name="isEncaixe"
                            color="warning"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">Agendar como Encaixe</Typography>
                            <Tooltip title="Permite agendar em horário parcialmente ocupado. O médico precisará confirmar manualmente.">
                              <InfoIcon fontSize="small" color="action" />
                            </Tooltip>
                          </Box>
                        }
                      />
                      {form.isEncaixe && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          Este agendamento será marcado como encaixe e precisará ser confirmado pelo médico.
                        </Alert>
                      )}
                    </Grid>
                  )}

                  {agendamento && agendamento.isEncaixe && (
                    <Grid item xs={12}>
                      <Alert 
                        severity={agendamento.confirmadoPorMedico || agendamento.status === 'confirmado' ? "success" : "warning"} 
                        sx={{ mt: 1 }}
                      >
                        {agendamento.confirmadoPorMedico || agendamento.status === 'confirmado'
                          ? "✓ Encaixe confirmado pelo médico"
                          : "⚠ Este é um agendamento de encaixe pendente de confirmação do médico"}
                      </Alert>
                    </Grid>
                  )}

                  {agendamento && agendamento.status === 'cancelado' && agendamento.motivoCancelamento && (
                    <Grid item xs={12}>
                      <Alert severity="error" sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Agendamento Cancelado
                        </Typography>
                        <Typography variant="body2">
                          <strong>Motivo:</strong> {agendamento.motivoCancelamento}
                        </Typography>
                        {agendamento.canceladoEm && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            Cancelado em: {moment(agendamento.canceladoEm).format('DD/MM/YYYY [às] HH:mm')}
                          </Typography>
                        )}
                      </Alert>
                    </Grid>
                  )}

                  {agendamento && agendamento.relatoPaciente && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                          label="Relato do Paciente"
                          value={agendamento.relatoPaciente}
                          fullWidth
                          multiline
                          minRows={2}
                          margin="normal"
                          disabled
                          sx={{ flex: 1 }}
                        />
                        {agendamento.entendimentoIA && (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Entendimento da IA:
                                </Typography>
                                <Typography variant="body2">{agendamento.entendimentoIA}</Typography>
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <IconButton
                              color="primary"
                              sx={{
                                mt: 2,
                                alignSelf: 'flex-start',
                              }}
                            >
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}

          {agendamento && activeTab === 'historico' && user?.role !== 'SECRETARIA' && (
            <Box>
              {historicoLoading ? (
                <CircularProgress />
              ) : historicoError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {historicoError}
                </Alert>
              ) : historicos.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Nenhum histórico encontrado para este paciente.
                </Typography>
              ) : (
                <>
                  <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Data"
                        type="date"
                        value={filtroData}
                        onChange={(e) => setFiltroData(e.target.value)}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Prescrição"
                        value={filtroPrescricao}
                        onChange={(e) => setFiltroPrescricao(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="ID ou conteúdo"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Filtrar por Descrição/Profissional"
                        value={filtroDescricao}
                        onChange={(e) => setFiltroDescricao(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="ID, profissional ou descrição"
                      />
                    </Grid>
                  </Grid>
                  {(filtroData || filtroPrescricao || filtroDescricao) && (
                    <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setFiltroData('');
                          setFiltroPrescricao('');
                          setFiltroDescricao('');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </Box>
                  )}

                  {(() => {
                    const historicosFiltrados = historicos.filter((historico) => {
                      if (filtroData) {
                        const dataHistorico = moment(historico.realizadoEm).format('YYYY-MM-DD');
                        if (dataHistorico !== filtroData) {
                          return false;
                        }
                      }

                      if (filtroPrescricao) {
                        const filtroLower = filtroPrescricao.toLowerCase();
                        const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                        const encontrouPrescricao = prescricoesHistorico.some((prescricao) => {
                          const idMatch = prescricao.id.toString().includes(filtroPrescricao);
                          const conteudoMatch = prescricao.conteudo?.toLowerCase().includes(filtroLower);
                          return idMatch || conteudoMatch;
                        });
                        if (!encontrouPrescricao) {
                          return false;
                        }
                      }

                      if (filtroDescricao) {
                        const filtroLower = filtroDescricao.toLowerCase();
                        const descricaoMatch = historico.descricao?.toLowerCase().includes(filtroLower) || false;
                        const idMatch = historico.id.toString().includes(filtroDescricao);
                        const profissionalMatch = historico.doutor?.nome?.toLowerCase().includes(filtroLower) || false;
                        if (!descricaoMatch && !idMatch && !profissionalMatch) {
                          return false;
                        }
                      }

                      return true;
                    });

                    if (historicosFiltrados.length === 0) {
                      return (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                          Nenhum histórico encontrado com os filtros aplicados.
                        </Typography>
                      );
                    }

                    return (
                      <List dense sx={{ mb: 2, maxHeight: 320, overflowY: 'auto' }}>
                        {historicosFiltrados.map((historico, index) => {
                          const realizadoEm = moment(historico.realizadoEm);
                          const realizadoLabel = `${realizadoEm.format('DD/MM/YYYY')} às ${realizadoEm.format('HH:mm')}`;
                          const finalizadoEm = moment(historico.criadoEm);
                          const finalizadoLabel = finalizadoEm.isValid()
                            ? `${finalizadoEm.format('DD/MM/YYYY')} às ${finalizadoEm.format('HH:mm')}`
                            : null;
                          const servicoNome = historico.servico?.nome ?? 'Consulta';
                          const profissionalNome = historico.doutor?.nome ? `Profissional: ${historico.doutor.nome}` : null;
                          const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                          const descricaoCompleta = historico.descricao || 'Sem descrição registrada.';

                          return (
                            <React.Fragment key={historico.id}>
                              <ListItem alignItems="flex-start" disableGutters>
                                <ListItemText
                                  primary={
                                    <Box sx={{ position: 'relative' }}>
                                      <Typography
                                        variant="h4"
                                        sx={{
                                          position: 'absolute',
                                          top: -10,
                                          right: 10,
                                          fontSize: '2rem',
                                          fontWeight: 'bold',
                                          color: 'rgba(0, 0, 0, 0.08)',
                                          pointerEvents: 'none',
                                          userSelect: 'none',
                                        }}
                                      >
                                        #{historico.id}
                                      </Typography>
                                      <Box sx={{ position: 'relative', zIndex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                          {`${servicoNome} • ${realizadoLabel}`}
                                        </Typography>
                                        {profissionalNome && (
                                          <Typography variant="caption" color="text.secondary" display="block">
                                            {profissionalNome}
                                        </Typography>
                                      )}
                                      {finalizadoLabel && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          {`Finalizado em ${finalizadoLabel}`}
                                            {historico.duracaoMinutos && (
                                              <span> • Duração: {historico.duracaoMinutos} min</span>
                                            )}
                                        </Typography>
                                      )}
                                        {prescricoesHistorico.length > 0 && (
                                          <Box sx={{ mt: 1 }}>
                                            <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                              Prescrições Médicas:
                                            </Typography>
                                            {prescricoesHistorico.map((prescricao) => {
                                              const primeiroMedicamento = extrairPrimeiroMedicamento(prescricao.conteudo || '');
                                              const labelTexto = primeiroMedicamento
                                                ? `#${prescricao.id} - ${primeiroMedicamento}`
                                                : `#${prescricao.id}`;
                                              return (
                                                <Tooltip
                                                  key={prescricao.id}
                                                  title={
                                                    <Box component="div" sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                                                      {prescricao.conteudo || 'Sem conteúdo'}
                                                    </Box>
                                                  }
                                                  arrow
                                                  enterDelay={1000}
                                                  placement="top"
                                                >
                                                  <Chip
                                                    label={labelTexto}
                                                    size="small"
                                                    variant="outlined"
                                                    color="success"
                                                    onClick={() => handleVisualizarPrescricao(prescricao.protocolo)}
                                                    sx={{
                                                      mr: 0.5,
                                                      mb: 0.5,
                                                      cursor: 'pointer',
                                                      '&:hover': {
                                                        backgroundColor: 'primary.light',
                                                        color: 'primary.main',
                                                        borderColor: 'primary.main',
                                                      },
                                                    }}
                                                  />
                                                </Tooltip>
                                              );
                                            })}
                                          </Box>
                                        )}
                                      </Box>
                                    </Box>
                                  }
                                  secondary={
                                    <Tooltip
                                      title={
                                        <Box component="div" sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                                          {descricaoCompleta}
                                        </Box>
                                      }
                                      arrow
                                      enterDelay={500}
                                      placement="top"
                                    >
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                          mt: 1,
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          wordBreak: 'break-word',
                                          whiteSpace: 'pre-wrap',
                                          cursor: 'pointer',
                                          '&:hover': { color: 'primary.main' },
                                        }}
                                        onClick={() => handleAbrirHistoricoModal(historico)}
                                      >
                                        {descricaoCompleta}
                                    </Typography>
                                    </Tooltip>
                                  }
                                />
                              </ListItem>
                              {index < historicosFiltrados.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                          );
                        })}
                      </List>
                    );
                  })()}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {agendamento?.isEncaixe && !agendamento?.confirmadoPorMedico && user?.role === 'DOUTOR' && (
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  setLoading(true);
                  await confirmarEncaixe(agendamento.id);
                  toast.success('Encaixe confirmado com sucesso!');
                  // Disparar evento para atualizar a agenda (WebSocket também atualizará)
                  const doutorIdEvento = agendamento.doutor?.id;
                  if (doutorIdEvento) {
                    window.dispatchEvent(new CustomEvent('agendamentoAtualizado', { 
                      detail: { tipo: 'encaixe_confirmed', doutorId: doutorIdEvento } 
                    }));
                  }
                  // Fechar modal
                  onClose();
                } catch (error: any) {
                  toast.error(error?.response?.data?.message || 'Erro ao confirmar encaixe.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              sx={{ mr: 'auto' }}
            >
              Confirmar Encaixe
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={loading}>
            {agendamento ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogActions>

        <Dialog
          open={openHistoricoModal}
          onClose={handleFecharHistoricoModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Visualizar/Editar Atendimento #{historicoSelecionado?.id}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {historicoSelecionado && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Data do Atendimento: {moment(historicoSelecionado.realizadoEm).format('DD/MM/YYYY [às] HH:mm')}
                </Typography>
                {historicoSelecionado.duracaoMinutos && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Duração: {historicoSelecionado.duracaoMinutos} min
                  </Typography>
                )}
                <TextField
                  label="Descrição do atendimento"
                  multiline
                  minRows={8}
                  fullWidth
                  value={descricaoEditando}
                  onChange={(event) => setDescricaoEditando(event.target.value)}
                  placeholder="Atualize a descrição deste atendimento..."
                  autoFocus
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleFecharHistoricoModal} disabled={salvandoHistorico}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSalvarHistoricoDescricao}
              disabled={!descricaoEditando.trim() || salvandoHistorico}
            >
              {salvandoHistorico ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de confirmação para SECRETARIA */}
        <Dialog
          open={openConfirmModal}
          onClose={() => setOpenConfirmModal(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              <Typography variant="h6">Confirmar Agendamento</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Criar um novo agendamento para o{' '}
              <Box
                component="span"
                sx={{
                  color: 'error.main',
                  fontSize: '1.2em',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <WarningIcon sx={{ fontSize: '1.2em' }} />
                Dr. {doutorSelecionado?.nome}
              </Box>
              ?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenConfirmModal(false)}>Cancelar</Button>
            <Button onClick={handleConfirmSubmit} variant="contained" color="primary">
              Confirmar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de cancelamento */}
        <Dialog
          open={openCancelModal}
          onClose={handleCancelCancelamento}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="error" />
              <Typography variant="h6">Cancelar Agendamento</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Você está prestes a cancelar este agendamento. Esta ação requer um motivo.
            </Alert>
            {agendamento && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Paciente:</strong> {agendamento.paciente.nome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Data/Hora:</strong> {moment(agendamento.dataHora).format('DD/MM/YYYY [às] HH:mm')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Serviço:</strong> {agendamento.servico.nome}
                </Typography>
              </Box>
            )}
            <TextField
              label="Motivo do Cancelamento"
              placeholder="Informe o motivo do cancelamento..."
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              required
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelCancelamento}>Voltar</Button>
            <Button 
              onClick={handleConfirmCancelamento} 
              variant="contained" 
              color="error"
              disabled={!motivoCancelamento.trim()}
            >
              Confirmar Cancelamento
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Dialog>
  );
};

