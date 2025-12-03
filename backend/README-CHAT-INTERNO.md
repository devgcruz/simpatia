# Sistema de Chat Interno da Clínica

## 📋 Visão Geral

Sistema completo de chat interno para comunicação em tempo real entre médicos, secretárias e demais funcionários da clínica.

## 🔐 Segurança Implementada

### Autenticação e Autorização
- ✅ JWT assinado com chave assimétrica (RS256)
- ✅ Refresh tokens com validade de 7 dias
- ✅ Access tokens com validade de 15 minutos
- ✅ Rate limiting no login (5 tentativas por 5 minutos)
- ✅ Autenticação WebSocket usando tokens JWT

### Criptografia
- ✅ TLS obrigatório (HTTPS/WSS)
- ✅ Criptografia AES-256-GCM para mensagens sensíveis em repouso
- ✅ Hash de senha com bcrypt (10-12 rounds)

### Proteções
- ✅ Rate limiting em mensagens (20/min por usuário)
- ✅ Rate limiting em conexões WebSocket
- ✅ Rate limiting em requisições REST
- ✅ Proteção contra SQL Injection (Prisma com parâmetros bindados)
- ✅ Sanitização de entradas (Zod)
- ✅ Proteção contra XSS (sanitização no backend)

### Logs e Auditoria
- ✅ Logs de todas as ações importantes
- ✅ Rastreamento de IP e User-Agent
- ✅ Histórico completo de mensagens

## 🚀 Configuração

### 1. Gerar Certificados SSL para Desenvolvimento

```bash
cd backend
npm run generate-cert
```

Isso criará certificados auto-assinados em `backend/certs/`.

**Nota:** Seu navegador mostrará um aviso de segurança. Aceite para continuar em desenvolvimento.

### 2. Configurar Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# HTTPS (opcional em desenvolvimento)
USE_HTTPS=true

# Chave de criptografia (gere uma chave segura)
ENCRYPTION_KEY=your-32-byte-hex-key-here

# Frontend URL
FRONTEND_URL=https://localhost:5173
```

### 3. Executar Migrations

```bash
cd backend
npx prisma migrate dev --name add_chat_interno
npx prisma generate
```

## 📡 API REST

### Conversas

- `POST /api/chat-interno/conversas/individual` - Criar conversa individual
- `POST /api/chat-interno/conversas/grupo` - Criar grupo (apenas admins)
- `GET /api/chat-interno/conversas` - Listar conversas do usuário
- `GET /api/chat-interno/conversas/buscar?termo=...` - Buscar conversas

### Mensagens

- `GET /api/chat-interno/conversas/:conversaId/mensagens?page=1&limit=50` - Obter mensagens
- `POST /api/chat-interno/mensagens` - Enviar mensagem
- `POST /api/chat-interno/conversas/:conversaId/marcar-lidas` - Marcar como lidas

### Participantes

- `POST /api/chat-interno/conversas/:conversaId/participantes` - Adicionar participante
- `DELETE /api/chat-interno/conversas/:conversaId/participantes` - Remover participante

### Status

- `GET /api/chat-interno/usuarios/online` - Listar usuários online

## 🔌 WebSocket Events

### Cliente → Servidor

- `conversa:entrar` - Entrar em uma conversa
- `mensagem:enviar` - Enviar mensagem
- `mensagens:marcar-lidas` - Marcar mensagens como lidas
- `digitando:iniciar` - Indicar que está digitando
- `digitando:parar` - Parar de indicar que está digitando

### Servidor → Cliente

- `mensagem:nova` - Nova mensagem recebida
- `mensagens:lidas` - Mensagens foram lidas por outro usuário
- `digitando:status` - Status de digitação de outro usuário
- `usuario:online` - Usuário ficou online
- `usuario:offline` - Usuário ficou offline
- `erro` - Erro ocorreu

## 📦 Estrutura do Banco de Dados

### Modelos Principais

- `ConversaInterna` - Conversas (individuais ou grupos)
- `ParticipanteConversa` - Participantes de conversas
- `MensagemInterna` - Mensagens do chat
- `LeituraMensagem` - Rastreamento de leitura
- `StatusUsuario` - Status online/offline
- `ChatAuditLog` - Logs de auditoria

## 🔄 Próximos Passos

1. Criar componentes React para interface de chat
2. Implementar notificações Web Push
3. Adicionar suporte a upload de arquivos (imagens/PDFs)
4. Implementar busca de mensagens
5. Adicionar modo claro/escuro

## ⚠️ Notas Importantes

- Em produção, use certificados SSL válidos (Let's Encrypt, etc.)
- Configure `ENCRYPTION_KEY` com uma chave segura e única
- Configure logs externos (ELK, Loki, CloudWatch) para auditoria
- Configure backups automáticos do PostgreSQL
- Revise e ajuste os limites de rate limiting conforme necessário

