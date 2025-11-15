import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  confirmButtonColor?: 'error' | 'warning' | 'primary' | 'secondary' | 'success' | 'info';
}

export const ConfirmationModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Excluir',
  confirmButtonColor = 'error',
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onConfirm} color={confirmButtonColor} autoFocus>
          {confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
