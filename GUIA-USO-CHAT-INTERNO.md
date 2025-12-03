# 📱 Guia de Uso - Sistema de Chat Interno

## 🚀 Como Acessar

### Opção 1: Via URL
Acesse diretamente: `http://localhost:3000/chat-interno` (ou a URL do seu frontend)

### Opção 2: Via Menu (se adicionado)
Adicione um link no menu de navegação do dashboard apontando para `/chat-interno`

## 🎯 Funcionalidades Principais

### 1. **Conversas Individuais (1:1)**
Comunicação privada entre dois usuários da clínica.

**Como criar:**
- A conversa é criada automaticamente quando você envia a primeira mensagem para outro usuário
- Use a API: `POST /api/chat-interno/conversas/individual` com `{ usuarioId2: <id> }`

### 2. **Grupos**
Criar grupos para comunicação entre múltiplos funcionários (ex: "Recepção", "Enfermagem", etc.)

**Como criar:**
- Apenas usuários com role `CLINICA_ADMIN` ou `SUPER_ADMIN` podem criar grupos
- Use a API: `POST /api/chat-interno/conversas/grupo` com:
  ```json
  {
    "nome": "Recepção",
    "descricao": "Grupo da equipe de recepção",
    "participantesIds": [1, 2, 3]
  }
  ```

### 3. **Enviar Mensagens**
- Digite sua mensagem no campo de texto
- Pressione **Enter** ou clique no botão **Enviar**
- As mensagens são entregues em tempo real via WebSocket

### 4. **Buscar Conversas**
- Use o campo de busca no topo da lista de conversas
- Busca por nome da conversa ou descrição

### 5. **Indicadores Visuais**

#### Status de Conexão
- **Verde/Conectado**: WebSocket conectado e funcionando
- **Vermelho/Desconectado**: Sem conexão WebSocket

#### Badge de Mensagens Não Lidas
- Número vermelho no avatar da conversa indica quantas mensagens não foram lidas

#### Status "Digitando..."
- Quando alguém está digitando, aparece "X usuário(s) digitando..." no header da conversa

#### Status de Leitura
- **✓✓** (duas marcas): Mensagem foi lida pelo destinatário
- **✓** (uma marca): Mensagem foi enviada

### 6. **Usuários Online**
- Veja quais usuários estão online em tempo real
- API: `GET /api/chat-interno/usuarios/online`

## 📋 Interface do Chat

### Layout
```
┌─────────────────┬──────────────────────────────┐
│ Lista de        │ Área de Mensagens            │
│ Conversas       │                              │
│                 │ [Header da Conversa]         │
│ - Conversa 1    │                              │
│ - Conversa 2    │ [Mensagens]                  │
│ - Conversa 3    │                              │
│                 │                              │
│ [Buscar...]     │ [Campo de Texto] [Enviar]   │
└─────────────────┴──────────────────────────────┘
```

### Lista de Conversas (Lado Esquerdo)
- Mostra todas as conversas que você participa
- Ordenadas por última mensagem (mais recente primeiro)
- Badge com número de mensagens não lidas
- Ícone diferente para grupos (👥) e individuais (👤)

### Área de Mensagens (Lado Direito)
- **Header**: Nome da conversa e status de digitação
- **Mensagens**: 
  - Suas mensagens aparecem à direita (azul)
  - Mensagens de outros aparecem à esquerda (branco)
  - Mostra nome do remetente e horário
- **Input**: Campo de texto com botão de enviar

## 🔧 Funcionalidades Avançadas

### Adicionar Participante a um Grupo
```typescript
// API
POST /api/chat-interno/conversas/:conversaId/participantes
Body: { usuarioId: <id> }
```

### Remover Participante de um Grupo
```typescript
// API
DELETE /api/chat-interno/conversas/:conversaId/participantes
Body: { usuarioId: <id> }
```

### Marcar Mensagens como Lidas
- Automático quando você abre uma conversa
- API: `POST /api/chat-interno/conversas/:conversaId/marcar-lidas`

### Mensagens Criptografadas
- Ao enviar mensagem, você pode marcar `criptografar: true`
- A mensagem será criptografada usando AES-256-GCM antes de ser salva no banco
- Apenas participantes da conversa podem descriptografar

## 🎨 Melhorias Futuras (Ainda não implementadas)

- [ ] Upload de imagens
- [ ] Upload de PDFs
- [ ] Emoji picker
- [ ] Edição de mensagens
- [ ] Exclusão de mensagens
- [ ] Notificações sonoras
- [ ] Web Push notifications
- [ ] Modo claro/escuro
- [ ] Busca dentro de mensagens

## 🔐 Segurança

### Permissões
- **Todos os usuários**: Podem criar conversas individuais e enviar mensagens
- **Apenas Admins**: Podem criar grupos e adicionar/remover participantes

### Criptografia
- Mensagens sensíveis podem ser criptografadas
- Criptografia AES-256-GCM
- Chave armazenada em variável de ambiente (`ENCRYPTION_KEY`)

### Rate Limiting
- Máximo 20 mensagens por minuto por usuário
- Máximo 10 conversas criadas por 5 minutos
- Proteção contra flooding e spam

## 🐛 Solução de Problemas

### WebSocket não conecta
1. Verifique se fez login novamente (tokens antigos não funcionam)
2. Verifique o console do navegador para erros
3. Verifique se o backend está rodando
4. Verifique se a URL do WebSocket está correta

### Mensagens não aparecem
1. Verifique se está conectado ao WebSocket (status no header)
2. Recarregue a página
3. Verifique o console para erros

### Não consigo criar grupo
- Verifique se seu usuário tem role `CLINICA_ADMIN` ou `SUPER_ADMIN`
- Apenas administradores podem criar grupos

### Token inválido
- Faça logout e login novamente
- O sistema agora usa RS256, tokens antigos (HS256) não funcionam

## 📞 Exemplos de Uso

### Exemplo 1: Criar conversa individual
```typescript
// No frontend
const conversa = await chatInternoService.createConversaIndividual(usuarioId2);
```

### Exemplo 2: Criar grupo
```typescript
// No frontend (apenas admins)
const grupo = await chatInternoService.createConversaGrupo({
  nome: "Equipe de Recepção",
  descricao: "Grupo para comunicação da equipe de recepção",
  participantesIds: [1, 2, 3, 4]
});
```

### Exemplo 3: Enviar mensagem
```typescript
// No frontend
await chatInternoService.sendMensagem({
  conversaId: 1,
  tipo: 'TEXTO',
  conteudo: 'Olá, como vai?',
  criptografar: false
});
```

### Exemplo 4: Usar WebSocket diretamente
```typescript
const { enviarMensagem, isConnected } = useChatInternoWebSocket({
  conversaId: 1,
  onNovaMensagem: (mensagem) => {
    console.log('Nova mensagem:', mensagem);
  }
});

// Enviar mensagem
enviarMensagem({
  conversaId: 1,
  tipo: 'TEXTO',
  conteudo: 'Mensagem via WebSocket'
});
```

## 🎯 Dicas de Uso

1. **Organize por grupos**: Crie grupos por setor (Recepção, Enfermagem, etc.)
2. **Use busca**: A busca ajuda a encontrar conversas rapidamente
3. **Mensagens criptografadas**: Use para informações sensíveis
4. **Status online**: Veja quem está disponível antes de enviar mensagem importante
5. **Mensagens não lidas**: O badge ajuda a não perder mensagens importantes

## 📚 Documentação Técnica

Para mais detalhes sobre a API, consulte:
- `backend/README-CHAT-INTERNO.md` - Documentação completa da API
- `IMPLEMENTACAO-CHAT-INTERNO.md` - Detalhes técnicos da implementação

