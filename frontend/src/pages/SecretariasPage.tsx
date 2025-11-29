import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Paper, CircularProgress, TextField, InputAdornment, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { DataGrid, GridColDef, GridToolbar, GridActionsCellItem } from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { toast } from 'sonner';
import { ISecretaria, getSecretarias, createSecretaria, updateSecretaria, deleteSecretaria } from '../services/secretaria.service';
import { SecretariaFormModal } from '../components/secretarias/SecretariaFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export const SecretariasPage: React.FC = () => {
  const [secretarias, setSecretarias] = useState<ISecretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSecretaria, setEditingSecretaria] = useState<ISecretaria | null>(null);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  const fetchSecretarias = async () => {
    try {
      setLoading(true);
      const data = await getSecretarias();
      setSecretarias(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar secretárias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecretarias();
  }, []);

  const handleOpenModal = (secretaria: ISecretaria | null = null) => {
    setEditingSecretaria(secretaria);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingSecretaria(null);
    setIsModalOpen(false);
  };

  const handleSubmitForm = async (data: any) => {
    try {
      if (editingSecretaria) {
        await updateSecretaria(editingSecretaria.id, data);
        toast.success('Secretária atualizada com sucesso!');
      } else {
        await createSecretaria(data);
        toast.success('Secretária criada com sucesso!');
      }
      await fetchSecretarias();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar secretária');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;
    try {
      await deleteSecretaria(itemToDeleteId);
      await fetchSecretarias();
      setItemToDeleteId(null);
      toast.success('Secretária excluída com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar secretária');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<ISecretaria>[] = [
    { field: 'nome', headerName: 'Nome', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 },
    {
      field: 'doutoresVinculados',
      headerName: 'Doutores Vinculados',
      flex: 2,
      renderCell: (params) => {
        const doutores = params.value || [];
        if (doutores.length === 0) {
          return <Chip label="Nenhum" size="small" color="default" />;
        }
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {doutores.slice(0, 2).map((doutor: any) => (
              <Chip key={doutor.id} label={doutor.nome} size="small" color="primary" />
            ))}
            {doutores.length > 2 && (
              <Chip label={`+${doutores.length - 2}`} size="small" color="secondary" />
            )}
          </Box>
        );
      },
    },
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

  const filteredSecretarias = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return secretarias;
    return secretarias.filter((secretaria) => {
      const nome = secretaria.nome?.toLowerCase() ?? '';
      const email = secretaria.email?.toLowerCase() ?? '';
      return nome.includes(term) || email.includes(term);
    });
  }, [secretarias, searchTerm]);

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <TextField
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Pesquisar secretária"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: { xs: '100%', md: 260 },
            flex: { xs: '0 1 auto', md: 1 },
          }}
        />
        <Button
          variant="contained"
          onClick={() => handleOpenModal()}
          sx={{ alignSelf: { xs: 'stretch', md: 'center' }, whiteSpace: 'nowrap' }}
        >
          Nova Secretária
        </Button>
      </Box>

      <Paper
        sx={{
          flex: 1,
          width: '100%',
          p: 2,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <DataGrid
          rows={filteredSecretarias}
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
          sx={{ border: 0, flex: 1 }}
        />
      </Paper>

      <SecretariaFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        secretaria={editingSecretaria}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta secretária? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};


