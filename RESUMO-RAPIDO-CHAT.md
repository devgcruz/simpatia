# 🚀 Resumo Rápido - Como Usar o Chat Interno

## 📍 Acesso Rápido

1. **Pelo Menu**: Clique em "Chat Interno" no menu lateral
2. **Pela URL**: `http://localhost:3000/chat-interno`

## 🎯 Passo a Passo Básico

### 1️⃣ Primeira Vez Usando

1. Faça **logout** e **login novamente** (para obter token RS256)
2. Acesse o Chat Interno pelo menu
3. A lista de conversas aparecerá à esquerda

### 2️⃣ Criar Conversa Individual

**Opção A - Via Interface (quando implementado):**
- Botão "Nova Conversa" → Selecionar usuário

**Opção B - Via API (atual):**
```javascript
// No console do navegador ou via código
const response = await fetch('/api/chat-interno/conversas/individual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ usuarioId2: 2 }) // ID do outro usuário
});
```

### 3️⃣ Criar Grupo (Apenas Admins)

**Via API:**
```javascript
const response = await fetch('/api/chat-interno/conversas/grupo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    nome: "Equipe de Recepção",
    descricao: "Grupo da equipe",
    participantesIds: [1, 2, 3, 4]
  })
});
```

### 4️⃣ Enviar Mensagem

1. Selecione uma conversa na lista à esquerda
2. Digite sua mensagem no campo de texto
3. Pressione **Enter** ou clique no botão **Enviar** (➤)

### 5️⃣ Ver Mensagens

- Mensagens aparecem automaticamente em tempo real
- Suas mensagens: à direita (azul)
- Mensagens de outros: à esquerda (branco)
- Scroll automático para última mensagem

## 🎨 Indicadores Visuais

| Indicador | Significado |
|-----------|------------|
| 🔴 Badge numérico | Mensagens não lidas |
| ✓✓ (duas marcas) | Mensagem foi lida |
| ✓ (uma marca) | Mensagem enviada |
| "X digitando..." | Alguém está digitando |
| 🟢 Conectado | WebSocket funcionando |
| 🔴 Desconectado | Sem conexão WebSocket |

## ⚡ Atalhos

- **Enter**: Enviar mensagem
- **Shift + Enter**: Nova linha (quando implementado)
- **Busca**: Digite no campo de busca para filtrar conversas

## 🔐 Permissões

| Ação | Quem Pode |
|------|-----------|
| Criar conversa individual | Todos |
| Criar grupo | Apenas Admins |
| Enviar mensagem | Todos |
| Adicionar participante | Admins ou criador do grupo |
| Remover participante | Admins ou criador do grupo |

## 🐛 Problemas Comuns

### ❌ "Token inválido" ou "invalid algorithm"
**Solução**: Faça logout e login novamente

### ❌ WebSocket não conecta
**Solução**: 
1. Verifique se o backend está rodando
2. Faça login novamente
3. Verifique o console do navegador

### ❌ Não consigo criar grupo
**Solução**: Verifique se seu usuário tem role `CLINICA_ADMIN` ou `SUPER_ADMIN`

### ❌ Mensagens não aparecem
**Solução**:
1. Verifique se está conectado (status no header)
2. Recarregue a página
3. Verifique o console para erros

## 📱 Interface

```
┌─────────────────────┬────────────────────────────┐
│  Chat Interno       │  Nome da Conversa          │
│  [🔍 Buscar...]     │  Status: Conectado 🟢      │
├─────────────────────┼────────────────────────────┤
│  👤 Conversa 1  (3) │                            │
│  👥 Grupo Recepção  │  [Mensagens aparecem aqui]│
│  👤 Conversa 2      │                            │
│                     │                            │
│                     │  [Digite aqui...] [➤]     │
└─────────────────────┴────────────────────────────┘
```

## 💡 Dicas

1. **Organize por grupos**: Crie grupos por setor (Recepção, Enfermagem, etc.)
2. **Use a busca**: Encontre conversas rapidamente
3. **Mensagens criptografadas**: Use para informações sensíveis (via API)
4. **Status online**: Veja quem está disponível
5. **Badge de não lidas**: Não perca mensagens importantes

## 📚 Mais Informações

Para detalhes completos, consulte: `GUIA-USO-CHAT-INTERNO.md`

