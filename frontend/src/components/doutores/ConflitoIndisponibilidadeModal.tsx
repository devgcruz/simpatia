import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import {
  AgendamentoConflitante,
  SugestaoReagendamento,
  ConflitoIndisponibilidade,
} from '../../services/indisponibilidade.service';
import { updateAgendamento } from '../../services/agendamento.service';
import { toast } from 'sonner';
import moment from 'moment-timezone';

const BRAZIL_TZ = 'America/Sao_Paulo';

interface Props {
  open: boolean;
  onClose: () => void;
  conflito: ConflitoIndisponibilidade | null;
  onReagendamentoConcluido?: () => void;
  onIgnorarConflitos?: () => void;
}

export const ConflitoIndisponibilidadeModal: React.FC<Props> = ({
  open,
  onClose,
  conflito,
  onReagendamentoConcluido,
  onIgnorarConflitos,
}) => {
  const [reagendando, setReagendando] = useState<Record<number, boolean>>({});
  const [agendamentosReagendados, setAgendamentosReagendados] = useState<Set<number>>(new Set());

  if (!conflito) {
    return null;
  }

  const formatarDataHora = (dataHora: string) => {
    return moment(dataHora).tz(BRAZIL_TZ).format('DD/MM/YYYY [às] HH:mm');
  };

  const formatarData = (data: string) => {
    return moment(data).format('DD/MM/YYYY');
  };

  const handleReagendar = async (
    agendamento: AgendamentoConflitante,
    data: string,
    horario: string
  ) => {
    if (reagendando[agendamento.id]) {
      return;
    }

    try {
      setReagendando((prev) => ({ ...prev, [agendamento.id]: true }));

      // Criar data/hora completa combinando data e horário
      const [hora, minuto] = horario.split(':');
      const novaDataHora = moment.tz(data, BRAZIL_TZ)
        .hour(parseInt(hora, 10))
        .minute(parseInt(minuto, 10))
        .second(0)
        .millisecond(0)
        .toISOString();

      // Reagendar o agendamento
      await updateAgendamento(agendamento.id, {
        dataHora: novaDataHora,
      });

      toast.success(
        `Agendamento de ${agendamento.pacienteNome} reagendado para ${formatarData(data)} às ${horario}`
      );

      setAgendamentosReagendados((prev) => {
        const novo = new Set([...prev, agendamento.id]);
        // Verificar se todos os agendamentos com sugestões foram reagendados
        // Se sim, notificar para tentar criar a indisponibilidade novamente
        if (onReagendamentoConcluido && novo.size === agendamentosComSugestoes.length) {
          // Pequeno delay para garantir que o backend processou
          setTimeout(() => {
            onReagendamentoConcluido();
          }, 500);
        }
        return novo;
      });
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          `Erro ao reagendar agendamento de ${agendamento.pacienteNome}`
      );
    } finally {
      setReagendando((prev) => {
        const novo = { ...prev };
        delete novo[agendamento.id];
        return novo;
      });
    }
  };

  const agendamentosComSugestoes = conflito.agendamentosConflitantes.filter((agendamento) => {
    const sugestoes = conflito.sugestoesReagendamento[agendamento.id.toString()];
    return sugestoes && sugestoes.length > 0;
  });

  const agendamentosSemSugestoes = conflito.agendamentosConflitantes.filter((agendamento) => {
    const sugestoes = conflito.sugestoesReagendamento[agendamento.id.toString()];
    return !sugestoes || sugestoes.length === 0;
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Resolver Conflitos</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>{conflito.agendamentosConflitantes.length}</strong> agendamento(s) conflitante(s)
            no período especificado. Você pode reagendar automaticamente ou ignorar os conflitos.
          </Typography>
        </Alert>

        {agendamentosComSugestoes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Agendamentos com Sugestões de Reagendamento
            </Typography>
            {agendamentosComSugestoes.map((agendamento) => {
              const sugestoes = conflito.sugestoesReagendamento[agendamento.id.toString()] || [];
              const foiReagendado = agendamentosReagendados.has(agendamento.id);
              const estaReagendando = reagendando[agendamento.id];

              return (
                <Accordion key={agendamento.id} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <PersonIcon color="primary" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {agendamento.pacienteNome}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatarDataHora(agendamento.dataHora)} • {agendamento.servicoNome} (
                          {agendamento.servicoDuracaoMin} min)
                        </Typography>
                      </Box>
                      {foiReagendado && (
                        <Chip label="Reagendado" color="success" size="small" />
                      )}
                      {estaReagendando && <CircularProgress size={20} />}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {foiReagendado ? (
                      <Alert severity="success">
                        Este agendamento foi reagendado com sucesso!
                      </Alert>
                    ) : (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Sugestões de horários alternativos:
                        </Typography>
                        <Grid container spacing={2}>
                          {sugestoes.map((sugestao, idx) => (
                            <Grid item xs={12} key={idx}>
                              <Card variant="outlined">
                                <CardContent>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      mb: 1,
                                    }}
                                  >
                                    <EventIcon fontSize="small" color="primary" />
                                    <Typography variant="subtitle2" fontWeight="bold">
                                      {formatarData(sugestao.data)}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {sugestao.horariosDisponiveis.map((horario) => (
                                      <Chip
                                        key={horario}
                                        icon={<ScheduleIcon />}
                                        label={horario}
                                        onClick={() =>
                                          handleReagendar(agendamento, sugestao.data, horario)
                                        }
                                        disabled={estaReagendando}
                                        color="primary"
                                        variant="outlined"
                                        sx={{ cursor: 'pointer' }}
                                      />
                                    ))}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}

        {agendamentosSemSugestoes.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Agendamentos Sem Sugestões Disponíveis
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Os seguintes agendamentos conflitam com a indisponibilidade, mas não há horários
              alternativos disponíveis no momento. Você precisará reagendá-los manualmente ou
              ignorar os conflitos.
            </Alert>
            <List>
              {agendamentosSemSugestoes.map((agendamento) => (
                <ListItem key={agendamento.id}>
                  <ListItemText
                    primary={agendamento.pacienteNome}
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          {formatarDataHora(agendamento.dataHora)}
                        </Typography>
                        {' • '}
                        <Typography variant="body2" component="span">
                          {agendamento.servicoNome} ({agendamento.servicoDuracaoMin} min)
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancelar
        </Button>
        {onIgnorarConflitos && (
          <Button onClick={onIgnorarConflitos} variant="outlined" color="warning">
            Ignorar Conflitos
          </Button>
        )}
        <Button
          onClick={() => {
            onClose();
            if (onReagendamentoConcluido) {
              onReagendamentoConcluido();
            }
          }}
          variant="contained"
          color="primary"
        >
          Continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

