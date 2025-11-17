import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, TextField, List, ListItem, ListItemText, IconButton, Tooltip, Divider, Typography,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { criarIndisponibilidade, atualizarIndisponibilidade, excluirIndisponibilidade, listarIndisponibilidadesDoDoutor, Indisponibilidade } from '../../services/indisponibilidade.service';
import { getDoutores } from '../../services/doutor.service';
import { IDoutor } from '../../types/models';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  doutorId?: number;
  doutorNome?: string;
  indisponibilidadeEditando?: Indisponibilidade | null;
}

export const IndisponibilidadeManagerModal: React.FC<Props> = ({ open, onClose, doutorId: initialDoutorId, doutorNome: initialDoutorNome, indisponibilidadeEditando }) => {
  const { user } = useAuth();
  const isDoutor = user?.role === 'DOUTOR';
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [selectedDoutorId, setSelectedDoutorId] = useState<number | ''>(initialDoutorId || '');
  const [itens, setItens] = useState<Indisponibilidade[]>([]);
  const [inicio, setInicio] = useState<string>('');
  const [fim, setFim] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const loadDoutores = async () => {
    try {
      const data = await getDoutores();
      setDoutores(data);
      // Se for DOUTOR, vincular automaticamente ao doutor logado
      if (isDoutor && user?.id) {
        setSelectedDoutorId(user.id);
      } else if (initialDoutorId && !selectedDoutorId) {
        // Se houver doutor inicial, definir como selecionado
        setSelectedDoutorId(initialDoutorId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar doutores');
    }
  };

  const load = async () => {
    if (!selectedDoutorId || selectedDoutorId === '') {
      setItens([]);
      return;
    }
    try {
      setLoading(true);
      const data = await listarIndisponibilidadesDoDoutor(selectedDoutorId);
      setItens(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar indisponibilidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDoutores();
      if (indisponibilidadeEditando) {
        // Se estiver editando uma indisponibilidade
        // Se for DOUTOR, sempre usar o próprio ID, senão usar o ID do doutor da indisponibilidade
        const doutorId = isDoutor && user?.id ? user.id : indisponibilidadeEditando.doutor?.id || '';
        setSelectedDoutorId(doutorId);
        const inicioDate = new Date(indisponibilidadeEditando.inicio);
        const fimDate = new Date(indisponibilidadeEditando.fim);
        // Formato para datetime-local: YYYY-MM-DDTHH:mm
        setInicio(new Date(inicioDate.getTime() - inicioDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        setFim(new Date(fimDate.getTime() - fimDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        setMotivo(indisponibilidadeEditando.motivo || '');
        setEditandoId(indisponibilidadeEditando.id);
      } else {
        // Limpar campos ao abrir modal novo
        setInicio('');
        setFim('');
        setMotivo('');
        setEditandoId(null);
        // Se for DOUTOR, vincular automaticamente ao doutor logado
        if (isDoutor && user?.id) {
          setSelectedDoutorId(user.id);
        } else if (initialDoutorId) {
          setSelectedDoutorId(initialDoutorId);
        }
      }
    }
  }, [open, indisponibilidadeEditando, initialDoutorId, isDoutor, user?.id]);

  useEffect(() => {
    if (open && selectedDoutorId && selectedDoutorId !== '') {
      load();
    } else {
      setItens([]);
    }
  }, [open, selectedDoutorId]);

  const handleCreate = async () => {
    // Se for DOUTOR, usar o próprio ID automaticamente
    const doutorIdToUse = isDoutor && user?.id ? user.id : selectedDoutorId;
    if (!doutorIdToUse || doutorIdToUse === '') {
      toast.error('Selecione um doutor');
      return;
    }
    if (!inicio || !fim) {
      toast.error('Informe início e fim da indisponibilidade');
      return;
    }
    try {
      if (editandoId) {
        // Atualizar
        await atualizarIndisponibilidade(editandoId, {
          doutorId: doutorIdToUse,
          inicio: new Date(inicio).toISOString(),
          fim: new Date(fim).toISOString(),
          motivo: motivo || undefined,
        });
        toast.success('Indisponibilidade atualizada');
      } else {
        // Criar
        await criarIndisponibilidade({
          doutorId: doutorIdToUse,
          inicio: new Date(inicio).toISOString(),
          fim: new Date(fim).toISOString(),
          motivo: motivo || undefined,
        });
        toast.success('Indisponibilidade criada');
      }
      setInicio('');
      setFim('');
      setMotivo('');
      setEditandoId(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Erro ao ${editandoId ? 'atualizar' : 'criar'} indisponibilidade`);
    }
  };

  const handleEdit = (indisponibilidade: Indisponibilidade) => {
    // Se for DOUTOR, sempre usar o próprio ID, senão usar o ID do doutor da indisponibilidade
    const doutorId = isDoutor && user?.id ? user.id : indisponibilidade.doutor?.id || '';
    setSelectedDoutorId(doutorId);
    const inicioDate = new Date(indisponibilidade.inicio);
    const fimDate = new Date(indisponibilidade.fim);
    setInicio(new Date(inicioDate.getTime() - inicioDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setFim(new Date(fimDate.getTime() - fimDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setMotivo(indisponibilidade.motivo || '');
    setEditandoId(indisponibilidade.id);
  };

  const handleCancelEdit = () => {
    setInicio('');
    setFim('');
    setMotivo('');
    setEditandoId(null);
  };

  const selectedDoutor = doutores.find((d) => d.id === selectedDoutorId);
  const doutorNome = selectedDoutor?.nome || initialDoutorNome || 'Doutor';

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
        {!isDoutor && (
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="doutor-select-label">Doutor</InputLabel>
            <Select
              labelId="doutor-select-label"
              value={selectedDoutorId}
              label="Doutor"
              onChange={(e) => setSelectedDoutorId(e.target.value as number)}
            >
              <MenuItem value="" disabled>
                <em>Selecione um doutor...</em>
              </MenuItem>
              {doutores.map((doutor) => (
                <MenuItem key={doutor.id} value={doutor.id}>
                  {doutor.nome} {doutor.especialidade ? `- ${doutor.especialidade}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {selectedDoutorId && selectedDoutorId !== '' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>
              Indisponibilidades de {doutorNome}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <TextField
                label="Início"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 260, flex: 1 }}
                fullWidth
              />
              <TextField
                label="Fim"
                type="datetime-local"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 260, flex: 1 }}
                fullWidth
              />
              <TextField
                label="Motivo (opcional)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                sx={{ minWidth: 260, flex: 1 }}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
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
            </Box>

            <Divider sx={{ my: 2 }} />
          </>
        )}

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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};


