import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { IDoutor } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (doutor: IDoutor) => void;
  doutores: IDoutor[];
  title?: string;
}

export const SelectDoutorModal: React.FC<Props> = ({
  open,
  onClose,
  onSelect,
  doutores,
  title = 'Selecionar Agenda',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDoutores = useMemo(() => {
    if (!searchTerm.trim()) {
      return doutores;
    }
    const term = searchTerm.toLowerCase().trim();
    return doutores.filter(
      (doutor) =>
        doutor.nome.toLowerCase().includes(term) ||
        doutor.email.toLowerCase().includes(term) ||
        (doutor.especialidade && doutor.especialidade.toLowerCase().includes(term))
    );
  }, [doutores, searchTerm]);

  // Limitar a exibição a 5 doutores
  const displayedDoutores = filteredDoutores.slice(0, 5);

  const handleSelect = (doutor: IDoutor) => {
    onSelect(doutor);
    onClose();
    // Limpar busca ao fechar
    setSearchTerm('');
  };

  const handleClose = () => {
    onClose();
    // Limpar busca ao fechar
    setSearchTerm('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="select-doutor-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="select-doutor-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {doutores.length === 0 ? (
          <Typography color="text.secondary">Nenhum doutor cadastrado.</Typography>
        ) : (
          <>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Buscar doutor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2, mt: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            {filteredDoutores.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                Nenhum doutor encontrado.
              </Typography>
            ) : (
              <List
                sx={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  '& .MuiListItem-root': {
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                {displayedDoutores.map((doutor) => (
                  <ListItem key={doutor.id} disablePadding>
                    <ListItemButton onClick={() => handleSelect(doutor)}>
                      <ListItemText
                        primary={doutor.nome}
                        secondary={doutor.especialidade || doutor.email}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            {filteredDoutores.length > 5 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Mostrando 5 de {filteredDoutores.length} doutores encontrados
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
};

