import React from 'react';
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
} from '@mui/material';
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
  const handleSelect = (doutor: IDoutor) => {
    onSelect(doutor);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="select-doutor-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="select-doutor-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {doutores.length === 0 ? (
          <Typography color="text.secondary">Nenhum doutor cadastrado.</Typography>
        ) : (
          <List>
            {doutores.map((doutor) => (
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
};

