import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Paper, CircularProgress, TextField, InputAdornment, Grid, Autocomplete } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import ScienceIcon from '@mui/icons-material/Science';
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import { ptBR } from '@mui/x-data-grid/locales';
import { IMedicamento } from '../types/models';
import {
  getMedicamentos,
  createMedicamento,
  updateMedicamento,
  deleteMedicamento,
  MedicamentoInput,
} from '../services/medicamento.service';
import { MedicamentoFormModal } from '../components/medicamentos/MedicamentoFormModal';
import { MedicamentoViewModal } from '../components/medicamentos/MedicamentoViewModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../hooks/useAuth';

export const MedicamentosPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [medicamentos, setMedicamentos] = useState<IMedicamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNomeProduto, setSearchNomeProduto] = useState('');
  const [searchEmpresa, setSearchEmpresa] = useState('');
  const [searchCategoria, setSearchCategoria] = useState('');
  const [searchPrincipioAtivo, setSearchPrincipioAtivo] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicamento, setEditingMedicamento] = useState<IMedicamento | null>(null);
  const [viewingMedicamento, setViewingMedicamento] = useState<IMedicamento | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<number | null>(null);

  // Debounce dos valores de busca - delay de 600ms
  const debouncedNomeProduto = useDebounce(searchNomeProduto, 600);
  const debouncedEmpresa = useDebounce(searchEmpresa, 600);
  const debouncedCategoria = useDebounce(searchCategoria, 600);
  const debouncedPrincipioAtivo = useDebounce(searchPrincipioAtivo, 600);

  const fetchMedicamentos = React.useCallback(async (page: number = 0, pageSize: number = 10) => {
    try {
      setLoading(true);
      const filters: any = {
        skip: page * pageSize,
        take: pageSize,
      };

      // Aplicar filtros em conjunto (AND) usando valores debounced
      if (debouncedNomeProduto.trim()) {
        filters.nomeProduto = debouncedNomeProduto.trim();
      }
      if (debouncedEmpresa.trim()) {
        filters.empresaDetentoraRegistro = debouncedEmpresa.trim();
      }
      if (debouncedCategoria.trim()) {
        filters.categoriaRegulatoria = debouncedCategoria.trim();
      }
      if (debouncedPrincipioAtivo.trim()) {
        filters.principioAtivo = debouncedPrincipioAtivo.trim();
      }

      const data = await getMedicamentos(filters);
      setMedicamentos(data.medicamentos);
      setTotal(data.total);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar medicamentos');
    } finally {
      setLoading(false);
    }
  }, [debouncedNomeProduto, debouncedEmpresa, debouncedCategoria, debouncedPrincipioAtivo]);

  // Carregar lista de empresas e categorias uma vez ao montar o componente
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Buscar uma amostra grande para obter todas as empresas e categorias
        const allData = await getMedicamentos({ skip: 0, take: 10000 });
        const allEmpresas = new Set<string>();
        const allCategorias = new Set<string>();
        
        allData.medicamentos.forEach((m) => {
          if (m.empresaDetentoraRegistro) {
            allEmpresas.add(m.empresaDetentoraRegistro);
          }
          if (m.categoriaRegulatoria) {
            allCategorias.add(m.categoriaRegulatoria);
          }
        });

        setEmpresas(Array.from(allEmpresas).sort());
        setCategorias(Array.from(allCategorias).sort());
      } catch (err) {
        console.error('Erro ao carregar opções de empresas e categorias:', err);
      }
    };

    loadOptions();
  }, []);

  // Buscar quando qualquer filtro debounced mudar (após 600ms sem digitação)
  // Isso também reseta a paginação para a primeira página
  useEffect(() => {
    // Resetar para primeira página quando filtros mudarem
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [debouncedNomeProduto, debouncedEmpresa, debouncedCategoria, debouncedPrincipioAtivo]);

  // Buscar quando a paginação mudar (incluindo quando for resetada pelos filtros)
  useEffect(() => {
    fetchMedicamentos(paginationModel.page, paginationModel.pageSize);
  }, [paginationModel.page, paginationModel.pageSize, fetchMedicamentos]);

  const handleOpenModal = (medicamento: IMedicamento | null = null) => {
    setEditingMedicamento(medicamento);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingMedicamento(null);
    setIsModalOpen(false);
  };

  const handleViewMedicamento = (medicamento: IMedicamento) => {
    setViewingMedicamento(medicamento);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setViewingMedicamento(null);
    setIsViewModalOpen(false);
  };

  const handleSubmitForm = async (data: Partial<MedicamentoInput>) => {
    try {
      if (editingMedicamento) {
        await updateMedicamento(editingMedicamento.id, data);
        toast.success('Medicamento atualizado com sucesso!');
      } else {
        await createMedicamento(data as MedicamentoInput);
        toast.success('Medicamento criado com sucesso!');
      }
      await fetchMedicamentos(paginationModel.page, paginationModel.pageSize);
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar medicamento');
    }
  };

  const handleDelete = (id: number) => {
    setItemToDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDeleteId) return;

    try {
      await deleteMedicamento(itemToDeleteId);
      await fetchMedicamentos(paginationModel.page, paginationModel.pageSize);
      setItemToDeleteId(null);
      toast.success('Medicamento excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao apagar medicamento');
      setItemToDeleteId(null);
    }
  };

  const columns: GridColDef<IMedicamento>[] = [
    {
      field: 'nomeProduto',
      headerName: 'Nome do Produto',
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'numeroRegistroProduto',
      headerName: 'Nº Registro',
      width: 150,
    },
    {
      field: 'categoriaRegulatoria',
      headerName: 'Categoria',
      width: 150,
    },
    {
      field: 'classeTerapeutica',
      headerName: 'Classe Terapêutica',
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'situacaoRegistro',
      headerName: 'Situação',
      width: 120,
    },
    {
      field: 'empresaDetentoraRegistro',
      headerName: 'Empresa',
      flex: 1,
      minWidth: 150,
    },
    // Coluna de ações: SUPER_ADMIN vê editar/deletar, outros veem apenas visualizar
    {
      field: 'actions',
      type: 'actions' as const,
      headerName: 'Ações',
      width: isSuperAdmin ? 120 : 80,
      getActions: ({ row }) => {
        const medicamento = row as IMedicamento;
        
        if (isSuperAdmin) {
          // SUPER_ADMIN: editar, deletar e visualizar
          return [
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label="Visualizar"
              onClick={() => handleViewMedicamento(medicamento)}
            />,
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Editar"
              onClick={() => handleOpenModal(medicamento)}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Excluir"
              onClick={() => handleDelete(medicamento.id)}
            />,
          ];
        } else {
          // Não-SUPER_ADMIN: apenas visualizar
          return [
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label="Visualizar"
              onClick={() => handleViewMedicamento(medicamento)}
            />,
          ];
        }
      },
    },
  ];

  if (loading && medicamentos.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              value={searchNomeProduto}
              onChange={(event) => setSearchNomeProduto(event.target.value)}
              placeholder="Nome do Produto"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              value={searchPrincipioAtivo}
              onChange={(event) => setSearchPrincipioAtivo(event.target.value)}
              placeholder="Princípio Ativo"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ScienceIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              freeSolo
              options={empresas}
              value={searchEmpresa}
              onInputChange={(_, newValue) => setSearchEmpresa(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Empresa (Farmacêutica)"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <BusinessIcon fontSize="small" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              freeSolo
              options={categorias}
              value={searchCategoria}
              onInputChange={(_, newValue) => setSearchCategoria(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Categoria Regulatória"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <CategoryIcon fontSize="small" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          {(searchNomeProduto || searchEmpresa || searchCategoria || searchPrincipioAtivo) && (
            <Button
              variant="outlined"
              onClick={() => {
                setSearchNomeProduto('');
                setSearchEmpresa('');
                setSearchCategoria('');
                setSearchPrincipioAtivo('');
              }}
            >
              Limpar Filtros
            </Button>
          )}
          {/* Apenas SUPER_ADMIN pode criar novos medicamentos */}
          {isSuperAdmin && (
            <Button
              variant="contained"
              onClick={() => handleOpenModal()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Novo Medicamento
            </Button>
          )}
        </Box>
      </Box>

      <Paper
        sx={{
          flex: 1,
          width: '100%',
          p: 2,
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
          background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, rgba(255,255,255,0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <DataGrid
          rows={medicamentos}
          columns={columns}
          localeText={ptBR.components.MuiDataGrid.defaultProps.localeText}
          loading={loading}
          paginationMode="server"
          rowCount={total}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: false,
            },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 0,
            flex: 1,
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

      <MedicamentoFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitForm}
        initialData={editingMedicamento}
      />

      <MedicamentoViewModal
        open={isViewModalOpen}
        onClose={handleCloseViewModal}
        medicamento={viewingMedicamento}
      />

      <ConfirmationModal
        open={itemToDeleteId !== null}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este medicamento? Esta ação não pode ser desfeita."
      />
    </Box>
  );
};

