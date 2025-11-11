import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { toast } from 'sonner';
import { IDoutor } from '../types/models';
import { getDoutores, createDoutor, updateDoutor, deleteDoutor, DoutorCreateInput, DoutorUpdateInput } from '../services/doutor.service';
import { DoutorFormModal } from '../components/doutores/DoutorFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';

export const DoutoresPage: React.FC = () => {
  const { user } = useAuth();
  const [doutores, setDoutores] = useState<IDoutor[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoutor, setEditingDoutor] = useState<IDoutor | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  const fetchDoutores = async () => {
    try {
      setLoading(true);
      const data = await getDoutores();
      setDoutores(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar doutores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoutores();
  }, []);

  const handleOpenModal = (doutor: IDoutor | null = null) => {
    setEditingDoutor(doutor);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingDoutor(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: DoutorCreateInput | DoutorUpdateInput) => {
    try {
      if (editingDoutor) {
        await updateDoutor(editingDoutor.id, data as DoutorUpdateInput);
        toast.success('Doutor atualizado com sucesso!');
      } else {
        await createDoutor(data as DoutorCreateInput);
        toast.success('Doutor criado com sucesso!');
      }
      await fetchDoutores();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar doutor');
    }
  };

  const handleDelete = (id: number) => {
    if (id === user?.id) {
      toast.error('Você não pode excluir a sua própria conta.');
      return;
    }
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;
    try {
      await deleteDoutor(itemToDeleteId);
      await fetchDoutores();
      setItemToDeleteId(null);
      toast.success('Doutor excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar doutor');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IDoutor>[] = [
    { field: 'nome', headerName: 'Nome', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'especialidade', headerName: 'Especialidade', width: 200 },
    { field: 'role', headerName: 'Permissão', width: 150 },
    
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 120,
      getActions: ({ row }) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Editar"
          onClick={() => handleOpenModal(row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Excluir"
          onClick={() => handleDelete(row.id)}
          disabled={row.id === user?.id}
        />,
      ],
    },
  ];

  if (user?.role === 'SUPER_ADMIN') {
    columns.splice(1, 0, {
      field: 'clinica',
      headerName: 'Clínica',
      flex: 1,
      valueGetter: ({ row }) => {
        const doutor = row as IDoutor | undefined;
        if (!doutor) return 'N/A';
        if (doutor.clinica?.nome) return doutor.clinica.nome;
        if (doutor.clinicaId != null) return `Clínica #${doutor.clinicaId}`;
        return 'N/A';
      },
    });
  }

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Gerir Doutores</Typography>
        <Button variant="contained" onClick={() => handleOpenModal()}>
          Novo Doutor
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%', p: 2, borderRadius: 3 }}>
        <DataGrid
          rows={doutores}
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
          sx={{ border: 0 }}
        />
      </Paper>

      <DoutorFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingDoutor}
        user={user}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este doutor? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};

