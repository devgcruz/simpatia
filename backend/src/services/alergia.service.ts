import { prisma } from '../lib/prisma';

interface ICreateAlergia {
  pacienteId: number;
  medicamentoId?: number;
  nomeMedicamento: string;
  principioAtivo: string; // OBRIGATÓRIO
  classeQuimica?: string;
  excipientes?: string;
  observacoes?: string;
  cadastradoPor: number;
}

interface IUpdateAlergia {
  nomeMedicamento?: string;
  principioAtivo?: string;
  classeQuimica?: string;
  excipientes?: string;
  observacoes?: string;
}

interface IVerificacaoAlergia {
  temAlergia: boolean;
  motivo?: string; // "principio_ativo", "classe_quimica", "excipiente", "nome_comercial"
  alergiaEncontrada?: {
    principioAtivo: string;
    classeQuimica?: string;
    excipientes?: string;
  };
}

class AlergiaService {
  async create(data: ICreateAlergia) {
    return await prisma.alergiaMedicamento.create({
      data,
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
          },
        },
        medicamento: {
          select: {
            id: true,
            nomeProduto: true,
            principioAtivo: true,
          },
        },
      },
    });
  }

  async findByPaciente(pacienteId: number, incluirDeletadas: boolean = false) {
    return await prisma.alergiaMedicamento.findMany({
      where: { 
        pacienteId,
        ...(incluirDeletadas ? {} : { ativo: true })
      },
      include: {
        medicamento: {
          select: {
            id: true,
            nomeProduto: true,
            principioAtivo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Normaliza uma string para comparação (remove acentos, espaços extras, etc.)
   */
  private normalizarString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim()
      .replace(/\s+/g, ' '); // Remove espaços múltiplos
  }

  /**
   * Verifica se dois princípios ativos são iguais ou similares
   */
  private compararPrincipiosAtivos(principio1: string, principio2: string): boolean {
    const p1 = this.normalizarString(principio1);
    const p2 = this.normalizarString(principio2);
    
    // Comparação exata
    if (p1 === p2) return true;
    
    // Verifica se um contém o outro (para casos como "amoxicilina" vs "amoxicilina tri-hidratada")
    if (p1.includes(p2) || p2.includes(p1)) return true;
    
    // Verifica palavras-chave comuns (para casos como "penicilina" vs "penicilina G")
    const palavras1 = p1.split(/\s+/);
    const palavras2 = p2.split(/\s+/);
    
    // Se compartilham a palavra principal (primeira palavra geralmente é o princípio)
    if (palavras1[0] === palavras2[0] && palavras1[0].length > 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Verifica se há reatividade cruzada por classe química
   */
  private verificarReatividadeCruzada(classeAlergia: string | null, classeMedicamento: string | null): boolean {
    if (!classeAlergia || !classeMedicamento) return false;
    
    const classeAlergiaNorm = this.normalizarString(classeAlergia);
    const classeMedNorm = this.normalizarString(classeMedicamento);
    
    // Reatividade cruzada conhecida: penicilina ↔ cefalosporina
    const reatividadeCruzada: { [key: string]: string[] } = {
      'penicilina': ['cefalosporina', 'cefalosporinas'],
      'cefalosporina': ['penicilina', 'penicilinas'],
      'cefalosporinas': ['penicilina', 'penicilinas'],
    };
    
    for (const [classe, classesRelacionadas] of Object.entries(reatividadeCruzada)) {
      if (classeAlergiaNorm.includes(classe) || classeMedNorm.includes(classe)) {
        for (const classeRel of classesRelacionadas) {
          if (classeAlergiaNorm.includes(classeRel) || classeMedNorm.includes(classeRel)) {
            return true;
          }
        }
      }
    }
    
    // Comparação direta
    if (classeAlergiaNorm === classeMedNorm) return true;
    if (classeAlergiaNorm.includes(classeMedNorm) || classeMedNorm.includes(classeAlergiaNorm)) {
      return true;
    }
    
    return false;
  }

  /**
   * Verifica alergia a excipientes
   */
  private verificarExcipientes(excipientesAlergia: string | null, excipientesMedicamento: string | null): boolean {
    if (!excipientesAlergia || !excipientesMedicamento) return false;
    
    const excAlergiaNorm = this.normalizarString(excipientesAlergia);
    const excMedNorm = this.normalizarString(excipientesMedicamento);
    
    // Lista de excipientes comuns para verificação
    const excipientesComuns = ['látex', 'latex', 'lactose', 'corante amarelo', 'amarelo nº 5', 'propilenoglicol', 'parabeno', 'sulfito'];
    
    for (const exc of excipientesComuns) {
      if (excAlergiaNorm.includes(exc) && excMedNorm.includes(exc)) {
        return true;
      }
    }
    
    // Comparação direta
    if (excAlergiaNorm === excMedNorm) return true;
    if (excAlergiaNorm.includes(excMedNorm) || excMedNorm.includes(excAlergiaNorm)) {
      return true;
    }
    
    return false;
  }

  async verificarAlergia(
    pacienteId: number, 
    nomeMedicamento: string, 
    principioAtivo?: string,
    classeTerapeutica?: string,
    excipientes?: string
  ): Promise<IVerificacaoAlergia> {
    const alergias = await this.findByPaciente(pacienteId, false); // Apenas alergias ativas
    
    if (alergias.length === 0) {
      return { temAlergia: false };
    }

    const nomeMedicamentoLower = this.normalizarString(nomeMedicamento);
    const principioAtivoLower = principioAtivo ? this.normalizarString(principioAtivo) : null;
    const classeTerapeuticaLower = classeTerapeutica ? this.normalizarString(classeTerapeutica) : null;
    const excipientesLower = excipientes ? this.normalizarString(excipientes) : null;

    for (const alergia of alergias) {
      const alergiaPrincipioLower = this.normalizarString(alergia.principioAtivo);
      const alergiaClasseLower = alergia.classeQuimica ? this.normalizarString(alergia.classeQuimica) : null;
      const alergiaExcipientesLower = alergia.excipientes ? this.normalizarString(alergia.excipientes) : null;

      // 1. VERIFICAÇÃO POR PRINCÍPIO ATIVO (OBRIGATÓRIO - PRIORIDADE MÁXIMA)
      if (principioAtivoLower && this.compararPrincipiosAtivos(principioAtivoLower, alergiaPrincipioLower)) {
        return {
          temAlergia: true,
          motivo: 'principio_ativo',
          alergiaEncontrada: {
            principioAtivo: alergia.principioAtivo,
            classeQuimica: alergia.classeQuimica || undefined,
            excipientes: alergia.excipientes || undefined,
          },
        };
      }

      // 2. VERIFICAÇÃO POR CLASSE QUÍMICA/FARMACOLÓGICA (REATIVIDADE CRUZADA)
      if (classeTerapeuticaLower && alergiaClasseLower) {
        if (this.verificarReatividadeCruzada(alergiaClasseLower, classeTerapeuticaLower)) {
          return {
            temAlergia: true,
            motivo: 'classe_quimica',
            alergiaEncontrada: {
              principioAtivo: alergia.principioAtivo,
              classeQuimica: alergia.classeQuimica || undefined,
              excipientes: alergia.excipientes || undefined,
            },
          };
        }
      }

      // 3. VERIFICAÇÃO POR EXCIPIENTES/ADITIVOS
      if (excipientesLower && alergiaExcipientesLower) {
        if (this.verificarExcipientes(alergiaExcipientesLower, excipientesLower)) {
          return {
            temAlergia: true,
            motivo: 'excipiente',
            alergiaEncontrada: {
              principioAtivo: alergia.principioAtivo,
              classeQuimica: alergia.classeQuimica || undefined,
              excipientes: alergia.excipientes || undefined,
            },
          };
        }
      }

      // 4. VERIFICAÇÃO POR NOME COMERCIAL (apenas como fallback, se não houver princípio ativo)
      // Se o medicamento não tem princípio ativo cadastrado, verifica pelo nome
      if (!principioAtivoLower) {
        const alergiaNomeLower = this.normalizarString(alergia.nomeMedicamento);
        if (nomeMedicamentoLower === alergiaNomeLower || 
            nomeMedicamentoLower.includes(alergiaNomeLower) || 
            alergiaNomeLower.includes(nomeMedicamentoLower)) {
          return {
            temAlergia: true,
            motivo: 'nome_comercial',
            alergiaEncontrada: {
              principioAtivo: alergia.principioAtivo,
              classeQuimica: alergia.classeQuimica || undefined,
              excipientes: alergia.excipientes || undefined,
            },
          };
        }
      }
    }

    return { temAlergia: false };
  }

  async verificarAlergiasEmMedicamentos(
    pacienteId: number, 
    medicamentos: Array<{ 
      nome: string; 
      principioAtivo?: string;
      classeTerapeutica?: string;
      excipientes?: string;
    }>
  ): Promise<Array<{ nome: string; temAlergia: boolean; motivo?: string; alergiaEncontrada?: any }>> {
    const resultados = await Promise.all(
      medicamentos.map(async (medicamento) => {
        const verificacao = await this.verificarAlergia(
          pacienteId,
          medicamento.nome,
          medicamento.principioAtivo,
          medicamento.classeTerapeutica,
          medicamento.excipientes
        );
        
        return {
          nome: medicamento.nome,
          temAlergia: verificacao.temAlergia,
          motivo: verificacao.motivo,
          alergiaEncontrada: verificacao.alergiaEncontrada,
        };
      })
    );

    return resultados;
  }

  async update(id: number, data: IUpdateAlergia) {
    return await prisma.alergiaMedicamento.update({
      where: { id },
      data,
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
          },
        },
        medicamento: {
          select: {
            id: true,
            nomeProduto: true,
            principioAtivo: true,
          },
        },
      },
    });
  }

  async delete(id: number, deletadoPor: number, justificativaExclusao: string) {
    await prisma.alergiaMedicamento.update({
      where: { id },
      data: {
        ativo: false,
        deletadoPor,
        justificativaExclusao,
        deletadoEm: new Date(),
      },
    });
    return { message: 'Alergia removida com sucesso' };
  }
}

export default new AlergiaService();

