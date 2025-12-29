import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../utils/crypto.util';

// Mapeamento de modelos e campos que devem ser criptografados
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Paciente: [
    'nome',
    'cpf',
    'telefone',
    'email',
    'logradouro',
    'numero',
    'cep',
    'bairro',
    'numeroCarteirinha',
    'alergias',
    'observacoes',
  ],
  Agendamento: [
    'relatoPaciente',
    'entendimentoIA',
    'motivoCancelamento',
  ],
  HistoricoPaciente: [
    'descricao',
  ],
  Prescricao: [
    'conteudo',
    'motivoInvalidacao',
  ],
  Atestado: [
    'cid',
    'conteudo',
    'motivoInvalidacao',
  ],
  // ChatMessage, ProntuarioChatMessage e MensagemInterna REMOVIDOS: Frontend já envia criptografado (E2E)
  // O servidor deve armazenar o hash "raw" sem criptografar novamente
  // MensagemInterna: ['conteudo'], // REMOVIDO - E2E do frontend
  Indisponibilidade: [
    'motivo',
  ],
  AlergiaMedicamento: [
    'observacoes',
    'justificativaExclusao',
  ],
};

/**
 * Verifica se um campo deve ser criptografado para um modelo específico
 */
function shouldEncryptField(model: string, field: string): boolean {
  return ENCRYPTED_FIELDS[model]?.includes(field) ?? false;
}

/**
 * Criptografa campos sensíveis em um objeto (suporta objetos aninhados e includes do Prisma)
 */
function encryptFields<T extends Record<string, any>>(obj: T, model: string): T {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  // Criar cópia para não mutar o original
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  let encrypted = false;

  for (const [key, value] of Object.entries(result)) {
    // Criptografar campo direto do modelo
    if (shouldEncryptField(model, key)) {
      console.log(`[Encryption] Campo ${key} detectado para criptografia no modelo ${model}. Tipo: ${typeof value}, Valor: ${value ? (typeof value === 'string' ? value.substring(0, 50) : String(value)) : 'null/undefined'}`);
      
      if (typeof value === 'string' && value && value.trim()) {
        const encrypted = encrypt(value);
        (result as any)[key] = encrypted;
        console.log(`[Encryption] ✓ Campo ${key} criptografado para modelo ${model}. Original: ${value.substring(0, 50)}... -> Criptografado: ${encrypted.substring(0, 50)}...`);
      } else {
        console.log(`[Encryption] ✗ Campo ${key} não foi criptografado (valor vazio/null ou não é string)`);
      }
      continue;
    }

    // Ignorar valores primitivos, null, undefined
    if (value === null || value === undefined || typeof value !== 'object') {
      continue;
    }

    // Ignorar Date, Buffer, etc.
    if (value instanceof Date || Buffer.isBuffer(value)) {
      continue;
    }

    // Processar objetos aninhados (includes do Prisma: paciente, agendamento, etc.)
    if (!Array.isArray(value) && value !== null) {
      // Detectar modelo relacionado pelo conteúdo
      if ('alergias' in value || 'observacoes' in value || 'cpf' in value || 'nome' in value) {
        (result as any)[key] = encryptFields(value, 'Paciente');
      } else if ('relatoPaciente' in value || 'entendimentoIA' in value || 'motivoCancelamento' in value) {
        (result as any)[key] = encryptFields(value, 'Agendamento');
      } else if ('descricao' in value) {
        (result as any)[key] = encryptFields(value, 'HistoricoPaciente');
      } else if ('conteudo' in value && 'protocolo' in value && !('cid' in value)) {
        (result as any)[key] = encryptFields(value, 'Prescricao');
      } else if ('cid' in value || ('conteudo' in value && 'diasAfastamento' in value)) {
        (result as any)[key] = encryptFields(value, 'Atestado');
      } else if ('content' in value && 'senderType' in value && 'pacienteId' in value) {
        (result as any)[key] = encryptFields(value, 'ChatMessage');
      } else if ('content' in value && 'sender' in value && 'agendamentoId' in value) {
        (result as any)[key] = encryptFields(value, 'ProntuarioChatMessage');
      } else if ('conteudo' in value && 'tipo' in value && 'conversaId' in value) {
        // MensagemInterna: NÃO criptografar - Frontend já envia criptografado (E2E)
        // (result as any)[key] = encryptFields(value, 'MensagemInterna');
      } else if ('motivo' in value && 'inicio' in value && 'fim' in value) {
        (result as any)[key] = encryptFields(value, 'Indisponibilidade');
      } else if ('justificativaExclusao' in value || ('observacoes' in value && 'principioAtivo' in value)) {
        (result as any)[key] = encryptFields(value, 'AlergiaMedicamento');
      } else {
        // Objeto genérico: processar recursivamente (pode conter campos criptografados)
        (result as any)[key] = encryptFields(value, model);
      }
    }
    // Processar arrays de objetos (ex: findMany, includes com arrays)
    else if (Array.isArray(value) && value !== null) {
      (result as any)[key] = value.map((item) => {
        if (item && typeof item === 'object' && !(item instanceof Date) && !Buffer.isBuffer(item) && item !== null) {
          // Detectar modelo pelo conteúdo
          if ('alergias' in item || 'observacoes' in item || 'cpf' in item || 'nome' in item) {
            return encryptFields(item, 'Paciente');
          } else if ('relatoPaciente' in item || 'entendimentoIA' in item || 'motivoCancelamento' in item) {
            return encryptFields(item, 'Agendamento');
          } else if ('descricao' in item) {
            return encryptFields(item, 'HistoricoPaciente');
          } else if ('conteudo' in item && 'protocolo' in item && !('cid' in item)) {
            return encryptFields(item, 'Prescricao');
          } else if ('cid' in item || ('conteudo' in item && 'diasAfastamento' in item)) {
            return encryptFields(item, 'Atestado');
          } else if ('content' in item && 'senderType' in item && 'pacienteId' in item) {
            return encryptFields(item, 'ChatMessage');
          } else if ('content' in item && 'sender' in item && 'agendamentoId' in item) {
            return encryptFields(item, 'ProntuarioChatMessage');
          } else if ('conteudo' in item && 'tipo' in item && 'conversaId' in item) {
            // MensagemInterna: NÃO criptografar - Frontend já envia criptografado (E2E)
            // return encryptFields(item, 'MensagemInterna');
            return item;
          } else if ('motivo' in item && 'inicio' in item && 'fim' in item) {
            return encryptFields(item, 'Indisponibilidade');
          } else if ('justificativaExclusao' in item || ('observacoes' in item && 'principioAtivo' in item)) {
            return encryptFields(item, 'AlergiaMedicamento');
          } else {
            // Array genérico: processar recursivamente
            return encryptFields(item, model);
          }
        }
        return item;
      });
    }
  }

  return result as T;
}

/**
 * Descriptografa campos sensíveis em um objeto (suporta objetos aninhados e includes do Prisma)
 */
function decryptFields<T extends Record<string, any>>(obj: T, model: string): T {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  // Criar cópia para não mutar o original
  const result = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const [key, value] of Object.entries(result)) {
    // Descriptografar campo direto do modelo
    if (shouldEncryptField(model, key) && typeof value === 'string' && value) {
      (result as any)[key] = decrypt(value);
      continue;
    }

    // Ignorar valores primitivos, null, undefined
    if (value === null || value === undefined || typeof value !== 'object') {
      continue;
    }

    // Ignorar Date, Buffer, etc.
    if (value instanceof Date || Buffer.isBuffer(value)) {
      continue;
    }

    // Processar objetos aninhados (includes do Prisma: paciente, agendamento, etc.)
    if (!Array.isArray(value) && value !== null) {
      // Detectar modelo relacionado pelo conteúdo
      if ('alergias' in value || 'observacoes' in value || 'cpf' in value || 'nome' in value) {
        (result as any)[key] = decryptFields(value, 'Paciente');
      } else if ('relatoPaciente' in value || 'entendimentoIA' in value || 'motivoCancelamento' in value) {
        (result as any)[key] = decryptFields(value, 'Agendamento');
      } else if ('descricao' in value) {
        (result as any)[key] = decryptFields(value, 'HistoricoPaciente');
      } else if ('conteudo' in value && 'protocolo' in value && !('cid' in value)) {
        (result as any)[key] = decryptFields(value, 'Prescricao');
      } else if ('cid' in value || ('conteudo' in value && 'diasAfastamento' in value)) {
        (result as any)[key] = decryptFields(value, 'Atestado');
      } else if ('content' in value && 'senderType' in value && 'pacienteId' in value) {
        (result as any)[key] = decryptFields(value, 'ChatMessage');
      } else if ('content' in value && 'sender' in value && 'agendamentoId' in value) {
        (result as any)[key] = decryptFields(value, 'ProntuarioChatMessage');
      } else if ('conteudo' in value && 'tipo' in value && 'conversaId' in value) {
        // MensagemInterna: NÃO descriptografar - Frontend descriptografa (E2E)
        // (result as any)[key] = decryptFields(value, 'MensagemInterna');
      } else if ('motivo' in value && 'inicio' in value && 'fim' in value) {
        (result as any)[key] = decryptFields(value, 'Indisponibilidade');
      } else if ('justificativaExclusao' in value || ('observacoes' in value && 'principioAtivo' in value)) {
        (result as any)[key] = decryptFields(value, 'AlergiaMedicamento');
      } else {
        // Objeto genérico: processar recursivamente (pode conter campos criptografados)
        (result as any)[key] = decryptFields(value, model);
      }
    }
    // Processar arrays de objetos (ex: findMany, includes com arrays)
    else if (Array.isArray(value) && value !== null) {
      (result as any)[key] = value.map((item) => {
        if (item && typeof item === 'object' && !(item instanceof Date) && !Buffer.isBuffer(item) && item !== null) {
          // Detectar modelo pelo conteúdo
          if ('alergias' in item || 'observacoes' in item || 'cpf' in item || 'nome' in item) {
            return decryptFields(item, 'Paciente');
          } else if ('relatoPaciente' in item || 'entendimentoIA' in item || 'motivoCancelamento' in item) {
            return decryptFields(item, 'Agendamento');
          } else if ('descricao' in item) {
            return decryptFields(item, 'HistoricoPaciente');
          } else if ('conteudo' in item && 'protocolo' in item && !('cid' in item)) {
            return decryptFields(item, 'Prescricao');
          } else if ('cid' in item || ('conteudo' in item && 'diasAfastamento' in item)) {
            return decryptFields(item, 'Atestado');
          } else if ('content' in item && 'senderType' in item && 'pacienteId' in item) {
            return decryptFields(item, 'ChatMessage');
          } else if ('content' in item && 'sender' in item && 'agendamentoId' in item) {
            return decryptFields(item, 'ProntuarioChatMessage');
          } else if ('conteudo' in item && 'tipo' in item && 'conversaId' in item) {
            // MensagemInterna: NÃO descriptografar - Frontend descriptografa (E2E)
            // return decryptFields(item, 'MensagemInterna');
            return item;
          } else if ('motivo' in item && 'inicio' in item && 'fim' in item) {
            return decryptFields(item, 'Indisponibilidade');
          } else if ('justificativaExclusao' in item || ('observacoes' in item && 'principioAtivo' in item)) {
            return decryptFields(item, 'AlergiaMedicamento');
          } else {
            // Array genérico: processar recursivamente
            return decryptFields(item, model);
          }
        }
        return item;
      });
    }
  }

  return result as T;
}

// Estender o Prisma Client com middleware de criptografia (API moderna Prisma 6.x)
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Debug: Log para verificar se o middleware está sendo chamado
        if (model) {
          console.log(`[Encryption Middleware] Model: ${model}, Operation: ${operation}`);
        }

        // Operações de escrita: criptografar antes de salvar
        if (operation === 'create' || operation === 'update' || operation === 'upsert') {
          console.log(`[Encryption] Operação de escrita detectada: ${model} - ${operation}`);
          
          if (model && ENCRYPTED_FIELDS[model]) {
            console.log(`[Encryption] Modelo ${model} está na lista de criptografados. Campos:`, ENCRYPTED_FIELDS[model]);
            const argsAny = args as any;
            console.log(`[Encryption] args.data antes:`, argsAny.data ? JSON.stringify(argsAny.data).substring(0, 300) : 'null');
            
            // Criptografar dados no args.data (usar type assertion para evitar erros de tipo)
            if (argsAny.data) {
              argsAny.data = encryptFields(argsAny.data, model);
              console.log(`[Encryption] args.data depois:`, JSON.stringify(argsAny.data).substring(0, 300));
            }
            // Para upsert, também processar create e update
            if (argsAny.create) {
              console.log(`[Encryption] Processando args.create`);
              argsAny.create = encryptFields(argsAny.create, model);
            }
            if (argsAny.update) {
              console.log(`[Encryption] Processando args.update`);
              argsAny.update = encryptFields(argsAny.update, model);
            }
          } else if (model) {
            console.log(`[Encryption] Modelo ${model} não está na lista de criptografados. Lista:`, Object.keys(ENCRYPTED_FIELDS));
          }
        }

        // Executar operação
        const result = await query(args);

        // Operações de leitura: descriptografar após ler
        if (operation === 'findUnique' || operation === 'findFirst' || operation === 'findMany' || operation === 'findFirstOrThrow' || operation === 'findUniqueOrThrow') {
          if (result) {
            // Sempre processar o resultado para descriptografar campos criptografados
            // Isso garante que includes e objetos aninhados sejam processados
            if (Array.isArray(result)) {
              return result.map((item) => {
                // Detectar modelo pelo conteúdo do item
                if (item && typeof item === 'object') {
                  if ('alergias' in item || 'observacoes' in item) {
                    return decryptFields(item, 'Paciente');
                  } else if ('relatoPaciente' in item || 'entendimentoIA' in item) {
                    return decryptFields(item, 'Agendamento');
                  }
                }
                return decryptFields(item, model || '');
              });
            } else if (result && typeof result === 'object') {
              // Detectar modelo pelo conteúdo
              if ('alergias' in result || 'observacoes' in result) {
                return decryptFields(result, 'Paciente');
              } else if ('relatoPaciente' in result || 'entendimentoIA' in result) {
                return decryptFields(result, 'Agendamento');
              } else if (model && ENCRYPTED_FIELDS[model]) {
                return decryptFields(result, model);
              }
            }
          }
        }

        return result;
      },
    },
  },
});

export { prisma };
