import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { toast } from 'sonner';
import { IClinica } from '../types/models';
import { getClinicas, createClinicaEAdmin, updateClinica, deleteClinica } from '../services/clinica.service';
import { ClinicaFormModal } from '../components/clinicas/ClinicaFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export const ClinicasPage: React.FC = () => {
  const [clinicas, setClinicas] = useState<IClinica[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClinica, setEditingClinica] = useState<IClinica | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  const fetchClinicas = async () => {
    try {
      setLoading(true);
      const data = await getClinicas();
      setClinicas(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar clínicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinicas();
  }, []);

  const handleOpenModal = (clinica: IClinica | null = null) => {
    setEditingClinica(clinica);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingClinica(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: any) => {
    try {
      if (editingClinica) {
        await updateClinica(editingClinica.id, data);
        toast.success('Clínica atualizada com sucesso!');
      } else {
        await createClinicaEAdmin(data);
        toast.success('Clínica e Admin criados com sucesso!');
      }
      await fetchClinicas();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar clínica');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;
    try {
      await deleteClinica(itemToDeleteId);
      await fetchClinicas();
      setItemToDeleteId(null);
      toast.success('Clínica excluída com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar clínica');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IClinica>[] = [
    { field: 'nome', headerName: 'Nome', flex: 1 },
    { field: 'cnpj', headerName: 'CNPJ', width: 180 },
    { field: 'telefone', headerName: 'Telefone', width: 160 },
    { field: 'whatsappToken', headerName: 'Token WhatsApp', width: 200 },
    { field: 'whatsappPhoneId', headerName: 'Phone ID', width: 200 },
    { field: 'webhookUrlId', headerName: 'Webhook URL ID', flex: 1 },
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
        />,
      ],
    },
  ];

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Gerir Clínicas (Super Admin)</Typography>
        <Button variant="contained" onClick={() => handleOpenModal()}>
          Nova Clínica
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%', p: 2, borderRadius: 3 }}>
        <DataGrid
          rows={clinicas}
          columns={columns}
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          loading={loading}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[5, 10, 25]}
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}
          disableRowSelectionOnClick
          sx={{ border: 0 }}
        />
      </Paper>

      <ClinicaFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingClinica}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta clínica? TODOS os seus dados (doutores, pacientes, agendamentos) serão apagados. Esta ação é irreversível."
      />
    </Box>
  );
};

