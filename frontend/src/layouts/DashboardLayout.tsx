import React, { useState } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import {
  Box,
  Drawer as MuiDrawer,
  AppBar as MuiAppBar,
  Toolbar,
  List,
  CssBaseline,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import StoreIcon from '@mui/icons-material/Store';
import ChatIcon from '@mui/icons-material/Chat';
import TodayIcon from '@mui/icons-material/Today';
import MedicationIcon from '@mui/icons-material/Medication';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

interface AppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
  color: theme.palette.common.white,
  boxShadow: '0px 2px 12px -3px rgba(0,0,0,0.35)',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

export const DashboardLayout: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { text: 'Agenda', icon: <EventIcon />, path: '/dashboard', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'] },
    {
      text: 'Atendimento do Dia',
      icon: <TodayIcon />,
      path: '/atendimento-do-dia',
      role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'],
    },
    {
      text: 'Atendimento',
      icon: <ChatIcon />,
      path: '/atendimento',
      role: ['CLINICA_ADMIN', 'SUPER_ADMIN'],
    },
    { text: 'Pacientes', icon: <PeopleIcon />, path: '/pacientes', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Serviços', icon: <MedicalServicesIcon />, path: '/servicos', role: ['CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Medicamentos', icon: <MedicationIcon />, path: '/medicamentos', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Doutores', icon: <AccountCircleIcon />, path: '/doutores', role: ['CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Gerir Clínicas', icon: <StoreIcon />, path: '/clinicas', role: ['SUPER_ADMIN'] },
  ];

  const permittedMenuItems = menuItems.filter(
    (item) => user && item.role.includes(user.role),
  );

  const currentMenuItem =
    menuItems.find((item) => location.pathname.startsWith(item.path)) ?? menuItems[0];
  const headerTitle = currentMenuItem?.text ?? 'Agenda';

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {headerTitle}
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Olá, {user?.email}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <Typography variant="h6" sx={{ mr: 'auto', ml: 1 }}>
            Simpatia IA
          </Typography>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {permittedMenuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: location.pathname.startsWith('/dashboard') ? 'hidden' : 'auto',
        }}
      >
        <DrawerHeader />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
