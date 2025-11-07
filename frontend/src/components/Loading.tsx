import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ message = 'Carregando...' }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <CircularProgress
          size={60}
          sx={{
            color: theme.palette.primary.main,
          }}
        />
      </motion.div>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export default Loading;

