import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { IServico } from '../types/models';
import { getServicos, createServico, updateServico, deleteServico } from '../services/servico.service';
import { ServicoFormModal } from '../components/servicos/ServicoFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { toast } from 'sonner';

export const ServicosPage: React.FC = () => {
  const [servicos, setServicos] = useState<IServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<IServico | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  const fetchServicos = async () => {
    try {
      setLoading(true);
      const data = await getServicos();
      console.log('[ServicosPage] Dados brutos recebidos da API:', data);
      const normalized = data.map((servico) => ({
        ...servico,
        preco:
          typeof servico.preco === 'number'
            ? servico.preco
            : Number(servico.preco) || 0,
      }));
      console.log('[ServicosPage] Dados normalizados para a grid:', normalized);
      setServicos(normalized);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar serviços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicos();
  }, []);

  const handleOpenModal = (servico: IServico | null = null) => {
    setEditingServico(servico);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingServico(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: Partial<Omit<IServico, 'id' | 'clinicaId'>>) => {
    try {
      if (editingServico) {
        await updateServico(editingServico.id, data);
      } else {
        await createServico(data as Omit<IServico, 'id' | 'clinicaId'>);
      }
      await fetchServicos();
      handleCloseModal();
      toast.success(editingServico ? 'Serviço atualizado com sucesso!' : 'Serviço criado com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar serviço');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;

    try {
      await deleteServico(itemToDeleteId);
      await fetchServicos();
      setItemToDeleteId(null);
      toast.success('Serviço excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar serviço');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IServico>[] = [
    {
      field: 'nome',
      headerName: 'Nome',
      flex: 1,
    },
    {
      field: 'duracaoMin',
      headerName: 'Duração (min)',
      width: 150,
      type: 'number',
    },
    {
      field: 'preco',
      headerName: 'Preço (R$)',
      width: 120,
      type: 'number',
      valueFormatter: (value: number | null) => {
        if (typeof value !== 'number') {
          return 'R$ --';
        }

        return `R$ ${value.toFixed(2)}`;
      },
    },
    {
      field: 'descricao',
      headerName: 'Descrição',
      flex: 2,
      sortable: false,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 120,
      getActions: ({ row }) => {
        const servico = row as IServico;
        return [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Editar"
            onClick={() => handleOpenModal(servico)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Excluir"
            onClick={() => handleDelete(servico.id)}
          />,
        ];
      },
    },
  ];

  const filteredServicos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return servicos;
    return servicos.filter((servico) => {
      const nome = servico.nome?.toLowerCase() ?? '';
      const descricao = servico.descricao?.toLowerCase() ?? '';
      const preco = typeof servico.preco === 'number' ? servico.preco.toString() : `${servico.preco}`;
      const duracao = servico.duracaoMin?.toString() ?? '';
      return (
        nome.includes(term) ||
        descricao.includes(term) ||
        preco.includes(term) ||
        duracao.includes(term)
      );
    });
  }, [servicos, searchTerm]);

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Gerir Serviços</Typography>
        <Button variant="contained" onClick={() => handleOpenModal()}>
          Novo Serviço
        </Button>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <TextField
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Pesquisar serviço"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
      </Box>

      <Paper
        sx={{
          height: 600,
          width: '100%',
          p: 2,
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
          background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, rgba(255,255,255,0.95) 100%)',
        }}
      >
        <DataGrid
          rows={filteredServicos}
          columns={columns}
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          loading={loading}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          pageSizeOptions={[5, 10, 25]}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 0,
            backgroundColor: 'rgba(255,255,255,0.85)',
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f1f5f9',
              color: '#1e293b',
              fontWeight: 600,
              letterSpacing: 0.15,
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: '#f8fafc',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'rgba(37, 99, 235, 0.04)',
            },
            '& .MuiCheckbox-root.Mui-checked': {
              color: '#2563eb',
            },
          }}
        />
      </Paper>

      <ServicoFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingServico}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};
