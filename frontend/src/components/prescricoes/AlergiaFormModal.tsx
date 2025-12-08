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
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import MedicationIcon from '@mui/icons-material/Medication';
import SearchIcon from '@mui/icons-material/Search';
import { IPaciente, IMedicamento } from '../../types/models';
import { getMedicamentos, getPrincipiosAtivos, verificarPrincipioAtivoExiste } from '../../services/medicamento.service';
import { createAlergia, IAlergiaMedicamento } from '../../services/alergia.service';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  paciente: IPaciente | null;
  onAlergiaCadastrada?: () => void;
}

export const AlergiaFormModal: React.FC<Props> = ({ open, onClose, paciente, onAlergiaCadastrada }) => {
  const [nomeMedicamento, setNomeMedicamento] = useState('');
  const [principioAtivo, setPrincipioAtivo] = useState('');
  const [principioAtivoInput, setPrincipioAtivoInput] = useState('');
  const [principiosAtivosSugeridos, setPrincipiosAtivosSugeridos] = useState<string[]>([]);
  const [loadingPrincipiosAtivos, setLoadingPrincipiosAtivos] = useState(false);
  const [classeQuimica, setClasseQuimica] = useState('');
  const [excipientes, setExcipientes] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [modoSelecao, setModoSelecao] = useState<'principio' | 'medicamento'>('principio');
  const [buscaMedicamento, setBuscaMedicamento] = useState('');
  const [medicamentosEncontrados, setMedicamentosEncontrados] = useState<IMedicamento[]>([]);
  const [medicamentoSelecionado, setMedicamentoSelecionado] = useState<IMedicamento | null>(null);
  const [loadingMedicamentos, setLoadingMedicamentos] = useState(false);
  const [principioAtivoValido, setPrincipioAtivoValido] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      setNomeMedicamento('');
      setPrincipioAtivo('');
      setPrincipioAtivoInput('');
      setPrincipiosAtivosSugeridos([]);
      setClasseQuimica('');
      setExcipientes('');
      setObservacoes('');
      setModoSelecao('principio');
      setBuscaMedicamento('');
      setMedicamentosEncontrados([]);
      setMedicamentoSelecionado(null);
      setPrincipioAtivoValido(null);
    }
  }, [open]);

  useEffect(() => {
    if (medicamentoSelecionado) {
      setNomeMedicamento(medicamentoSelecionado.nomeProduto);
      if (medicamentoSelecionado.principioAtivo) {
        setPrincipioAtivo(medicamentoSelecionado.principioAtivo);
        setPrincipioAtivoInput(medicamentoSelecionado.principioAtivo);
        setPrincipioAtivoValido(true);
      }
      setClasseQuimica(medicamentoSelecionado.classeTerapeutica || '');
    }
  }, [medicamentoSelecionado]);

  const buscarPrincipiosAtivos = async (busca: string) => {
    if (!busca.trim() || busca.length < 2) {
      setPrincipiosAtivosSugeridos([]);
      return;
    }

    try {
      setLoadingPrincipiosAtivos(true);
      const principios = await getPrincipiosAtivos(busca.trim());
      setPrincipiosAtivosSugeridos(principios);
    } catch (error: any) {
      console.error('Erro ao buscar princípios ativos:', error);
      setPrincipiosAtivosSugeridos([]);
    } finally {
      setLoadingPrincipiosAtivos(false);
    }
  };

  const verificarPrincipioAtivo = async (principio: string) => {
    if (!principio.trim()) {
      setPrincipioAtivoValido(null);
      return;
    }

    try {
      const existe = await verificarPrincipioAtivoExiste(principio.trim());
      setPrincipioAtivoValido(existe);
    } catch (error) {
      console.error('Erro ao verificar princípio ativo:', error);
      setPrincipioAtivoValido(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (modoSelecao === 'principio' && principioAtivoInput) {
        buscarPrincipiosAtivos(principioAtivoInput);
        if (principioAtivoInput.length >= 3) {
          verificarPrincipioAtivo(principioAtivoInput);
        } else {
          setPrincipioAtivoValido(null);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [principioAtivoInput, modoSelecao]);

  const buscarMedicamentos = async () => {
    if (!buscaMedicamento.trim()) {
      setMedicamentosEncontrados([]);
      return;
    }

    try {
      setLoadingMedicamentos(true);
      const resultado = await getMedicamentos({
        nomeProduto: buscaMedicamento.trim(),
        take: 10,
      });
      setMedicamentosEncontrados(resultado.medicamentos);
    } catch (error: any) {
      console.error('Erro ao buscar medicamentos:', error);
    } finally {
      setLoadingMedicamentos(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (modoSelecao === 'medicamento') {
        buscarMedicamentos();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [buscaMedicamento, modoSelecao]);

  const handleSubmit = async () => {
    if (!principioAtivo.trim()) {
      toast.error('Princípio ativo é obrigatório para cadastrar alergia');
      return;
    }

    if (principioAtivoValido === false) {
      toast.error('O princípio ativo informado não existe no banco de dados. Por favor, selecione um princípio ativo válido.');
      return;
    }

    if (principioAtivoValido === null && principioAtivoInput.trim().length >= 3) {
      // Verificar novamente antes de salvar
      const existe = await verificarPrincipioAtivoExiste(principioAtivo.trim());
      if (!existe) {
        toast.error('O princípio ativo informado não existe no banco de dados. Por favor, selecione um princípio ativo válido.');
        return;
      }
    }

    if (!paciente) {
      toast.error('Paciente não selecionado');
      return;
    }

    // Garantir que o nome do medicamento seja preenchido
    const nomeMedicamentoFinal = nomeMedicamento.trim() || principioAtivo.trim();

    setLoading(true);
    try {
      await createAlergia({
        pacienteId: paciente.id,
        medicamentoId: medicamentoSelecionado?.id,
        nomeMedicamento: nomeMedicamentoFinal,
        principioAtivo: principioAtivo.trim(),
        classeQuimica: classeQuimica.trim() || undefined,
        excipientes: excipientes.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });

      toast.success('Alergia cadastrada com sucesso');
      onClose();
      if (onAlergiaCadastrada) {
        onAlergiaCadastrada();
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar alergia:', error);
      toast.error(error.response?.data?.message || 'Erro ao cadastrar alergia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Cadastrar Alergia a Medicamento</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {paciente && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Paciente: <strong>{paciente.nome}</strong>
          </Alert>
        )}

        {/* Seleção do modo de busca */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Como deseja cadastrar a alergia?
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              icon={<SearchIcon />}
              label="Buscar por Princípio Ativo"
              onClick={() => setModoSelecao('principio')}
              color={modoSelecao === 'principio' ? 'primary' : 'default'}
              variant={modoSelecao === 'principio' ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              icon={<MedicationIcon />}
              label="Selecionar de um Medicamento"
              onClick={() => setModoSelecao('medicamento')}
              color={modoSelecao === 'medicamento' ? 'primary' : 'default'}
              variant={modoSelecao === 'medicamento' ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Modo: Buscar por Princípio Ativo */}
        {modoSelecao === 'principio' && (
          <Box>
            <Autocomplete
              freeSolo
              options={principiosAtivosSugeridos}
              inputValue={principioAtivoInput}
              onInputChange={(_, newValue) => {
                setPrincipioAtivoInput(newValue);
                setPrincipioAtivo(newValue);
                if (!newValue) {
                  setPrincipioAtivoValido(null);
                }
              }}
              onChange={async (_, newValue) => {
                if (newValue) {
                  setPrincipioAtivo(newValue);
                  setPrincipioAtivoInput(newValue);
                  // Validar imediatamente quando selecionar da lista
                  const existe = await verificarPrincipioAtivoExiste(newValue);
                  setPrincipioAtivoValido(existe);
                } else {
                  setPrincipioAtivo('');
                  setPrincipioAtivoInput('');
                  setPrincipioAtivoValido(null);
                }
              }}
              loading={loadingPrincipiosAtivos}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Princípio Ativo"
                  placeholder="Digite o princípio ativo (ex: amoxicilina, paracetamol)"
                  required
                  error={principioAtivoValido === false}
                  helperText={
                    principioAtivoValido === false
                      ? 'Este princípio ativo não existe no banco de dados'
                      : principioAtivoValido === true
                      ? '✓ Princípio ativo válido'
                      : 'Digite pelo menos 2 caracteres para ver sugestões. Apenas princípios ativos cadastrados no banco podem ser usados.'
                  }
                  sx={{ mb: 2 }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Typography variant="body2">{option}</Typography>
                </Box>
              )}
            />

            {principioAtivo && principioAtivoValido === true && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Princípio ativo válido encontrado no banco de dados.
              </Alert>
            )}

            {principioAtivo && principioAtivoValido === false && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Este princípio ativo não existe no banco de dados. Por favor, selecione um princípio ativo válido das sugestões ou use a opção "Selecionar de um Medicamento".
              </Alert>
            )}

            <TextField
              label="Nome do Medicamento (opcional)"
              fullWidth
              value={nomeMedicamento}
              onChange={(e) => setNomeMedicamento(e.target.value)}
              margin="normal"
              helperText="Nome comercial do medicamento, se conhecido"
            />
          </Box>
        )}

        {/* Modo: Selecionar de um Medicamento */}
        {modoSelecao === 'medicamento' && (
          <Box>
            <Autocomplete
              options={medicamentosEncontrados}
              getOptionLabel={(option) => option.nomeProduto}
              value={medicamentoSelecionado}
              inputValue={buscaMedicamento}
              onInputChange={(_, newValue) => {
                setBuscaMedicamento(newValue);
                if (!newValue) {
                  setMedicamentoSelecionado(null);
                }
              }}
              onChange={(_, newValue) => {
                setMedicamentoSelecionado(newValue);
              }}
              loading={loadingMedicamentos}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar Medicamento"
                  placeholder="Digite o nome do medicamento"
                  helperText="Selecione um medicamento para usar seu princípio ativo"
                  sx={{ mb: 2 }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {option.nomeProduto}
                    </Typography>
                    {option.principioAtivo && (
                      <Typography variant="caption" color="text.secondary">
                        Princípio ativo: {option.principioAtivo.substring(0, 80)}
                        {option.principioAtivo.length > 80 ? '...' : ''}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            />

            {medicamentoSelecionado && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Medicamento selecionado:</strong> {medicamentoSelecionado.nomeProduto}
                </Typography>
                {medicamentoSelecionado.principioAtivo && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Princípio ativo:</strong> {medicamentoSelecionado.principioAtivo}
                  </Typography>
                )}
              </Alert>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Campos adicionais */}
        <TextField
          label="Classe Química/Farmacológica (opcional)"
          fullWidth
          value={classeQuimica}
          onChange={(e) => setClasseQuimica(e.target.value)}
          margin="normal"
          multiline
          rows={2}
          helperText="Para reatividade cruzada (ex: penicilina → cefalosporina)"
        />

        <TextField
          label="Classe Química/Farmacológica (opcional)"
          fullWidth
          value={classeQuimica}
          onChange={(e) => setClasseQuimica(e.target.value)}
          margin="normal"
          multiline
          rows={2}
          helperText="Para reatividade cruzada (ex: penicilina → cefalosporina)"
        />

        <TextField
          label="Excipientes/Aditivos (opcional)"
          fullWidth
          value={excipientes}
          onChange={(e) => setExcipientes(e.target.value)}
          margin="normal"
          multiline
          rows={2}
          helperText="Ex: látex, lactose, corantes, propilenoglicol, etc."
        />

        <TextField
          label="Observações (opcional)"
          fullWidth
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          margin="normal"
          multiline
          rows={3}
          helperText="Observações adicionais sobre a alergia"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="warning" 
          disabled={loading || !principioAtivo.trim() || principioAtivoValido === false}
        >
          {loading ? 'Salvando...' : 'Cadastrar Alergia'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

