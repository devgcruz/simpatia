import React, { useState, useEffect, useRef } from 'react';
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
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import { IPaciente, IDoutor } from '../../types/models';
import { IAtestado } from '../../types/atestado';
import { useAuth } from '../../hooks/useAuth';
import { getDoutorById } from '../../services/doutor.service';
import { createAtestado, getAtestadoByProtocolo } from '../../services/atestado.service';
import { pdf } from '@react-pdf/renderer';
import AtestadoPdfView from '../AtestadoPdfView';
import { toast } from 'sonner';
import moment from 'moment';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    diasAfastamento: number;
    cid?: string;
    exibirCid: boolean;
    conteudo: string;
    localAtendimento?: string;
    dataAtestado?: string;
    pacienteId: number;
  }) => Promise<void>;
  atestado?: IAtestado | null;
  pacientes: IPaciente[];
  agendamentoId?: number; // ID do agendamento quando criado pelo prontuário
  ocultarCampoPaciente?: boolean; // Se true, oculta o campo de seleção de paciente (usado no prontuário)
  onAtestadoCriado?: () => void;
}

export const AtestadoFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  atestado,
  pacientes,
  agendamentoId,
  ocultarCampoPaciente = false,
  onAtestadoCriado,
}) => {
  const { user } = useAuth();
  const [diasAfastamento, setDiasAfastamento] = useState<number>(1);
  const [tipoAfastamento, setTipoAfastamento] = useState<'dias' | 'horas'>('dias');
  const [horaInicial, setHoraInicial] = useState<string>('08:00');
  const [horaFinal, setHoraFinal] = useState<string>('08:50');
  const [cid, setCid] = useState('');
  const [exibirCid, setExibirCid] = useState(false);
  const [conteudo, setConteudo] = useState('');
  const [localAtendimento, setLocalAtendimento] = useState('Consultório');
  const [dataAtestado, setDataAtestado] = useState<string>(moment().format('YYYY-MM-DD'));
  const [pacienteSelecionado, setPacienteSelecionado] = useState<IPaciente | null>(null);
  const [loading, setLoading] = useState(false);
  const [doutorCompleto, setDoutorCompleto] = useState<IDoutor | null>(null);
  const [loadingDoutor, setLoadingDoutor] = useState(false);

  // Ref para controlar se já inicializou os valores
  const inicializadoRef = useRef(false);
  const openAnteriorRef = useRef(false);

  useEffect(() => {
    // Se o modal acabou de abrir (open mudou de false para true)
    if (open && !openAnteriorRef.current) {
      inicializadoRef.current = false;
    }
    
    // Se o modal está aberto e ainda não inicializou
    if (open && !inicializadoRef.current) {
      if (atestado) {
        setDiasAfastamento(atestado.diasAfastamento);
        setTipoAfastamento(atestado.diasAfastamento < 1 ? 'horas' : 'dias');
        setCid(atestado.cid || '');
        setExibirCid(atestado.exibirCid);
        setConteudo(atestado.conteudo || '');
        setLocalAtendimento(atestado.localAtendimento || 'Consultório');
        setDataAtestado(atestado.dataAtestado ? moment(atestado.dataAtestado).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'));
        setHoraInicial('08:00');
        setHoraFinal('08:50');
        setPacienteSelecionado(
          pacientes.find((p) => p.id === atestado.pacienteId) || null
        );
      } else {
        setDiasAfastamento(1);
        setTipoAfastamento('dias');
        setCid('');
        setExibirCid(false);
        setConteudo('');
        setLocalAtendimento('Consultório');
        setDataAtestado(moment().format('YYYY-MM-DD'));
        setHoraInicial('08:00');
        setHoraFinal('08:50');
        // Se houver apenas um paciente na lista ou se o campo estiver oculto, pré-selecionar automaticamente
        if (ocultarCampoPaciente || pacientes.length === 1) {
          setPacienteSelecionado(pacientes[0]);
        } else {
          setPacienteSelecionado(null);
        }
      }
      inicializadoRef.current = true;
    }
    
    // Se o modal fechou, resetar a flag
    if (!open && openAnteriorRef.current) {
      inicializadoRef.current = false;
    }
    
    openAnteriorRef.current = open;
  }, [open, atestado, pacientes, ocultarCampoPaciente]);

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

  const handleSubmit = async () => {
    if (!pacienteSelecionado) {
      toast.error('Selecione um paciente');
      return;
    }

    if (diasAfastamento <= 0) {
      toast.error('O tempo de afastamento deve ser maior que zero');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);
    try {
      // Calcular dias de afastamento baseado no tipo
      let diasCalculados: number;
      if (tipoAfastamento === 'horas' && horaInicial && horaFinal) {
        // Calcular diferença em horas entre horaInicial e horaFinal
        const [horaIni, minIni] = horaInicial.split(':').map(Number);
        const [horaFim, minFim] = horaFinal.split(':').map(Number);
        const minutosInicial = horaIni * 60 + minIni;
        const minutosFinal = horaFim * 60 + minFim;
        let minutosDiferenca = minutosFinal - minutosInicial;
        
        // Se a hora final for menor que a inicial, assumir que é no dia seguinte
        if (minutosDiferenca < 0) {
          minutosDiferenca += 24 * 60; // Adicionar 24 horas
        }
        
        // Converter minutos para dias decimais
        diasCalculados = minutosDiferenca / (24 * 60);
      } else if (tipoAfastamento === 'horas') {
        diasCalculados = diasAfastamento / 24;
      } else {
        diasCalculados = diasAfastamento;
      }
      
      await onSubmit({
        diasAfastamento: diasCalculados,
        cid: cid.trim() || undefined,
        exibirCid,
        conteudo: conteudo.trim(),
        localAtendimento: localAtendimento.trim() || 'Consultório',
        dataAtestado: dataAtestado || moment().format('YYYY-MM-DD'),
        pacienteId: pacienteSelecionado.id,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarAtestado = async () => {
    if (!pacienteSelecionado) {
      toast.error('Selecione um paciente');
      return;
    }

    if (diasAfastamento <= 0) {
      toast.error('O tempo de afastamento deve ser maior que zero');
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
      
      // Calcular dias de afastamento baseado no tipo
      let diasCalculados: number;
      if (tipoAfastamento === 'horas' && horaInicial && horaFinal) {
        // Calcular diferença em horas entre horaInicial e horaFinal
        const [horaIni, minIni] = horaInicial.split(':').map(Number);
        const [horaFim, minFim] = horaFinal.split(':').map(Number);
        const minutosInicial = horaIni * 60 + minIni;
        const minutosFinal = horaFim * 60 + minFim;
        let minutosDiferenca = minutosFinal - minutosInicial;
        
        // Se a hora final for menor que a inicial, assumir que é no dia seguinte
        if (minutosDiferenca < 0) {
          minutosDiferenca += 24 * 60; // Adicionar 24 horas
        }
        
        // Converter minutos para dias decimais
        diasCalculados = minutosDiferenca / (24 * 60);
      } else if (tipoAfastamento === 'horas') {
        diasCalculados = diasAfastamento / 24;
      } else {
        diasCalculados = diasAfastamento;
      }
      
      // Salvar atestado no banco de dados
      const atestadoCriado = await createAtestado({
        diasAfastamento: diasCalculados,
        horaInicial: tipoAfastamento === 'horas' && horaInicial ? horaInicial : undefined,
        horaFinal: tipoAfastamento === 'horas' && horaFinal ? horaFinal : undefined,
        cid: cid.trim() || undefined,
        exibirCid,
        conteudo: conteudo.trim(),
        localAtendimento: localAtendimento.trim() || 'Consultório',
        dataAtestado: dataAtestado ? new Date(dataAtestado).toISOString() : undefined,
        pacienteId: pacienteSelecionado.id,
        doutorId: user.id,
        agendamentoId: agendamentoId || undefined, // Vincular ao agendamento se fornecido
      });

      // Buscar atestado completo com protocolo
      const atestadoCompleto = await getAtestadoByProtocolo(atestadoCriado.protocolo);

      // Obter dados da clínica
      const clinicaNome = doutorCompleto.clinica?.nome || 'Clínica';
      const clinicaEndereco = doutorCompleto.clinica?.endereco || '';
      const clinicaTelefone = doutorCompleto.clinica?.telefone || '';
      const clinicaEmail = doutorCompleto.clinica?.email || doutorCompleto.email || '';
      const clinicaSite = doutorCompleto.clinica?.site || '';

      // Obter hora do atendimento (se houver agendamento, usar a hora dele, senão usar hora atual)
      const horaAtendimento = atestadoCompleto.agendamento?.dataHora
        ? moment(atestadoCompleto.agendamento.dataHora).format('HH:mm')
        : moment().format('HH:mm');

      // Usar data do atestado ou data atual
      const dataAtestadoFormatada = atestadoCompleto.dataAtestado 
        ? moment(atestadoCompleto.dataAtestado).format('YYYY-MM-DD')
        : moment().format('YYYY-MM-DD');

      // Gerar PDF
      const pdfDoc = (
        <AtestadoPdfView
          pacienteNome={pacienteSelecionado.nome || ''}
          pacienteCPF={pacienteSelecionado.cpf || undefined}
          dataAtendimento={dataAtestadoFormatada}
          horaAtendimento={horaAtendimento}
          diasAfastamento={diasCalculados}
          tipoAfastamento={tipoAfastamento}
          // INTEGRIDADE: Priorizar horas salvas no banco, caso contrário usar do estado local
          // Isso garante que o PDF seja idêntico ao documento médico original
          horaInicial={atestadoCompleto.horaInicial || (tipoAfastamento === 'horas' && horaInicial ? horaInicial : undefined)}
          horaFinal={atestadoCompleto.horaFinal || (tipoAfastamento === 'horas' && horaFinal ? horaFinal : undefined)}
          cid={atestadoCompleto.cid || undefined}
          exibirCid={atestadoCompleto.exibirCid}
          conteudo={atestadoCompleto.conteudo || ''}
          localAtendimento={atestadoCompleto.localAtendimento || 'Consultório'}
          doutorNome={doutorCompleto.nome || ''}
          doutorEspecialidade={doutorCompleto.especialidade || ''}
          doutorCRM={doutorCompleto.crm}
          doutorCRMUF={doutorCompleto.crmUf}
          doutorRQE={doutorCompleto.rqe}
          clinicaNome={clinicaNome}
          clinicaEndereco={clinicaEndereco}
          clinicaTelefone={clinicaTelefone}
          clinicaEmail={clinicaEmail}
          clinicaSite={clinicaSite}
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
              onClose();
              setDiasAfastamento(1);
              setTipoAfastamento('dias');
              setCid('');
              setExibirCid(false);
              setConteudo('');
              setLocalAtendimento('Consultório');
              setPacienteSelecionado(null);
              toast.success('Atestado gerado e salvo com sucesso!');
              if (onAtestadoCriado) {
                onAtestadoCriado();
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
        toast.error(`Erro ao gerar atestado: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao processar atestado:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao gerar atestado'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {atestado ? 'Editar Atestado' : 'Novo Atestado Médico'}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Médico: <strong>{user?.nome || 'N/A'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Data: <strong>{moment().format('DD/MM/YYYY')}</strong>
          </Typography>
        </Box>

        {!ocultarCampoPaciente && (
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              disabled={!!atestado}
              options={pacientes}
              getOptionLabel={(option) => option.nome}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={pacienteSelecionado}
              onChange={(_, newValue) => {
                setPacienteSelecionado(newValue);
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
        )}

        <Box sx={{ mb: 2 }}>
          <TextField
            label="Data do Atestado"
            type="date"
            value={dataAtestado}
            onChange={(e) => setDataAtestado(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            required
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 120, mb: 2, width: '100%' }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              value={tipoAfastamento}
              onChange={(e) => {
                const novoValor = e.target.value as 'dias' | 'horas';
                setTipoAfastamento(novoValor);
              }}
              label="Tipo"
            >
              <MenuItem value="dias">Dias</MenuItem>
              <MenuItem value="horas">Horas</MenuItem>
            </Select>
          </FormControl>
          
          {tipoAfastamento === 'dias' ? (
            <TextField
              label="Dias de Afastamento"
              type="number"
              value={diasAfastamento}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setDiasAfastamento(Math.max(1, value));
              }}
              inputProps={{ min: 1 }}
              required
              fullWidth
            />
          ) : (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Hora Inicial"
                type="time"
                value={horaInicial}
                onChange={(e) => setHoraInicial(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                required
                fullWidth
              />
              <TextField
                label="Hora Final"
                type="time"
                value={horaFinal}
                onChange={(e) => setHoraFinal(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                required
                fullWidth
              />
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <TextField
            label="CID (Código Internacional de Doenças)"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="Ex: A00.0"
            fullWidth
            helperText="Código opcional para identificação da doença"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={exibirCid}
                onChange={(e) => setExibirCid(e.target.checked)}
              />
            }
            label="Autorizo exibir o CID no atestado"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <TextField
            label="Local de Atendimento"
            value={localAtendimento}
            onChange={(e) => setLocalAtendimento(e.target.value)}
            placeholder="Ex: Consultório, Hospital, etc."
            fullWidth
          />
        </Box>

        <TextField
          label="Observações/Recomendações"
          multiline
          rows={6}
          fullWidth
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Digite observações e recomendações para o paciente..."
          helperText="Informações adicionais sobre o atestado"
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={loading}
        >
          Cancelar
        </Button>
        {!atestado && (
          <Button
            onClick={handleGerarAtestado}
            variant="contained"
            color="primary"
            startIcon={<DescriptionIcon />}
            disabled={!pacienteSelecionado || diasAfastamento <= 0 || loading || loadingDoutor || !doutorCompleto}
          >
            {loading ? 'Gerando...' : 'Gerar e Imprimir Atestado'}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          variant={atestado ? "contained" : "outlined"}
          disabled={!pacienteSelecionado || diasAfastamento <= 0 || loading}
        >
          {loading ? 'Salvando...' : atestado ? 'Atualizar' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

