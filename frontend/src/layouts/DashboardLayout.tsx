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
  Collapse,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import StoreIcon from '@mui/icons-material/Store';
import ChatIcon from '@mui/icons-material/Chat';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import TodayIcon from '@mui/icons-material/Today';
import MedicationIcon from '@mui/icons-material/Medication';
import DescriptionIcon from '@mui/icons-material/Description';
import { useAuth } from '../hooks/useAuth';
import { useDoutorSelecionado } from '../context/DoutorSelecionadoContext';
import { SelectDoutorModal } from '../components/common/SelectDoutorModal';
import { NotificationBell } from '../components/common/NotificationBell';
import { ChatInternoWidget } from '../components/chat-interno/ChatInternoWidget';
import PersonIcon from '@mui/icons-material/Person';

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
  [theme.breakpoints.up('md')]: {
    ...(open && {
      marginLeft: drawerWidth,
      width: `calc(100% - ${drawerWidth}px)`,
      transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    }),
  },
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    [theme.breakpoints.up('md')]: {
      ...(open && {
        ...openedMixin(theme),
        '& .MuiDrawer-paper': openedMixin(theme),
      }),
      ...(!open && {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme),
      }),
    },
    [theme.breakpoints.down('md')]: {
      '& .MuiDrawer-paper': {
        width: drawerWidth,
      },
    },
  }),
);

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  role: string[];
  subItems?: MenuItem[];
}

export const DashboardLayout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = React.useState(!isMobile); // Fechado por padrão em mobile
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [gerenciarOpen, setGerenciarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const { doutorSelecionado, setDoutorSelecionado, doutoresDisponiveis, isLoading: isLoadingDoutor } = useDoutorSelecionado();
  const [isSelectDoutorModalOpen, setIsSelectDoutorModalOpen] = useState(false);

  // Ajustar estado do drawer quando mudar de mobile para desktop
  React.useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
      // Em desktop, manter o estado atual de 'open' ao redimensionar
    } else {
      // Em mobile, garantir que o drawer permanente esteja fechado
      setOpen(false);
    }
  }, [isMobile]);

  const menuItems: MenuItem[] = [
    { text: 'Agenda', icon: <EventIcon />, path: '/dashboard', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'] },
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
      role: ['CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'],
    },
    {
      text: 'Chat Interno',
      icon: <ChatBubbleIcon />,
      path: '/chat-interno',
      role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'],
    },
    {
      text: 'Gerenciar',
      icon: <SettingsIcon />,
      path: '#',
      role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'],
      subItems: [
        { text: 'Pacientes', icon: <PeopleIcon />, path: '/pacientes', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN', 'SECRETARIA'] },
        { text: 'Medicamentos', icon: <MedicationIcon />, path: '/medicamentos', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'] },
        { text: 'Prescrições', icon: <DescriptionIcon />, path: '/prescricoes', role: ['DOUTOR', 'CLINICA_ADMIN', 'SUPER_ADMIN'] },
      ],
    },
    { text: 'Serviços', icon: <MedicalServicesIcon />, path: '/servicos', role: ['CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Doutores', icon: <AccountCircleIcon />, path: '/doutores', role: ['CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Secretárias', icon: <AccountCircleIcon />, path: '/secretarias', role: ['CLINICA_ADMIN', 'SUPER_ADMIN'] },
    { text: 'Gerir Clínicas', icon: <StoreIcon />, path: '/clinicas', role: ['SUPER_ADMIN'] },
  ];

  const permittedMenuItems = menuItems.filter(
    (item) => user && item.role.includes(user.role),
  );

  // Verificar se algum subitem está ativo para expandir o menu Gerenciar
  React.useEffect(() => {
    const gerenciarItem = menuItems.find((item) => item.text === 'Gerenciar');
    if (gerenciarItem?.subItems) {
      const hasActiveSubItem = gerenciarItem.subItems.some(
        (subItem) => location.pathname.startsWith(subItem.path)
      );
      if (hasActiveSubItem) {
        setGerenciarOpen(true);
      }
    }
  }, [location.pathname]);

  // Encontrar o item de menu ativo (incluindo subitens)
  const findActiveMenuItem = (): string => {
    let title = 'Agenda';
    for (const item of menuItems) {
      if (item.subItems) {
        const activeSubItem = item.subItems.find((subItem) => 
          location.pathname.startsWith(subItem.path)
        );
        if (activeSubItem) {
          title = activeSubItem.text;
          break;
        }
      } else {
        if (location.pathname.startsWith(item.path)) {
          title = item.text;
          break;
        }
      }
    }
    
    // Se for SECRETARIA e houver doutor selecionado, adicionar o nome do doutor
    if (user?.role === 'SECRETARIA' && doutorSelecionado) {
      return `${title} (Dr. ${doutorSelecionado.nome})`;
    }
    
    return title;
  };
  
  const headerTitle = findActiveMenuItem();

  const handleDrawerOpen = () => {
    if (isMobile) {
      setMobileOpen(true);
    } else {
      setOpen(true);
    }
  };

  const handleDrawerClose = () => {
    if (isMobile) {
      setMobileOpen(false);
    } else {
      setOpen(false);
    }
  };

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setOpen(!open);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open && !isMobile}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{
              marginRight: { xs: 2, md: 5 },
              display: isMobile ? 'block' : (open ? 'none' : 'block'),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', md: '1.25rem' },
            }}
          >
            {headerTitle}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              mr: { xs: 1, md: 2 },
              display: { xs: 'none', sm: 'block' },
              fontSize: { xs: '0.875rem', md: '1rem' },
            }}
          >
            Olá, {user?.email}
          </Typography>
          <NotificationBell />
          <Button 
            color="inherit" 
            onClick={logout}
            size={isMobile ? 'small' : 'medium'}
            sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
          >
            Sair
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer 
        variant={isMobile ? 'temporary' : 'permanent'} 
        open={isMobile ? mobileOpen : open}
        onClose={isMobile ? handleDrawerClose : undefined}
        ModalProps={{
          keepMounted: true, // Melhor performance em mobile
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <DrawerHeader>
            <Typography variant="h6" sx={{ mr: 'auto', ml: 1 }}>
              Simpatia IA
            </Typography>
            <IconButton onClick={isMobile ? handleDrawerClose : handleDrawerClose}>
              {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </DrawerHeader>
          <Divider />
          <List sx={{ flexGrow: 1, overflowY: (isMobile ? mobileOpen : open) ? 'auto' : 'hidden', overflowX: 'hidden' }}>
          {permittedMenuItems.map((item) => {
            if (item.subItems) {
              // Menu expansível
              const hasActiveSubItem = item.subItems.some(
                (subItem) => user && subItem.role.includes(user.role) && location.pathname.startsWith(subItem.path)
              );
              const permittedSubItems = item.subItems.filter(
                (subItem) => user && subItem.role.includes(user.role)
              );

              if (permittedSubItems.length === 0) return null;

              return (
                <React.Fragment key={item.text}>
                  <ListItem disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                      onClick={() => {
                        const isOpen = isMobile ? mobileOpen : open;
                        if (!isOpen) {
                          // Se o menu estiver fechado, abrir o menu primeiro
                          if (isMobile) {
                            setMobileOpen(true);
                          } else {
                            setOpen(true);
                          }
                          setGerenciarOpen(true);
                        } else {
                          // Se o menu estiver aberto, apenas expandir/colapsar
                          setGerenciarOpen(!gerenciarOpen);
                        }
                      }}
                      sx={{
                        minHeight: 48,
                        justifyContent: (isMobile ? mobileOpen : open) ? 'initial' : 'center',
                        px: 2.5,
                        backgroundColor: hasActiveSubItem ? 'action.selected' : 'transparent',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: (isMobile ? mobileOpen : open) ? 3 : 'auto',
                          justifyContent: 'center',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} sx={{ opacity: (isMobile ? mobileOpen : open) ? 1 : 0 }} />
                      {(isMobile ? mobileOpen : open) && (gerenciarOpen ? <ExpandLess /> : <ExpandMore />)}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={gerenciarOpen && (isMobile ? mobileOpen : open)} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {permittedSubItems.map((subItem) => {
                        const isActive = location.pathname.startsWith(subItem.path);
                        return (
                          <ListItem key={subItem.text} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                              component={RouterLink}
                              to={subItem.path}
                              onClick={() => {
                                if (isMobile) {
                                  setMobileOpen(false);
                                }
                              }}
                              sx={{
                                minHeight: 48,
                                pl: (isMobile ? mobileOpen : open) ? 4 : 2.5,
                                backgroundColor: isActive ? 'action.selected' : 'transparent',
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 0,
                                  mr: (isMobile ? mobileOpen : open) ? 3 : 'auto',
                                  justifyContent: 'center',
                                }}
                              >
                                {subItem.icon}
                              </ListItemIcon>
                              <ListItemText primary={subItem.text} sx={{ opacity: (isMobile ? mobileOpen : open) ? 1 : 0 }} />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            }

            // Menu item normal
            const isActive = location.pathname.startsWith(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  onClick={() => {
                    if (isMobile) {
                      setMobileOpen(false);
                    }
                  }}
                  sx={{
                    minHeight: 48,
                    justifyContent: (isMobile ? mobileOpen : open) ? 'initial' : 'center',
                    px: 2.5,
                    backgroundColor: isActive ? 'action.selected' : 'transparent',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: (isMobile ? mobileOpen : open) ? 3 : 'auto',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} sx={{ opacity: (isMobile ? mobileOpen : open) ? 1 : 0 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
          </List>
          {user?.role === 'SECRETARIA' && (
            <>
              <Divider />
              <Box
                sx={{
                  p: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <ListItemButton
                  onClick={() => setIsSelectDoutorModalOpen(true)}
                  sx={{
                    minHeight: 40,
                    height: 40,
                    justifyContent: open ? 'initial' : 'center',
                    px: open ? 2.5 : 1,
                    borderRadius: 1,
                    backgroundColor: doutorSelecionado ? 'primary.main' : 'error.main',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    '@keyframes shimmer': {
                      '0%': {
                        left: '-100%',
                      },
                      '100%': {
                        left: '100%',
                      },
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                      animation: 'shimmer 2.5s infinite',
                    },
                    '&:hover': {
                      backgroundColor: doutorSelecionado ? 'primary.dark' : 'error.dark',
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled',
                      '&::before': {
                        animation: 'none',
                      },
                    },
                  }}
                  disabled={isLoadingDoutor || doutoresDisponiveis.length === 0}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 1.5 : 0,
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      doutorSelecionado
                        ? `Dr. ${doutorSelecionado.nome}`
                        : 'Nenhum Doutor Selecionado'
                    }
                    sx={{
                      opacity: (isMobile ? mobileOpen : open) ? 1 : 0,
                      '& .MuiListItemText-primary': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pr: 1,
                      },
                    }}
                  />
                </ListItemButton>
              </Box>
            </>
          )}
        </Box>
      </Drawer>
      {user?.role === 'SECRETARIA' && (
        <SelectDoutorModal
          open={isSelectDoutorModalOpen}
          onClose={() => setIsSelectDoutorModalOpen(false)}
          onSelect={(doutor) => {
            setDoutorSelecionado(doutor);
            setIsSelectDoutorModalOpen(false);
          }}
          doutores={doutoresDisponiveis}
          title="Trocar Doutor"
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: location.pathname.startsWith('/dashboard') ? 'hidden' : 'auto',
          width: { xs: '100%', md: `calc(100% - ${open ? drawerWidth : theme.spacing(7)}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(!isMobile && open && {
            width: `calc(100% - ${drawerWidth}px)`,
            transition: theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
        }}
      >
        <DrawerHeader />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>
      </Box>
      
      {/* Widget de Chat Interno - Sempre visível */}
      <ChatInternoWidget />
    </Box>
  );
};
