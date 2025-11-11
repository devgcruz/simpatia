import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, TextField, InputAdornment } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, GridColDef, GridActionsCellItem, GridToolbar } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { toast } from 'sonner';
import { IPaciente } from '../types/models';
import { getPacientes, createPaciente, updatePaciente, deletePaciente } from '../services/paciente.service';
import { PacienteFormModal } from '../components/pacientes/PacienteFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

export const PacientesPage: React.FC = () => {
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<IPaciente | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  const fetchPacientes = async () => {
    try {
      setLoading(true);
      const data = await getPacientes();
      setPacientes(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacientes();
  }, []);

  const handleOpenModal = (paciente: IPaciente | null = null) => {
    setEditingPaciente(paciente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPaciente(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: Omit<IPaciente, 'id' | 'clinicaId'>) => {
    try {
      if (editingPaciente) {
        await updatePaciente(editingPaciente.id, data);
        toast.success('Paciente atualizado com sucesso!');
      } else {
        await createPaciente(data);
        toast.success('Paciente criado com sucesso!');
      }
      await fetchPacientes();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar paciente');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;

    try {
      await deletePaciente(itemToDeleteId);
      await fetchPacientes();
      setItemToDeleteId(null);
      toast.success('Paciente excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar paciente');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IPaciente>[] = [
    { field: 'nome', headerName: 'Nome', flex: 1 },
    { field: 'telefone', headerName: 'Telefone', width: 200 },
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

  const filteredPacientes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pacientes;
    return pacientes.filter((paciente) => {
      const nome = paciente.nome?.toLowerCase() ?? '';
      const telefone = paciente.telefone?.toLowerCase() ?? '';
      return nome.includes(term) || telefone.includes(term);
    });
  }, [pacientes, searchTerm]);

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Gerir Pacientes</Typography>
        <Button variant="contained" onClick={() => handleOpenModal()}>
          Novo Paciente
        </Button>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <TextField
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Pesquisar paciente"
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

      <Paper sx={{ height: 600, width: '100%', p: 2, borderRadius: 3 }}>
        <DataGrid
          rows={filteredPacientes}
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
          disableRowSelectionOnClick
          sx={{ border: 0 }}
        />
      </Paper>

      <PacienteFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingPaciente}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};

