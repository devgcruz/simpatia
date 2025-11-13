import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const ChatPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Fila de Atendimento Humano
      </Typography>
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="body1">
          Aqui será exibida a lista de pacientes que solicitaram atendimento humano (Handoff) e a
          interface de chat para respondê-los.
        </Typography>
      </Paper>
    </Box>
  );
};


