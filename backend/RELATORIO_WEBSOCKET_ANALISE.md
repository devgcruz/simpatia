# Relatório de Análise de Segurança e Melhorias - WebSocket Service

**Data:** $(date)  
**Arquivo Analisado:** `backend/src/services/websocket.service.ts`  
**Total de Linhas:** 2077

---

## 📋 Sumário Executivo

Este relatório apresenta uma análise completa do serviço WebSocket, identificando:
- ✅ **Pontos Fortes:** O código possui várias camadas de segurança implementadas
- ⚠️ **Vulnerabilidades Críticas:** 3 vulnerabilidades de segurança identificadas
- 🔧 **Melhorias Recomendadas:** 15 melhorias sugeridas
- 📊 **Problemas de Performance:** 4 pontos de otimização identificados

---

## 🔴 VULNERABILIDADES CRÍTICAS DE SEGURANÇA

### 1. **Race Condition na Blacklist de Tokens** ⚠️ CRÍTICO
**Localização:** Linhas 14, 935-944, 978-986

**Problema:**
```typescript
// Linha 14: Map compartilhado sem sincronização
export const tokenBlacklist = new Map<string, number>();

// Linha 935-944: Verificação e remoção não são atômicas
if (tokenBlacklist.has(cleanToken)) {
  const expiresAt = tokenBlacklist.get(cleanToken);
  if (expiresAt && expiresAt > Date.now()) {
    return { valid: false, error: 'Token foi invalidado...' };
  }
  tokenBlacklist.delete(cleanToken); // Race condition aqui
}
```

**Impacto:**
- Em ambiente multi-threaded ou com múltiplas instâncias do servidor, tokens podem ser validados após serem adicionados à blacklist
- Possibilidade de usar tokens invalidados durante logout

**Solução Recomendada:**
- Usar estrutura de dados thread-safe (Redis com operações atômicas)
- Implementar locks ou usar Map com operações atômicas
- Considerar usar `WeakMap` ou estrutura persistente para multi-instância

---

### 2. **Memory Leak em Rate Limiting Maps** ⚠️ ALTO
**Localização:** Linhas 48-49, 53-54, 396-420

**Problema:**
```typescript
// Maps que crescem indefinidamente
const ipRateLimits = new Map<string, {...}>();
const socketRateLimits = new Map<string, SocketRateLimit>();
const activeConnectionsByIP = new Map<string, Set<string>>();
const socketRooms = new Map<string, Set<string>>();
```

**Impacto:**
- Em servidores de alta carga, os Maps podem crescer indefinidamente
- Limpeza a cada 5 minutos pode não ser suficiente
- Pode causar Out of Memory (OOM) em longos períodos de operação

**Solução Recomendada:**
- Implementar TTL (Time To Live) automático nos Maps
- Usar estrutura LRU (Least Recently Used) com limite máximo
- Considerar Redis para rate limiting distribuído
- Limpeza mais frequente (a cada 1 minuto) ou baseada em tamanho

---

### 3. **Validação de Origin/Host Pode Ser Bypassada** ⚠️ MÉDIO
**Localização:** Linhas 1022-1113, 1219-1224

**Problema:**
```typescript
// Linha 1029-1042: Permite conexões sem Origin em desenvolvimento
if (!origin) {
  if (isProduction) {
    return false;
  }
  // Em desenvolvimento, permitir apenas localhost
  if (!isLocalhost) {
    return false;
  }
  // Ainda permite sem Origin
  console.warn('[WebSocket] AVISO: Conexão sem Origin...');
}
```

**Impacto:**
- Em desenvolvimento, conexões sem Origin são permitidas
- Headers podem ser falsificados em ambiente de desenvolvimento
- Falta validação de subdomínios wildcard

**Solução Recomendada:**
- Sempre exigir Origin, mesmo em desenvolvimento
- Validar lista de origens permitidas via variável de ambiente
- Implementar validação de subdomínios se necessário
- Adicionar validação de certificado SSL em produção

---

## 🟡 VULNERABILIDADES MÉDIAS

### 4. **Falta de Rate Limiting Global Distribuído**
**Localização:** Linhas 34-92

**Problema:**
- Rate limiting é apenas em memória local
- Em ambiente com múltiplas instâncias, cada instância tem seu próprio contador
- Ataques distribuídos podem bypassar o rate limiting

**Solução:**
- Implementar rate limiting usando Redis compartilhado
- Usar biblioteca como `ioredis` com `rate-limiter-flexible`

---

### 5. **Token em Cookie Pode Ser Exposto a XSS**
**Localização:** Linhas 1261-1276

**Problema:**
```typescript
// Linha 1271: Lê token de cookie sem verificar HttpOnly flag
const [name, value] = cookie.trim().split('=');
if (name === 'token' && value) {
  tokenFromCookie = decodeURIComponent(value);
}
```

**Impacto:**
- Se o cookie não tiver flag `HttpOnly`, pode ser acessado via JavaScript
- Vulnerável a ataques XSS se o frontend não sanitizar corretamente

**Solução:**
- Garantir que cookies de autenticação sempre tenham flag `HttpOnly`
- Adicionar validação para garantir que cookies sensíveis não sejam acessíveis via JS
- Considerar usar apenas Authorization header para WebSocket

---

### 6. **Validação de Dados Insuficiente em Queries Prisma**
**Localização:** Linhas 1446-1500, 1505-1549

**Problema:**
- Embora `doutorId` seja validado como número, não há validação se o ID existe antes de fazer join na sala
- Queries podem ser executadas mesmo com IDs inválidos

**Solução:**
- Adicionar validação prévia de existência do recurso
- Implementar cache de validações para reduzir queries ao banco
- Adicionar timeout nas queries Prisma

---

## 🟢 MELHORIAS DE SEGURANÇA

### 7. **Falta de Logging de Auditoria Estruturado**
**Problema:**
- Logs são apenas `console.log/error/warn`
- Não há rastreamento de ações de segurança para auditoria
- Difícil identificar padrões de ataque

**Solução:**
- Implementar sistema de logging estruturado (Winston, Pino)
- Registrar todas as tentativas de autenticação falhadas
- Criar alertas para padrões suspeitos (múltiplas tentativas, IPs bloqueados)

---

### 8. **Falta de Validação de Tamanho de Payload em Eventos**
**Localização:** Linha 430

**Problema:**
- `MAX_MESSAGE_SIZE` é 10KB, mas não há validação no tamanho total de eventos emitidos
- Múltiplos eventos podem consumir muita memória

**Solução:**
- Adicionar limite de tamanho por evento emitido
- Implementar compressão para eventos grandes
- Adicionar validação de profundidade de objetos aninhados

---

### 9. **Falta de Timeout em Queries Assíncronas**
**Localização:** Linhas 1446-1500, 1505-1549, 1554-1591

**Problema:**
```typescript
prisma.secretariaDoutor.findFirst({...})
  .then((vinculo) => {
    // Sem timeout
  })
```

**Impacto:**
- Queries podem travar indefinidamente
- Conexões podem ficar abertas esperando resposta

**Solução:**
- Adicionar timeout de 5-10 segundos em todas as queries
- Implementar retry com backoff exponencial
- Usar `Promise.race()` com timeout

---

## 🔧 MELHORIAS DE CÓDIGO E PERFORMANCE

### 10. **Duplicação de Código na Validação de Salas**
**Localização:** Linhas 1363-1597, 1600-1725

**Problema:**
- Lógica de validação de `subscribe:doutor` e `subscribe:clinica` é muito similar
- Código duplicado dificulta manutenção

**Solução:**
- Extrair lógica comum para funções reutilizáveis
- Criar factory pattern para handlers de subscription
- Reduzir duplicação usando generics TypeScript

---

### 11. **Falta de Tratamento de Erros em Promises**
**Localização:** Múltiplas linhas com `.then().catch()`

**Problema:**
- Alguns `.catch()` apenas logam erro sem notificar o cliente
- Cliente pode ficar esperando resposta indefinidamente

**Solução:**
- Sempre emitir erro para o socket em caso de falha
- Implementar retry automático para erros transitórios
- Adicionar circuit breaker para falhas recorrentes

---

### 12. **Ineficiência na Limpeza de Rate Limits**
**Localização:** Linhas 396-420

**Problema:**
```typescript
// Itera sobre TODOS os entries a cada 5 minutos
for (const [ip, ipLimit] of ipRateLimits.entries()) {
  if (now > ipLimit.connections.resetTime + RATE_LIMIT_CONFIG.RECONNECTION_WINDOW_MS) {
    ipRateLimits.delete(ip);
  }
}
```

**Impacto:**
- Em Maps grandes, a iteração pode ser lenta
- Bloqueia o event loop durante limpeza

**Solução:**
- Usar limpeza incremental (processar em batches)
- Usar `setImmediate()` ou `process.nextTick()` para não bloquear
- Implementar limpeza lazy (limpar apenas quando necessário)

---

### 13. **Falta de Métricas e Monitoramento**
**Problema:**
- Estatísticas são apenas logadas, não expostas para monitoramento
- Não há métricas para dashboards (Prometheus, Grafana)

**Solução:**
- Expor endpoint de métricas `/metrics` (formato Prometheus)
- Adicionar contadores para: conexões ativas, mensagens bloqueadas, erros
- Implementar health check endpoint

---

### 14. **Validação de Schema Zod Pode Ser Otimizada**
**Localização:** Linhas 455-469

**Problema:**
- Schemas Zod são criados a cada validação (não são reutilizados eficientemente)
- Validação pode ser lenta para mensagens frequentes

**Solução:**
- Cachear schemas compilados
- Usar `z.preprocess()` para otimizar validações comuns
- Considerar validação assíncrona para schemas complexos

---

### 15. **Falta de Type Safety em Alguns Lugares**
**Localização:** Linhas 901-907, 1826-1902

**Problema:**
```typescript
interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    role: string; // Deveria ser enum
    clinicaId: number; // Pode ser null
  };
}
```

**Solução:**
- Usar enum para `role` em vez de string
- Tornar `clinicaId` nullable explicitamente
- Adicionar tipos mais específicos para eventos

---

## 📊 PROBLEMAS DE PERFORMANCE

### 16. **Múltiplas Queries ao Banco em Sequência**
**Localização:** Linhas 1446-1500

**Problema:**
- Para SECRETARIA, faz query para `secretariaDoutor` e depois precisa do `doutor`
- Poderia ser uma query única com `include`

**Solução:**
- Otimizar queries usando `include` do Prisma
- Implementar cache de validações (Redis)
- Usar batch queries quando possível

---

### 17. **Sanitização de Objetos Pode Ser Custosa**
**Localização:** Linhas 474-502

**Problema:**
- `sanitizeObject()` faz recursão profunda em objetos grandes
- Pode ser lento para agendamentos com muitos dados relacionados

**Solução:**
- Limitar profundidade de recursão (ex: max 5 níveis)
- Usar `structuredClone()` nativo quando disponível
- Implementar sanitização lazy (só quando necessário)

---

### 18. **Falta de Connection Pooling para WebSocket**
**Problema:**
- Não há limite de conexões simultâneas no servidor
- Pode esgotar recursos do sistema

**Solução:**
- Implementar limite global de conexões
- Adicionar queue para conexões quando limite for atingido
- Monitorar uso de memória e CPU

---

### 19. **Emit de Eventos Pode Ser Otimizado**
**Localização:** Linhas 2027-2065

**Problema:**
```typescript
// Emite para duas salas separadamente
io.to(doutorRoom).emit('agendamento:updated', {...});
io.to(clinicaRoom).emit('agendamento:updated', {...});
```

**Solução:**
- Se possível, combinar salas em uma única emissão
- Implementar batching de eventos (agrupar múltiplos eventos)
- Adicionar debounce para eventos muito frequentes

---

## ✅ PONTOS FORTES DO CÓDIGO

1. **Validação Extensiva de Mensagens:** Uso de Zod e validação em múltiplas camadas
2. **Rate Limiting Implementado:** Proteção contra flood de mensagens e conexões
3. **Sanitização de Dados:** Prevenção de prototype poisoning e SQL injection
4. **Validação de Permissões:** Verificação rigorosa de acesso a salas
5. **Mascaramento de Dados Sensíveis:** CPF e telefone são mascarados antes de enviar
6. **Blacklist de Tokens:** Implementação de logout com invalidação de tokens
7. **Validação de Origin/Host:** Proteção contra CSWSH (Cross-Site WebSocket Hijacking)
8. **Whitelist de Comandos:** Apenas eventos permitidos são aceitos
9. **Logging Detalhado:** Boa cobertura de logs para debugging
10. **Validação de Tipos:** Uso de TypeScript e validação de tipos em runtime

---

## 🎯 PRIORIZAÇÃO DE CORREÇÕES

### 🔴 CRÍTICO (Corrigir Imediatamente)
1. Race condition na blacklist de tokens (#1)
2. Memory leak em Maps de rate limiting (#2)
3. Implementar rate limiting distribuído (#4)

### 🟡 ALTO (Corrigir em 1-2 semanas)
4. Validação de Origin/Host (#3)
5. Timeout em queries assíncronas (#9)
6. Tratamento de erros em Promises (#11)
7. Métricas e monitoramento (#13)

### 🟢 MÉDIO (Melhorias contínuas)
8. Logging de auditoria (#7)
9. Otimização de queries (#16)
10. Refatoração de código duplicado (#10)
11. Type safety (#15)

---

## 📝 RECOMENDAÇÕES GERAIS

### Arquitetura
- **Considerar usar Redis** para rate limiting distribuído e blacklist de tokens
- **Implementar message queue** (RabbitMQ, Kafka) para eventos de alta frequência
- **Adicionar API Gateway** para centralizar autenticação e rate limiting

### Segurança
- **Implementar WAF** (Web Application Firewall) na camada de infraestrutura
- **Adicionar DDoS protection** (Cloudflare, AWS Shield)
- **Implementar certificate pinning** para conexões WebSocket em produção
- **Adicionar rate limiting por usuário** além de por IP

### Monitoramento
- **Integrar com sistema de alertas** (PagerDuty, Opsgenie)
- **Criar dashboards** para visualizar métricas em tempo real
- **Implementar distributed tracing** (Jaeger, Zipkin) para debug

### Testes
- **Adicionar testes unitários** para funções de validação
- **Implementar testes de carga** para verificar rate limiting
- **Criar testes de segurança** (OWASP ZAP, Burp Suite)

---

## 🔗 REFERÊNCIAS

- [OWASP WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [Socket.IO Security Best Practices](https://socket.io/docs/v4/security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Rate Limiting Strategies](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

## 📌 CONCLUSÃO

O código do WebSocket demonstra **boa preocupação com segurança**, com várias camadas de proteção implementadas. No entanto, existem **vulnerabilidades críticas** relacionadas a race conditions e memory leaks que devem ser corrigidas imediatamente.

As melhorias sugeridas focam em:
1. **Segurança:** Correção de vulnerabilidades e fortalecimento das defesas
2. **Performance:** Otimização de queries e redução de uso de memória
3. **Manutenibilidade:** Redução de duplicação e melhor estruturação
4. **Observabilidade:** Métricas e monitoramento para produção

**Recomendação Final:** Priorizar correções críticas antes de deploy em produção, especialmente as relacionadas a race conditions e memory leaks.

---

**Relatório gerado por análise estática de código**  
**Última atualização:** $(date)






