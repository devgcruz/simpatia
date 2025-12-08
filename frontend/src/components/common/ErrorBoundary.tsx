import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Ops! Algo deu errado
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'Ocorreu um erro inesperado'}
          </Typography>
          <Button variant="contained" color="primary" onClick={this.handleReset}>
            Tentar novamente
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}






