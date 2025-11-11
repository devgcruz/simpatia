import React from 'react';
import {
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import { alpha, styled } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

const ToolbarRoot = styled(GridToolbarContainer)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.7)
      : alpha(theme.palette.background.paper, 0.9),
  borderRadius: theme.shape.borderRadius * 2,
}));

const SearchField = styled(TextField)(({ theme }) => ({
  minWidth: 240,
  maxWidth: 360,
  '& .MuiOutlinedInput-root': {
    borderRadius: 999,
    backgroundColor:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.background.default, 0.6)
        : '#ffffff',
    boxShadow:
      theme.palette.mode === 'dark'
        ? 'none'
        : '0px 12px 32px rgba(15, 23, 42, 0.08)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    fieldset: {
      border: 'none',
    },
    '&:hover': {
      boxShadow:
        theme.palette.mode === 'dark'
          ? 'none'
          : '0px 16px 45px rgba(15, 23, 42, 0.12)',
    },
    '&.Mui-focused': {
      transform: 'translateY(-1px)',
      boxShadow: `0px 0px 0px 3px ${alpha(
        theme.palette.primary.main,
        0.24,
      )}`,
    },
    input: {
      padding: theme.spacing(1.2, 2),
    },
  },
}));

const quickFilterParser = (searchInput: string) =>
  searchInput
    .split(' ')
    .map((value) => value.trim())
    .filter(Boolean);

export const DataGridSearchToolbar: React.FC = () => (
  <ToolbarRoot>
    <GridToolbarQuickFilter
      debounceMs={300}
      quickFilterParser={quickFilterParser}
      placeholder="Pesquise por nome, telefone..."
      // Passa o TextField estilizado via renderInput
      renderInput={(params: React.ComponentProps<typeof TextField>) => (
        <SearchField
          {...params}
          fullWidth
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}
    />
  </ToolbarRoot>
);

export default DataGridSearchToolbar;

