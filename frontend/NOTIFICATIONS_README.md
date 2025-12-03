# Sistema de Notificações em Tempo Real

Este documento descreve o sistema de notificações implementado para alertar médicos sobre novos agendamentos.

## Funcionalidades

- ✅ **Notificação Interna (UI)**: Toast visual com som agradável
- ✅ **Notificação do Navegador**: Web Push Notifications via Service Worker
- ✅ **Som de Notificação**: Som suave gerado via Web Audio API
- ✅ **Tempo Real**: Integração com WebSocket para notificações instantâneas
- ✅ **Compatibilidade**: Chrome e Edge (suporte completo)

## Arquitetura

### Componentes Principais

1. **Service Worker** (`public/sw.js`)
   - Gerencia notificações push quando a página está fechada
   - Escuta eventos de push e exibe notificações do navegador
   - Gerencia cliques nas notificações

2. **Hook useNotifications** (`src/hooks/useNotifications.ts`)
   - Gerencia permissões de notificação
   - Registra Service Worker
   - Exibe notificações locais e do navegador
   - Funções reutilizáveis para todo o sistema

3. **Context NotificationContext** (`src/context/NotificationContext.tsx`)
   - Provider global para notificações
   - Integração automática com WebSocket
   - Escuta eventos de agendamento e dispara notificações

4. **Utilitário de Som** (`src/utils/notificationSound.ts`)
   - Gera som agradável via Web Audio API
   - Fallback para HTML5 Audio se necessário

5. **Componente de Configurações** (`src/components/common/NotificationSettings.tsx`)
   - Interface para solicitar permissões
   - Exibe status das notificações

## Como Funciona

### Fluxo de Notificação

1. **Criação de Agendamento** (Secretaria no Dashboard)
   - Backend cria agendamento
   - Backend emite evento WebSocket via `emitAgendamentoEvent`

2. **Recepção no Frontend** (Médico)
   - `NotificationContext` escuta eventos WebSocket
   - Verifica se o evento é para o doutor atual
   - Dispara notificação se for evento `created`

3. **Exibição da Notificação**
   - **Som**: Reproduzido imediatamente via Web Audio API
   - **Toast**: Exibido na UI usando Sonner
   - **Push Notification**: Exibida se o usuário tiver permissão

### Permissões

O sistema solicita permissão de notificações automaticamente quando:
- Um novo agendamento é criado (primeira vez)
- O usuário clica em "Habilitar Notificações" no componente de configurações

## Uso

### Para Desenvolvedores

#### Usar o Context de Notificações

```tsx
import { useNotificationContext } from '../context/NotificationContext';

function MyComponent() {
  const { showNotification, requestPermission, permission } = useNotificationContext();

  const handleNewAgendamento = () => {
    showNotification({
      title: 'Novo Agendamento',
      body: 'Paciente: João Silva - 15/01/2024 às 14:00',
      data: {
        agendamentoId: 123,
        url: '/atendimento-do-dia',
      },
    });
  };

  return (
    <button onClick={handleNewAgendamento}>
      Testar Notificação
    </button>
  );
}
```

#### Usar o Hook Diretamente

```tsx
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const { showNotification, requestPermission } = useNotifications({
    enabled: true,
    requestPermission: false,
  });

  // ... usar showNotification
}
```

#### Reproduzir Som Manualmente

```tsx
import { playNotificationSound } from '../utils/notificationSound';

playNotificationSound();
```

## Configuração

### Service Worker

O Service Worker é registrado automaticamente quando:
- O navegador suporta Service Workers
- O hook `useNotifications` é usado com `enabled: true`

### Ícone de Notificação

O ícone padrão está em `/public/icon-192x192.svg`. Você pode substituir por um ícone personalizado.

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari)
- HTTPS (ou localhost para desenvolvimento)
- Permissão do usuário para notificações

## Troubleshooting

### Notificações não aparecem

1. Verifique se o navegador suporta notificações
2. Verifique se a permissão foi concedida
3. Verifique o console do navegador para erros
4. Verifique se o Service Worker está registrado (DevTools > Application > Service Workers)

### Som não toca

1. Verifique se o navegador suporta Web Audio API
2. Verifique se o volume do navegador está ligado
3. Verifique o console para erros de áudio

### Service Worker não registra

1. Verifique se está usando HTTPS ou localhost
2. Verifique se o arquivo `/sw.js` está acessível
3. Verifique o console para erros de registro

## Melhorias Futuras

- [ ] Suporte para notificações push do servidor (quando página está fechada)
- [ ] Personalização de sons
- [ ] Configurações de notificação por usuário
- [ ] Histórico de notificações
- [ ] Notificações para outros eventos (cancelamentos, alterações, etc.)

