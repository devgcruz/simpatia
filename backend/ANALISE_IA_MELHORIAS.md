# Análise do Sistema de IA - Melhorias Implementadas e Pendentes

## 📊 Status Atual do Sistema

### ✅ O que já está funcionando:
1. **Estrutura básica de IA** - Integração com Google Gemini
2. **Ferramentas básicas** - Listar serviços, verificar disponibilidade, marcar agendamento
3. **Histórico de chat** - Sistema de memória com SenderType.TOOL
4. **Handoff** - Transferência para atendimento humano
5. **Gestão de agendamentos** - Listar e cancelar

### ❌ O que está faltando (comparado ao briefing):

## 🎯 Melhorias Implementadas (Hoje)

### 1. ✅ SYSTEM_PROMPT Melhorado
- **Antes:** Instruções genéricas e pouco específicas
- **Depois:** 
  - Exemplos concretos de classificação de sintomas
  - Instruções detalhadas sobre fluxo de atendimento
  - Regras claras sobre quando usar cada ferramenta
  - Enfoque em proatividade e contexto

**Principais melhorias:**
- Exemplos de classificação: "dor de dente" → odontologia, "botox" → harmonização facial
- Instruções claras sobre coleta de dados (uma pergunta por vez)
- Orientação sobre sugestão de horários
- Ênfase em não ter amnésia e usar contexto

### 2. ✅ Descrições de Ferramentas Melhoradas
- `verificar_disponibilidade_horarios`: Agora especifica quando usar e como apresentar resultados
- `marcar_agendamento_paciente`: Enfatiza necessidade de confirmar todos os dados antes

## 🚀 Melhorias Pendentes (Prioridade Alta)

### 1. ⚠️ Classificação Inteligente de Sintomas (PRIORIDADE ALTA)
**Problema:** A IA não está classificando bem sintomas para serviços.

**Solução Proposta:**
- Criar uma ferramenta `classificar_sintoma_para_servico` que:
  - Recebe o sintoma/procedimento mencionado pelo paciente
  - Busca no catálogo de serviços por palavras-chave
  - Retorna o servicoId mais provável
  - Sugere doutorId baseado na especialidade

**Implementação:**
```typescript
// Nova ferramenta em ia.tools.ts
export function createClassificarSintomaTool(clinicaId: number) {
  return new DynamicStructuredTool({
    name: 'classificar_sintoma_para_servico',
    description: 'Classifica sintomas ou procedimentos mencionados pelo paciente e encontra o serviço mais adequado no catálogo. Use quando o paciente mencionar sintomas como "dor de dente", "botox", "limpeza de pele", etc.',
    schema: z.object({
      sintomaOuProcedimento: z.string().describe('O sintoma ou procedimento mencionado pelo paciente (ex: "dor de dente", "botox", "limpeza")'),
    }),
    func: async ({ sintomaOuProcedimento }) => {
      // Buscar serviços que correspondem ao sintoma
      // Retornar servicoId e sugestão de doutorId
    }
  });
}
```

### 2. ⚠️ Sugestão Inteligente de Horários (PRIORIDADE MÉDIA)
**Problema:** A ferramenta de disponibilidade retorna apenas horários, sem lógica de sugestão.

**Solução Proposta:**
- Melhorar `verificar_disponibilidade_horarios` para:
  - Considerar duração do serviço
  - Priorizar horários antes das 17h para procedimentos estéticos
  - Sugerir horários com base em urgência
  - Evitar buracos na agenda

### 3. ⚠️ Sistema de Lembretes Automáticos (PRIORIDADE MÉDIA)
**Problema:** Não existe sistema de lembretes.

**Solução Proposta:**
- Criar serviço de lembretes (`lembretes.service.ts`)
- Usar cron job ou scheduler
- Enviar lembretes 24h antes, 2h antes
- Incluir instruções pré-consulta

**Implementação:**
```typescript
// Novo serviço
class LembretesService {
  async enviarLembrete24h(agendamentoId: number) { }
  async enviarLembrete2h(agendamentoId: number) { }
  async enviarInstrucoesPreConsulta(agendamentoId: number) { }
}
```

### 4. ⚠️ Pós-Atendimento Automático (PRIORIDADE BAIXA)
**Problema:** Não existe follow-up após atendimento.

**Solução Proposta:**
- Criar serviço de pós-atendimento
- Enviar mensagem após agendamento com cuidados
- Oferecer retorno quando relevante
- Pesquisa de satisfação

### 5. ⚠️ Upsell Ético (PRIORIDADE BAIXA)
**Problema:** Não existe sugestão de serviços complementares.

**Solução Proposta:**
- Criar lógica de serviços relacionados
- Sugerir após agendamento (ex: "Clareamento → manutenção em 6 meses")
- Ser ético e não invasivo

## 🔧 Melhorias Técnicas Recomendadas

### 1. Modelo de IA
- **Atual:** `gemini-2.5-flash-lite` (mais rápido, menos inteligente)
- **Recomendado:** `gemini-2.5-pro` ou `gemini-1.5-pro` (mais inteligente para classificação)

### 2. Temperature
- **Atual:** `temperature: 0` (muito determinístico)
- **Recomendado:** `temperature: 0.3` (um pouco mais criativo, mas ainda consistente)

### 3. Histórico de Chat
- **Atual:** Últimas 20 mensagens
- **Recomendado:** Considerar aumentar para 30-40 para conversas longas

## 📝 Próximos Passos Recomendados

1. **Imediato:** Implementar ferramenta de classificação de sintomas
2. **Curto prazo:** Melhorar lógica de sugestão de horários
3. **Médio prazo:** Sistema de lembretes automáticos
4. **Longo prazo:** Pós-atendimento e upsell ético

## 🎯 Métricas de Sucesso

Para medir se a IA está melhor:
- Taxa de agendamentos bem-sucedidos
- Redução de handoffs desnecessários
- Tempo médio de conversa até agendamento
- Satisfação do paciente (via pesquisa)

