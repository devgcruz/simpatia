import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, TextField, List, ListItem, ListItemText, IconButton, Tooltip, Divider, Typography,
  Alert, FormControlLabel, Checkbox, Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { criarIndisponibilidade, atualizarIndisponibilidade, excluirIndisponibilidade, listarIndisponibilidadesDoDoutor, Indisponibilidade, ConflitoIndisponibilidade } from '../../services/indisponibilidade.service';
import { ConflitoIndisponibilidadeModal } from './ConflitoIndisponibilidadeModal';
import { useAuth } from '../../hooks/useAuth';
import { useDoutorSelecionado } from '../../context/DoutorSelecionadoContext';
import { toast } from 'sonner';
import moment from 'moment-timezone';

const BRAZIL_TZ = 'America/Sao_Paulo';

interface Props {
  open: boolean;
  onClose: () => void;
  doutorId?: number;
  doutorNome?: string;
  indisponibilidadeEditando?: Indisponibilidade | null;
}

export const IndisponibilidadeManagerModal: React.FC<Props> = ({ open, onClose, doutorId: initialDoutorId, doutorNome: initialDoutorNome, indisponibilidadeEditando }) => {
  const { user } = useAuth();
  const { doutorSelecionado } = useDoutorSelecionado();
  const isDoutor = user?.role === 'DOUTOR';
  const isSecretaria = user?.role === 'SECRETARIA';
  
  // Determina qual doutor usar: do contexto, do prop, ou do usuário logado
  const { selectedDoutorId, doutorNome } = useMemo(() => {
    let doutor: { id: number; nome: string } | null = null;
    
    if (isDoutor && user?.id) {
      // Para DOUTOR, usar o ID do usuário logado e o nome do prop ou genérico
      doutor = { id: user.id, nome: initialDoutorNome || 'Doutor' };
    } else if (isSecretaria && doutorSelecionado) {
      // Para SECRETARIA, usar o doutor selecionado no contexto
      doutor = { id: doutorSelecionado.id, nome: doutorSelecionado.nome };
    } else if (initialDoutorId) {
      // Fallback para o prop passado
      doutor = { id: initialDoutorId, nome: initialDoutorNome || 'Doutor' };
    }
    
    return {
      selectedDoutorId: doutor?.id || '',
      doutorNome: doutor?.nome || 'Doutor'
    };
  }, [isDoutor, isSecretaria, user?.id, doutorSelecionado, initialDoutorId, initialDoutorNome]);
  
  const [itens, setItens] = useState<Indisponibilidade[]>([]);
  const [inicio, setInicio] = useState<string>('');
  const [fim, setFim] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [apenasUmHorario, setApenasUmHorario] = useState<boolean>(false);
  const [conflito, setConflito] = useState<ConflitoIndisponibilidade | null>(null);
  const [mostrarModalConflito, setMostrarModalConflito] = useState<boolean>(false);
  const [dadosPendentes, setDadosPendentes] = useState<{
    doutorId: number;
    inicio: string;
    fim: string;
    motivo?: string;
    editandoId?: number | null;
  } | null>(null);

  const load = async () => {
    if (!selectedDoutorId || selectedDoutorId === '') {
      setItens([]);
      return;
    }
    try {
      setLoading(true);
      const data = await listarIndisponibilidadesDoDoutor(selectedDoutorId as number);
      setItens(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar indisponibilidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (indisponibilidadeEditando) {
        // Se estiver editando uma indisponibilidade
        setInicio(moment(indisponibilidadeEditando.inicio).tz(BRAZIL_TZ).format('YYYY-MM-DDTHH:mm'));
        setFim(moment(indisponibilidadeEditando.fim).tz(BRAZIL_TZ).format('YYYY-MM-DDTHH:mm'));
        setMotivo(indisponibilidadeEditando.motivo || '');
        setEditandoId(indisponibilidadeEditando.id);
      } else {
        // Limpar campos ao abrir modal novo
        setInicio('');
        setFim('');
        setMotivo('');
        setEditandoId(null);
        setApenasUmHorario(false);
      }
    }
  }, [open, indisponibilidadeEditando]);

  useEffect(() => {
    if (open && selectedDoutorId && selectedDoutorId !== '') {
      load();
    } else {
      setItens([]);
    }
  }, [open, selectedDoutorId, doutorSelecionado?.id, initialDoutorId]);

  // Função para converter datetime-local para ISO preservando o horário brasileiro
  const toISOStringLocal = (datetimeLocal: string): string => {
    return moment.tz(datetimeLocal, BRAZIL_TZ).toISOString();
  };

  // Quando apenas um horário está marcado e o início muda, definir fim automaticamente
  const handleInicioChange = (value: string) => {
    setInicio(value);
    if (apenasUmHorario && value) {
      // Adicionar 30 minutos ao horário inicial
      const inicioMoment = moment.tz(value, BRAZIL_TZ);
      const fimMoment = inicioMoment.clone().add(30, 'minutes');
      setFim(fimMoment.format('YYYY-MM-DDTHH:mm'));
    }
  };

  const handleCreate = async () => {
    if (!selectedDoutorId || selectedDoutorId === '') {
      toast.error('Nenhum doutor selecionado. Por favor, selecione um doutor no menu lateral.');
      return;
    }
    if (!inicio) {
      toast.error('Informe o horário de início da indisponibilidade');
      return;
    }
    
    // Se for apenas um horário, sempre calcular o fim automaticamente (início + 30 minutos)
    let fimFinal = fim;
    if (apenasUmHorario && inicio) {
      const inicioMoment = moment.tz(inicio, BRAZIL_TZ);
      fimFinal = inicioMoment.clone().add(30, 'minutes').format('YYYY-MM-DDTHH:mm');
    }
    
    if (!fimFinal) {
      toast.error('Informe o horário de fim da indisponibilidade');
      return;
    }
    try {
      if (editandoId) {
        // Atualizar
        await atualizarIndisponibilidade(editandoId, {
          doutorId: selectedDoutorId as number,
          inicio: toISOStringLocal(inicio),
          fim: toISOStringLocal(fimFinal),
          motivo: motivo || undefined,
        });
        toast.success('Indisponibilidade atualizada');
      } else {
        // Criar
        await criarIndisponibilidade({
          doutorId: selectedDoutorId as number,
          inicio: toISOStringLocal(inicio),
          fim: toISOStringLocal(fimFinal),
          motivo: motivo || undefined,
        });
        toast.success('Indisponibilidade criada');
      }
      setInicio('');
      setFim('');
      setMotivo('');
      setEditandoId(null);
      await load();
      setDadosPendentes(null);
      onClose(); // Fechar modal após sucesso
    } catch (err: any) {
      // Verificar se é um erro de conflito de agendamentos
      if (err.response?.status === 409 && err.response?.data?.code === 'CONFLITO_AGENDAMENTOS') {
        // Salvar dados da indisponibilidade que estava sendo criada
        setDadosPendentes({
          doutorId: selectedDoutorId as number,
          inicio: toISOStringLocal(inicio),
          fim: toISOStringLocal(fimFinal),
          motivo: motivo || undefined,
          editandoId: editandoId,
        });
        // Exibir modal de conflitos
        setConflito(err.response.data);
        setMostrarModalConflito(true);
      } else {
        toast.error(err.response?.data?.message || `Erro ao ${editandoId ? 'atualizar' : 'criar'} indisponibilidade`);
      }
    }
  };

  const criarIndisponibilidadeIgnorandoConflitos = async () => {
    if (!dadosPendentes) return;

    try {
      if (dadosPendentes.editandoId) {
        await atualizarIndisponibilidade(dadosPendentes.editandoId, {
          doutorId: dadosPendentes.doutorId,
          inicio: dadosPendentes.inicio,
          fim: dadosPendentes.fim,
          motivo: dadosPendentes.motivo,
        }, true); // ignorarConflitos = true
        toast.success('Indisponibilidade atualizada (conflitos ignorados)');
      } else {
        await criarIndisponibilidade({
          doutorId: dadosPendentes.doutorId,
          inicio: dadosPendentes.inicio,
          fim: dadosPendentes.fim,
          motivo: dadosPendentes.motivo,
        }, true); // ignorarConflitos = true
        toast.success('Indisponibilidade criada (conflitos ignorados)');
      }
      
      setInicio('');
      setFim('');
      setMotivo('');
      setEditandoId(null);
      setDadosPendentes(null);
      await load();
      setMostrarModalConflito(false);
      setConflito(null);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar indisponibilidade');
    }
  };

  const handleEdit = (indisponibilidade: Indisponibilidade) => {
    setInicio(moment(indisponibilidade.inicio).tz(BRAZIL_TZ).format('YYYY-MM-DDTHH:mm'));
    setFim(moment(indisponibilidade.fim).tz(BRAZIL_TZ).format('YYYY-MM-DDTHH:mm'));
    setMotivo(indisponibilidade.motivo || '');
    setEditandoId(indisponibilidade.id);
  };

  const handleCancelEdit = () => {
    setInicio('');
    setFim('');
    setMotivo('');
    setEditandoId(null);
    setApenasUmHorario(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await excluirIndisponibilidade(id);
      toast.success('Indisponibilidade removida');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao remover indisponibilidade');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Gerenciar Indisponibilidades</DialogTitle>
      <DialogContent>
        {!selectedDoutorId || selectedDoutorId === '' ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {isSecretaria 
              ? 'Por favor, selecione um doutor no menu lateral antes de gerenciar indisponibilidades.'
              : 'Nenhum doutor selecionado.'}
          </Alert>
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Indisponibilidades de {doutorNome}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={apenasUmHorario}
                    onChange={(e) => {
                      setApenasUmHorario(e.target.checked);
                      // Se marcou "apenas um horário" e já tem início, calcular fim automaticamente
                      if (e.target.checked && inicio) {
                        const inicioMoment = moment.tz(inicio, BRAZIL_TZ);
                        const fimMoment = inicioMoment.clone().add(30, 'minutes');
                        setFim(fimMoment.format('YYYY-MM-DDTHH:mm'));
                      } else if (!e.target.checked) {
                        // Se desmarcou, limpar o fim para permitir entrada manual
                        setFim('');
                      }
                    }}
                  />
                }
                label="Indisponível apenas para um horário (30 minutos)"
              />
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={apenasUmHorario ? "Horário" : "Início"}
                    type="datetime-local"
                    value={inicio}
                    onChange={(e) => handleInicioChange(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    helperText={apenasUmHorario ? "Será bloqueado por 30 minutos a partir deste horário" : ""}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Fim"
                    type="datetime-local"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    disabled={apenasUmHorario}
                    helperText={apenasUmHorario ? "Calculado automaticamente (+30 min)" : ""}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Motivo (opcional)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {editandoId ? (
                      <>
                        <Button variant="outlined" onClick={handleCancelEdit} fullWidth>
                          Cancelar Edição
                        </Button>
                        <Button variant="contained" onClick={handleCreate} disabled={loading} fullWidth>
                          Atualizar Indisponibilidade
                        </Button>
                      </>
                    ) : (
                      <Button variant="contained" onClick={handleCreate} disabled={loading} fullWidth>
                        Adicionar Indisponibilidade
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />

            {itens.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nenhuma indisponibilidade cadastrada.</Typography>
            ) : (
              <List dense>
                {itens.map((i) => (
                  <ListItem
                    key={i.id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Editar">
                          <IconButton edge="end" onClick={() => handleEdit(i)} size="small">
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover">
                          <IconButton edge="end" onClick={() => handleDelete(i.id)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={`${new Date(i.inicio).toLocaleString('pt-BR')} — ${new Date(i.fim).toLocaleString('pt-BR')}`}
                      secondary={i.motivo || ''}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>

      <ConflitoIndisponibilidadeModal
        open={mostrarModalConflito}
        onClose={() => {
          setMostrarModalConflito(false);
          setConflito(null);
          setDadosPendentes(null);
        }}
        conflito={conflito}
        onReagendamentoConcluido={async () => {
          // Após reagendamento, tentar criar a indisponibilidade novamente
          if (dadosPendentes) {
            try {
              if (dadosPendentes.editandoId) {
                await atualizarIndisponibilidade(dadosPendentes.editandoId, {
                  doutorId: dadosPendentes.doutorId,
                  inicio: dadosPendentes.inicio,
                  fim: dadosPendentes.fim,
                  motivo: dadosPendentes.motivo,
                });
                toast.success('Indisponibilidade atualizada com sucesso!');
              } else {
                await criarIndisponibilidade({
                  doutorId: dadosPendentes.doutorId,
                  inicio: dadosPendentes.inicio,
                  fim: dadosPendentes.fim,
                  motivo: dadosPendentes.motivo,
                });
                toast.success('Indisponibilidade criada com sucesso!');
              }
              
              setInicio('');
              setFim('');
              setMotivo('');
              setEditandoId(null);
              setDadosPendentes(null);
              await load();
              setMostrarModalConflito(false);
              setConflito(null);
              onClose();
            } catch (err: any) {
              // Se ainda houver conflitos após reagendar, mostrar novamente
              if (err.response?.status === 409 && err.response?.data?.code === 'CONFLITO_AGENDAMENTOS') {
                setConflito(err.response.data);
              } else {
                toast.error(err.response?.data?.message || 'Erro ao criar indisponibilidade');
              }
            }
          }
        }}
        onIgnorarConflitos={criarIndisponibilidadeIgnorandoConflitos}
      />
    </Dialog>
  );
};


