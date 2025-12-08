import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Autocomplete,
  Typography,
  Grid,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import MedicationIcon from '@mui/icons-material/Medication';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import ScienceIcon from '@mui/icons-material/Science';
import WarningIcon from '@mui/icons-material/Warning';
import { IPrescricao, IPaciente, IMedicamento, IDoutor } from '../../types/models';
import { useAuth } from '../../hooks/useAuth';
import { getMedicamentos } from '../../services/medicamento.service';
import { getDoutorById } from '../../services/doutor.service';
import { createPrescricao, getPrescricaoByProtocolo } from '../../services/prescricao.service';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';
import DescriptionIcon from '@mui/icons-material/Description';
import { toast } from 'sonner';
import moment from 'moment';
import { AlergiaFormModal } from './AlergiaFormModal';
import { AlergiaAlertaModal } from './AlergiaAlertaModal';
import { verificarAlergia, getAlergiasByPaciente, IAlergiaMedicamento, VerificacaoAlergia } from '../../services/alergia.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { conteudo: string; pacienteId: number }) => Promise<void>;
  prescricao?: IPrescricao | null;
  pacientes: IPaciente[];
  onPrescricaoCriada?: () => void; // Callback para atualizar lista após criar prescrição
}

export const PrescricaoFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  prescricao,
  pacientes,
  onPrescricaoCriada,
}) => {
  const { user } = useAuth();
  const [conteudo, setConteudo] = useState('');
  const [pacienteSelecionado, setPacienteSelecionado] = useState<IPaciente | null>(null);
  const [loading, setLoading] = useState(false);
  const [doutorCompleto, setDoutorCompleto] = useState<IDoutor | null>(null);
  const [loadingDoutor, setLoadingDoutor] = useState(false);

  // Estados para busca de medicamentos
  const [openMedicamentoModal, setOpenMedicamentoModal] = useState(false);
  const [buscaMedicamento, setBuscaMedicamento] = useState('');
  const [buscaPrincipioAtivo, setBuscaPrincipioAtivo] = useState('');
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [buscaCategoria, setBuscaCategoria] = useState('');
  const [medicamentosEncontrados, setMedicamentosEncontrados] = useState<IMedicamento[]>([]);
  const [loadingMedicamentos, setLoadingMedicamentos] = useState(false);
  const [medicamentoSelecionado, setMedicamentoSelecionado] = useState<IMedicamento | null>(null);
  const [quantidadeMedicamento, setQuantidadeMedicamento] = useState<number>(1);
  const [unidadeMedicamento, setUnidadeMedicamento] = useState<'comprimidos' | 'caixa'>('caixa');
  const [quantidadeComprimidos, setQuantidadeComprimidos] = useState<number | ''>('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  
  // Estados para alergias
  const [openAlergiaModal, setOpenAlergiaModal] = useState(false);
  const [openPerguntaAlergiaModal, setOpenPerguntaAlergiaModal] = useState(false);
  const [alergiasPaciente, setAlergiasPaciente] = useState<IAlergiaMedicamento[]>([]);
  const [mostrouModalAlergia, setMostrouModalAlergia] = useState(false);
  const [openAlergiaAlertaModal, setOpenAlergiaAlertaModal] = useState(false);
  const [alergiaAlertaInfo, setAlergiaAlertaInfo] = useState<{
    medicamentoNome: string;
    verificacao: VerificacaoAlergia;
  } | null>(null);

  useEffect(() => {
    if (open) {
      if (prescricao) {
        setConteudo(prescricao.conteudo || '');
        setPacienteSelecionado(
          pacientes.find((p) => p.id === prescricao.pacienteId) || null
        );
        setMostrouModalAlergia(true);
      } else {
        setConteudo('');
        setPacienteSelecionado(null);
        setMostrouModalAlergia(false);
      }
    }
  }, [open, prescricao, pacientes]);

  // Carregar alergias do paciente quando selecionado
  useEffect(() => {
    const loadAlergias = async () => {
      if (pacienteSelecionado) {
        try {
          const alergias = await getAlergiasByPaciente(pacienteSelecionado.id);
          setAlergiasPaciente(alergias);
        } catch (error) {
          console.error('Erro ao carregar alergias:', error);
        }
      } else {
        setAlergiasPaciente([]);
      }
    };
    loadAlergias();
  }, [pacienteSelecionado]);

  // Mostrar pergunta sobre alergias quando paciente é selecionado pela primeira vez (apenas para nova prescrição)
  useEffect(() => {
    if (open && !prescricao && pacienteSelecionado && !mostrouModalAlergia) {
      const timer = setTimeout(() => {
        setOpenPerguntaAlergiaModal(true);
        setMostrouModalAlergia(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, prescricao, pacienteSelecionado, mostrouModalAlergia]);

  // Carregar dados completos do doutor quando o modal abrir
  useEffect(() => {
    const loadDoutor = async () => {
      if (open && user?.id && user.role === 'DOUTOR') {
        try {
          setLoadingDoutor(true);
          const doutor = await getDoutorById(user.id);
          setDoutorCompleto(doutor);
        } catch (error) {
          console.error('Erro ao carregar dados do doutor:', error);
        } finally {
          setLoadingDoutor(false);
        }
      }
    };
    loadDoutor();
  }, [open, user]);

  // Carregar lista de empresas e categorias
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const allData = await getMedicamentos({ skip: 0, take: 10000 });
        const allEmpresas = new Set<string>();
        const allCategorias = new Set<string>();
        
        allData.medicamentos.forEach((m) => {
          if (m.empresaDetentoraRegistro) {
            allEmpresas.add(m.empresaDetentoraRegistro);
          }
          if (m.categoriaRegulatoria) {
            allCategorias.add(m.categoriaRegulatoria);
          }
        });

        setEmpresas(Array.from(allEmpresas).sort());
        setCategorias(Array.from(allCategorias).sort());
      } catch (err) {
        console.error('Erro ao carregar opções de empresas e categorias:', err);
      }
    };

    if (openMedicamentoModal) {
      loadOptions();
    }
  }, [openMedicamentoModal]);

  // Buscar medicamentos com filtros
  const buscarMedicamentos = async () => {
    const temFiltro = buscaMedicamento.trim() || buscaPrincipioAtivo.trim() || buscaEmpresa.trim() || buscaCategoria.trim();
    
    if (!temFiltro) {
      setMedicamentosEncontrados([]);
      return;
    }

    try {
      setLoadingMedicamentos(true);
      const filters: any = {
        take: 20,
      };

      if (buscaMedicamento.trim()) {
        filters.nomeProduto = buscaMedicamento.trim();
      }
      if (buscaPrincipioAtivo.trim()) {
        filters.principioAtivo = buscaPrincipioAtivo.trim();
      }
      if (buscaEmpresa.trim()) {
        filters.empresaDetentoraRegistro = buscaEmpresa.trim();
      }
      if (buscaCategoria.trim()) {
        filters.categoriaRegulatoria = buscaCategoria.trim();
      }

      const resultado = await getMedicamentos(filters);
      setMedicamentosEncontrados(resultado.medicamentos);
    } catch (error: any) {
      console.error('Erro ao buscar medicamentos:', error);
      toast.error('Erro ao buscar medicamentos');
    } finally {
      setLoadingMedicamentos(false);
    }
  };

  // Debounce para busca de medicamentos
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarMedicamentos();
    }, 500);

    return () => clearTimeout(timer);
  }, [buscaMedicamento, buscaPrincipioAtivo, buscaEmpresa, buscaCategoria]);

  // Adicionar medicamento à prescrição
  const handleAdicionarMedicamento = async () => {
    if (!medicamentoSelecionado) {
      toast.error('Selecione um medicamento');
      return;
    }

    if (quantidadeMedicamento <= 0) {
      toast.error('A quantidade deve ser maior que zero');
      return;
    }

    // Validar alergia antes de adicionar
    if (pacienteSelecionado) {
      try {
        const resultado = await verificarAlergia(
          pacienteSelecionado.id,
          medicamentoSelecionado.nomeProduto,
          medicamentoSelecionado.principioAtivo || undefined,
          medicamentoSelecionado.classeTerapeutica || undefined,
          undefined // excipientes não disponível no medicamento
        );

        if (resultado.temAlergia) {
          // Bloquear completamente - mostrar modal e não permitir continuar
          setAlergiaAlertaInfo({
            medicamentoNome: medicamentoSelecionado.nomeProduto,
            verificacao: resultado,
          });
          setOpenAlergiaAlertaModal(true);
          return; // Bloquear a adição do medicamento
        }
      } catch (error) {
        console.error('Erro ao verificar alergia:', error);
      }
    }

    const nomeMedicamento = medicamentoSelecionado.nomeProduto;
    let linhaMedicamento = '';
    const larguraTotal = 100;

    if (unidadeMedicamento === 'caixa') {
      if (quantidadeComprimidos && quantidadeComprimidos > 0) {
        const sufixo = `${quantidadeMedicamento}caixa(${quantidadeComprimidos} comprimidos)`;
        const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
        linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
      } else {
        const sufixo = `${quantidadeMedicamento}caixa`;
        const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
        linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
      }
    } else {
      const sufixo = `${quantidadeMedicamento} comprimidos`;
      const tamanhoPontos = Math.max(1, larguraTotal - nomeMedicamento.length - sufixo.length);
      linhaMedicamento = `${nomeMedicamento}${'.'.repeat(tamanhoPontos)}${sufixo}`;
    }

    setConteudo((prev) => (prev ? `${prev}\n${linhaMedicamento}` : linhaMedicamento));

    // Limpar campos e fechar modal
    setBuscaMedicamento('');
    setMedicamentoSelecionado(null);
    setMedicamentosEncontrados([]);
    setQuantidadeMedicamento(1);
    setUnidadeMedicamento('caixa');
    setQuantidadeComprimidos('');
    setOpenMedicamentoModal(false);

    toast.success('Medicamento adicionado à prescrição');
  };

  const handleFecharModalMedicamento = () => {
    setOpenMedicamentoModal(false);
    setBuscaMedicamento('');
    setBuscaPrincipioAtivo('');
    setBuscaEmpresa('');
    setBuscaCategoria('');
    setMedicamentoSelecionado(null);
    setMedicamentosEncontrados([]);
    setQuantidadeMedicamento(1);
    setUnidadeMedicamento('caixa');
    setQuantidadeComprimidos('');
  };

  const handleSubmit = async () => {
    if (!conteudo.trim()) {
      toast.error('Digite o conteúdo da prescrição');
      return;
    }

    if (!pacienteSelecionado) {
      toast.error('Selecione um paciente');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        conteudo: conteudo.trim(),
        pacienteId: pacienteSelecionado.id,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarPrescricao = async () => {
    if (!conteudo.trim()) {
      toast.error('Digite o conteúdo da prescrição antes de gerar');
      return;
    }

    if (!pacienteSelecionado) {
      toast.error('Selecione um paciente');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!doutorCompleto) {
      toast.error('Dados do médico não carregados. Aguarde...');
      return;
    }

    try {
      setLoading(true);
      
      // Salvar prescrição no banco de dados (avulsa, sem agendamento)
      const prescricaoCriada = await createPrescricao({
        conteudo: conteudo.trim(),
        pacienteId: pacienteSelecionado.id,
        doutorId: user.id,
        agendamentoId: undefined, // Prescrição avulsa
      });

      // Buscar prescrição completa com protocolo
      const prescricaoCompleta = await getPrescricaoByProtocolo(prescricaoCriada.protocolo);

      // Carregar modelo do doutor ou usar padrão
      let modeloPrescricao: IModeloPrescricaoPDF = modeloPrescricaoPadrao;
      let logoURL = '';
      
      const modeloStr = doutorCompleto.modeloPrescricao || '';
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
        pacienteSelecionado.logradouro,
        pacienteSelecionado.numero,
        pacienteSelecionado.bairro,
        pacienteSelecionado.cidade,
        pacienteSelecionado.estado
      ].filter(Boolean).join(', ') || '';

      // Separar texto da prescrição em linhas
      const itensPrescricao = conteudo.trim().split('\n').filter(line => line.trim());

      // Obter dados da clínica
      const clinicaNome = doutorCompleto.clinica?.nome || 'Clínica';
      const clinicaEndereco = doutorCompleto.clinica?.endereco || '';
      const clinicaTelefone = doutorCompleto.clinica?.telefone || '';
      const clinicaEmail = doutorCompleto.clinica?.email || doutorCompleto.email || '';
      const clinicaSite = doutorCompleto.clinica?.site || '';
      const clinicaCNPJ = doutorCompleto.clinica?.cnpj;

      // Gerar PDF
      const pdfDoc = (
        <PrescricaoPdfView
          pacienteNome={pacienteSelecionado.nome || ''}
          pacienteEndereco={enderecoPaciente}
          pacienteCPF={pacienteSelecionado.cpf || undefined}
          data={moment().format('YYYY-MM-DD')}
          seguroSaude={pacienteSelecionado.convenio || ''}
          diagnostico=""
          doutorNome={doutorCompleto.nome || ''}
          doutorEspecialidade={doutorCompleto.especialidade || ''}
          doutorTagline={modeloPrescricao.medicoInfo.tagline || ''}
          doutorCRM={doutorCompleto.crm}
          doutorCRMUF={doutorCompleto.crmUf}
          doutorRQE={doutorCompleto.rqe}
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

      // Gerar blob do PDF e abrir para impressão
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
              setMostrouModalAlergia(false);
              onClose();
              setConteudo('');
              setPacienteSelecionado(null);
              toast.success('Prescrição gerada e salva com sucesso!');
              if (onPrescricaoCriada) {
                onPrescricaoCriada();
              }
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 250);
          };
          
          printWindow.onerror = () => {
            toast.error('Erro ao abrir janela de impressão');
          };
        } else {
          toast.error('Não foi possível abrir a janela de impressão. Verifique se o pop-up está bloqueado.');
        }
      }).catch((error) => {
        console.error('Erro ao gerar PDF:', error);
        toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao processar prescrição:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao gerar prescrição'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog 
      open={open} 
      onClose={() => {
        setMostrouModalAlergia(false);
        onClose();
      }} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {prescricao ? 'Editar Prescrição' : 'Nova Prescrição'}
          </Typography>
          <IconButton onClick={() => {
            setMostrouModalAlergia(false);
            onClose();
          }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ overflow: 'visible' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Médico: <strong>{user?.nome || 'N/A'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Data: <strong>{moment().format('DD/MM/YYYY')}</strong>
          </Typography>
        </Box>

        {alergiasPaciente.length > 0 && (
          <Alert 
            severity="error" 
            icon={<WarningIcon />} 
            sx={{ 
              mb: 2,
              flexShrink: 0,
              '& .MuiAlert-message': {
                width: '100%',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                Alergias Conhecidas ({alergiasPaciente.length}):
              </Typography>
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 0.75,
                  maxHeight: 80,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  pr: 0.5,
                  '&::-webkit-scrollbar': {
                    width: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '3px',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    },
                  },
                }}
              >
                {alergiasPaciente.map((alergia) => (
                  <Chip
                    key={alergia.id}
                    label={alergia.principioAtivo || alergia.nomeMedicamento}
                    color="error"
                    size="small"
                    variant="outlined"
                    title={`${alergia.nomeMedicamento} - ${alergia.principioAtivo}${alergia.classeQuimica ? ` (Classe: ${alergia.classeQuimica})` : ''}`}
                    sx={{ 
                      fontWeight: 600,
                      borderWidth: 2,
                      flexShrink: 0,
                      '&:hover': {
                        backgroundColor: 'error.light',
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Autocomplete
            disabled={!!prescricao}
            options={pacientes}
            getOptionLabel={(option) => option.nome}
            value={pacienteSelecionado}
            onChange={(_, newValue) => {
              setPacienteSelecionado(newValue);
              if (!prescricao && newValue) {
                setMostrouModalAlergia(false);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Paciente"
                placeholder="Selecione o paciente"
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <PersonIcon sx={{ ml: 1, mr: 0.5, color: 'action.active' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Box>

        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<WarningIcon />}
            onClick={() => setOpenAlergiaModal(true)}
            disabled={!pacienteSelecionado}
          >
            Cadastrar Alergia
          </Button>
          <Button
            variant="outlined"
            startIcon={<MedicationIcon />}
            onClick={() => setOpenMedicamentoModal(true)}
          >
            Adicionar Medicamento
          </Button>
        </Box>

        <TextField
          label="Conteúdo da Prescrição"
          multiline
          rows={12}
          fullWidth
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Digite o conteúdo da prescrição médica aqui ou use o botão acima para adicionar medicamentos..."
          helperText="Digite os medicamentos, dosagens e orientações para o paciente"
          required
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => {
            setMostrouModalAlergia(false);
            onClose();
          }} 
          disabled={loading}
        >
          Cancelar
        </Button>
        {!prescricao && (
          <Button
            onClick={handleGerarPrescricao}
            variant="contained"
            color="primary"
            startIcon={<DescriptionIcon />}
            disabled={!conteudo.trim() || !pacienteSelecionado || loading || loadingDoutor || !doutorCompleto}
          >
            {loading ? 'Gerando...' : 'Gerar e Imprimir Prescrição'}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          variant={prescricao ? "contained" : "outlined"}
          disabled={!conteudo.trim() || !pacienteSelecionado || loading}
        >
          {loading ? 'Salvando...' : prescricao ? 'Atualizar' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Modal de Adicionar Medicamento */}
    <Dialog
      open={openMedicamentoModal}
      onClose={handleFecharModalMedicamento}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <MedicationIcon />
            <Typography variant="h6">Adicionar Medicamento</Typography>
          </Box>
          <IconButton onClick={handleFecharModalMedicamento}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Filtros de Busca */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              value={buscaMedicamento}
              onChange={(e) => setBuscaMedicamento(e.target.value)}
              placeholder="Nome do Produto"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              value={buscaPrincipioAtivo}
              onChange={(e) => setBuscaPrincipioAtivo(e.target.value)}
              placeholder="Princípio Ativo"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ScienceIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              size="small"
              options={empresas}
              value={buscaEmpresa}
              onInputChange={(_, newValue) => setBuscaEmpresa(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Empresa (Farmacêutica)"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <BusinessIcon fontSize="small" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              size="small"
              options={categorias}
              value={buscaCategoria}
              onInputChange={(_, newValue) => setBuscaCategoria(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Categoria Regulatória"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <CategoryIcon fontSize="small" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          {(buscaMedicamento || buscaPrincipioAtivo || buscaEmpresa || buscaCategoria) && (
            <Grid item xs={12}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setBuscaMedicamento('');
                  setBuscaPrincipioAtivo('');
                  setBuscaEmpresa('');
                  setBuscaCategoria('');
                }}
              >
                Limpar Filtros
              </Button>
            </Grid>
          )}
        </Grid>

        {/* Lista de Resultados */}
        {loadingMedicamentos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : medicamentosEncontrados.length > 0 ? (
          <Box sx={{ mb: 2, maxHeight: 300, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
            {medicamentosEncontrados.map((medicamento) => (
              <Box
                key={medicamento.id}
                onClick={() => {
                  setMedicamentoSelecionado(medicamento);
                  setBuscaMedicamento(medicamento.nomeProduto);
                }}
                sx={{
                  p: 1.5,
                  mb: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: medicamentoSelecionado?.id === medicamento.id ? 'primary.light' : 'transparent',
                  '&:hover': {
                    bgcolor: medicamentoSelecionado?.id === medicamento.id ? 'primary.light' : 'grey.100',
                  },
                  border: medicamentoSelecionado?.id === medicamento.id ? '2px solid' : '1px solid',
                  borderColor: medicamentoSelecionado?.id === medicamento.id ? 'primary.main' : 'divider',
                }}
              >
                <Typography variant="body2" fontWeight="bold">
                  {medicamento.nomeProduto}
                </Typography>
                {medicamento.principioAtivo && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {medicamento.principioAtivo.substring(0, 80)}
                    {medicamento.principioAtivo.length > 80 ? '...' : ''}
                  </Typography>
                )}
                {medicamento.empresaDetentoraRegistro && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {medicamento.empresaDetentoraRegistro}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ) : (buscaMedicamento || buscaPrincipioAtivo || buscaEmpresa || buscaCategoria) ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Nenhum medicamento encontrado com os filtros aplicados.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Use os filtros acima para buscar medicamentos.
            </Typography>
          </Box>
        )}

        {/* Campos para adicionar medicamento selecionado */}
        {medicamentoSelecionado && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Medicamento Selecionado: {medicamentoSelecionado.nomeProduto}
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Quantidade"
                  type="number"
                  value={quantidadeMedicamento}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setQuantidadeMedicamento(Math.max(1, value));
                  }}
                  fullWidth
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Unidade</InputLabel>
                  <Select
                    value={unidadeMedicamento}
                    onChange={(e) => setUnidadeMedicamento(e.target.value as 'comprimidos' | 'caixa')}
                    label="Unidade"
                  >
                    <MenuItem value="caixa">Caixa</MenuItem>
                    <MenuItem value="comprimidos">Comprimidos</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {unidadeMedicamento === 'caixa' && (
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Comprimidos por caixa (opcional)"
                    type="number"
                    value={quantidadeComprimidos}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : parseInt(e.target.value) || '';
                      setQuantidadeComprimidos(value);
                    }}
                    fullWidth
                    inputProps={{ min: 1 }}
                    placeholder="Ex: 60"
                    helperText="Opcional: quantidade de comprimidos na caixa"
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleFecharModalMedicamento}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={handleAdicionarMedicamento}
          disabled={!medicamentoSelecionado}
        >
          Adicionar à Prescrição
        </Button>
      </DialogActions>
    </Dialog>

    {/* Modal de Pergunta sobre Alergias */}
    <Dialog
      open={openPerguntaAlergiaModal}
      onClose={() => setOpenPerguntaAlergiaModal(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          <Typography variant="h6">Alergia a Medicamentos</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          O paciente possui alguma alergia a algum medicamento?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setOpenPerguntaAlergiaModal(false);
          }}
          variant="outlined"
        >
          Não
        </Button>
        <Button
          onClick={() => {
            setOpenPerguntaAlergiaModal(false);
            setOpenAlergiaModal(true);
          }}
          variant="contained"
          color="warning"
          startIcon={<WarningIcon />}
        >
          Sim
        </Button>
      </DialogActions>
    </Dialog>

    {/* Modal de Alergia */}
    <AlergiaFormModal
      open={openAlergiaModal}
      onClose={() => setOpenAlergiaModal(false)}
      paciente={pacienteSelecionado}
      onAlergiaCadastrada={async () => {
        if (pacienteSelecionado) {
          const alergias = await getAlergiasByPaciente(pacienteSelecionado.id);
          setAlergiasPaciente(alergias);
        }
      }}
    />

    {/* Modal de Alerta de Alergia - Bloqueia prescrição */}
    {alergiaAlertaInfo && (
      <AlergiaAlertaModal
        open={openAlergiaAlertaModal}
        onClose={() => {
          setOpenAlergiaAlertaModal(false);
          setAlergiaAlertaInfo(null);
        }}
        medicamentoNome={alergiaAlertaInfo.medicamentoNome}
        verificacao={alergiaAlertaInfo.verificacao}
      />
    )}
  </>
);
};

