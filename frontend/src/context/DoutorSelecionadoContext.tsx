// src/context/DoutorSelecionadoContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { IDoutor } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { getDoutores } from '../services/doutor.service';
import { toast } from 'sonner';

interface IDoutorSelecionadoContext {
  doutorSelecionado: IDoutor | null;
  setDoutorSelecionado: (doutor: IDoutor | null) => void;
  doutoresDisponiveis: IDoutor[];
  isLoading: boolean;
}

const DoutorSelecionadoContext = createContext<IDoutorSelecionadoContext | undefined>(undefined);

export const DoutorSelecionadoProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [doutorSelecionado, setDoutorSelecionadoState] = useState<IDoutor | null>(null);
  const [doutoresDisponiveis, setDoutoresDisponiveis] = useState<IDoutor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar doutores disponíveis quando o usuário for SECRETARIA
  useEffect(() => {
    const carregarDoutores = async () => {
      if (user?.role === 'SECRETARIA') {
        setIsLoading(true);
        try {
          const doutores = await getDoutores();
          setDoutoresDisponiveis(doutores);
          
          // Tentar carregar doutor do localStorage primeiro
          const doutorSalvo = localStorage.getItem('doutorSelecionado');
          if (doutorSalvo) {
            try {
              const doutor = JSON.parse(doutorSalvo);
              // Verificar se o doutor ainda está na lista de doutores disponíveis
              const doutorValido = doutores.find(d => d.id === doutor.id);
              if (doutorValido) {
                setDoutorSelecionadoState(doutorValido);
                setIsLoading(false);
                return;
              }
            } catch (err) {
              console.error('Erro ao carregar doutor selecionado do localStorage:', err);
            }
          }
          
          // Se não houver doutor salvo e houver doutores disponíveis
          if (doutores.length > 0) {
            // Se houver apenas 1 doutor, selecionar automaticamente
            if (doutores.length === 1) {
              setDoutorSelecionadoState(doutores[0]);
            }
            // Se houver mais de 1, não selecionar automaticamente (usuário deve escolher)
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Erro ao buscar doutores');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Para outros roles, não precisamos carregar doutores
        setIsLoading(false);
      }
    };

    carregarDoutores();
  }, [user?.role, user?.id]);

  // Limpar doutor selecionado quando o usuário não for mais SECRETARIA
  useEffect(() => {
    if (user?.role !== 'SECRETARIA') {
      setDoutorSelecionadoState(null);
      setDoutoresDisponiveis([]);
    }
  }, [user?.role]);

  // Persistir doutor selecionado no localStorage
  useEffect(() => {
    if (user?.role === 'SECRETARIA' && doutorSelecionado) {
      localStorage.setItem('doutorSelecionado', JSON.stringify(doutorSelecionado));
    } else {
      localStorage.removeItem('doutorSelecionado');
    }
  }, [doutorSelecionado, user?.role]);

  const setDoutorSelecionado = (doutor: IDoutor | null) => {
    setDoutorSelecionadoState(doutor);
  };

  const value: IDoutorSelecionadoContext = {
    doutorSelecionado,
    setDoutorSelecionado,
    doutoresDisponiveis,
    isLoading,
  };

  return (
    <DoutorSelecionadoContext.Provider value={value}>
      {children}
    </DoutorSelecionadoContext.Provider>
  );
};

export const useDoutorSelecionado = () => {
  const context = React.useContext(DoutorSelecionadoContext);
  if (context === undefined) {
    throw new Error('useDoutorSelecionado deve ser usado dentro de um DoutorSelecionadoProvider');
  }
  return context;
};

export default DoutorSelecionadoContext;

