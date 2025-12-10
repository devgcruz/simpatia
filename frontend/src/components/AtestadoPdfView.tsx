import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

interface AtestadoPdfViewProps {
  pacienteNome: string;
  pacienteCPF?: string;
  dataAtendimento: string; // Formato AAAA-MM-DD
  horaAtendimento: string; // Formato HH:mm
  diasAfastamento: number; // Pode ser decimal (ex: 0.5 para 12 horas)
  tipoAfastamento: 'dias' | 'horas';
  horaInicial?: string; // Formato HH:mm - para período de horas
  horaFinal?: string; // Formato HH:mm - para período de horas
  cid?: string;
  exibirCid: boolean;
  conteudo: string;
  localAtendimento: string;
  doutorNome: string;
  doutorEspecialidade?: string;
  doutorCRM?: string;
  doutorCRMUF?: string;
  doutorRQE?: string;
  clinicaNome: string;
  clinicaEndereco?: string;
  clinicaTelefone?: string;
  clinicaEmail?: string;
  clinicaSite?: string;
  invalidado?: boolean;
  motivoInvalidacao?: string;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    padding: 40,
    fontSize: 12,
  },
  header: {
    marginBottom: 30,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  content: {
    marginBottom: 30,
    lineHeight: 1.8,
  },
  paragraph: {
    marginBottom: 15,
    textAlign: 'justify',
    fontSize: 12,
  },
  cidSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  cidText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  observacoesSection: {
    marginTop: 15,
  },
  observacoesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  observacoesText: {
    fontSize: 12,
    textAlign: 'justify',
  },
  pacienteInfo: {
    marginBottom: 15,
    fontSize: 12,
  },
  pacienteInfoLine: {
    marginBottom: 5,
  },
  localDataSection: {
    marginTop: 30,
    marginBottom: 20,
    textAlign: 'right',
    fontSize: 12,
  },
  footer: {
    marginTop: 50,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#000000',
    marginBottom: 10,
  },
  signatureText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 5,
  },
  signatureName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  signatureInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 5,
  },
  clinicaInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
    color: '#666666',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FF0000',
    opacity: 0.3,
    zIndex: 1000,
  },
  invalidadoInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  invalidadoText: {
    fontSize: 10,
    color: '#C62828',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  invalidadoMotivo: {
    fontSize: 9,
    color: '#D32F2F',
    fontStyle: 'italic',
  },
});

const AtestadoPdfView: React.FC<AtestadoPdfViewProps> = ({
  pacienteNome,
  pacienteCPF,
  dataAtendimento,
  horaAtendimento,
  diasAfastamento,
  tipoAfastamento,
  horaInicial,
  horaFinal,
  cid,
  exibirCid,
  conteudo,
  localAtendimento,
  doutorNome,
  doutorEspecialidade,
  doutorCRM,
  doutorCRMUF,
  doutorRQE,
  clinicaNome,
  clinicaEndereco,
  clinicaTelefone,
  clinicaEmail,
  clinicaSite,
  invalidado = false,
  motivoInvalidacao,
}) => {
  const formatarData = (dataStr: string) => {
    try {
      const dataObj = new Date(dataStr);
      const dia = String(dataObj.getDate()).padStart(2, '0');
      const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
      const ano = dataObj.getFullYear();
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataStr;
    }
  };

  const formatarCPF = (cpf: string) => {
    if (!cpf) return '';
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return cpf;
    return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const dataFormatada = formatarData(dataAtendimento);

  // Formatar tempo de afastamento
  // INTEGRIDADE MÉDICA: Esta função preserva fielmente o período exato definido pelo médico.
  // Se horaInicial e horaFinal existirem, SEMPRE usar o formato "das XhXX às XhXX",
  // jamais simplificar para duração calculada, pois isso compromete a integridade do documento.
  const formatarTempoAfastamento = () => {
    // PRIORIDADE ABSOLUTA: Se houver período de horas definido (horaInicial e horaFinal), sempre usar ele
    // Isso garante que o PDF histórico seja idêntico ao PDF recém-criado
    if (horaInicial && horaFinal) {
      const formatarHora = (hora: string) => {
        // Converter de HH:mm para HHhmm (ex: "08:00" -> "08h00")
        const [h, m] = hora.split(':');
        return `${h}h${m}`;
      };
      return `das ${formatarHora(horaInicial)} às ${formatarHora(horaFinal)}`;
    }
    
    // Caso contrário, calcular baseado no tipo e diasAfastamento
    if (tipoAfastamento === 'horas') {
      // Calcular horas/minutos a partir de diasAfastamento
      const minutos = Math.round(diasAfastamento * 24 * 60);
      if (minutos < 60) {
        return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
      } else {
        const horas = Math.floor(minutos / 60);
        const minutosRestantes = minutos % 60;
        if (minutosRestantes === 0) {
          return horas === 1 ? '1 hora' : `${horas} horas`;
        } else {
          return `${horas}h${minutosRestantes.toString().padStart(2, '0')}`;
        }
      }
    } else {
      const dias = Math.floor(diasAfastamento);
      if (dias === 1) {
        return '1 dia';
      } else if (diasAfastamento < 1) {
        // Se for menos de 1 dia, calcular em minutos/horas
        const minutos = Math.round(diasAfastamento * 24 * 60);
        if (minutos < 60) {
          return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
        } else {
          const horas = Math.floor(minutos / 60);
          const minutosRestantes = minutos % 60;
          if (minutosRestantes === 0) {
            return horas === 1 ? '1 hora' : `${horas} horas`;
          } else {
            return `${horas}h${minutosRestantes.toString().padStart(2, '0')}`;
          }
        }
      } else {
        return `${dias} dias`;
      }
    }
  };

  // Determinar o texto do tempo (dias ou horas)
  const textoTempo = tipoAfastamento === 'horas' || diasAfastamento < 1 ? 'horas' : 'dias';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Marca d'água INVALIDADO */}
        {invalidado && (
          <View style={styles.watermark}>
            <Text>INVALIDADO</Text>
          </View>
        )}

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>ATESTADO MÉDICO</Text>
          {clinicaNome && (
            <Text style={styles.subtitle}>{clinicaNome}</Text>
          )}
        </View>

        {/* Conteúdo Principal */}
        <View style={styles.content}>
          {/* Informações do Paciente */}
          <View style={styles.pacienteInfo}>
            <Text style={styles.pacienteInfoLine}>
              <Text style={{ fontWeight: 'bold' }}>Paciente:</Text> {pacienteNome}
              {pacienteCPF && (
                <Text> - CPF: {formatarCPF(pacienteCPF)}</Text>
              )}
            </Text>
            <Text style={styles.pacienteInfoLine}>
              <Text style={{ fontWeight: 'bold' }}>Data:</Text> {dataFormatada}
            </Text>
          </View>

          <Text style={styles.paragraph}>
            Atesto para os devidos fins que o(a) Sr(a). <Text style={{ fontWeight: 'bold' }}>{pacienteNome}</Text> foi atendido(a) nesta data às <Text style={{ fontWeight: 'bold' }}>{horaAtendimento}</Text> no(a) <Text style={{ fontWeight: 'bold' }}>{localAtendimento}</Text>. Deverá permanecer afastado(a) de suas atividades laborais por <Text style={{ fontWeight: 'bold' }}>{formatarTempoAfastamento()}</Text> a partir desta data.
          </Text>

          {/* Seção CID - Apenas exibir se autorizado E houver código CID */}
          {exibirCid && cid && cid.trim() && (
            <View style={styles.cidSection}>
              <Text style={styles.cidText}>
                CID: {cid}
              </Text>
            </View>
          )}

          {/* Observações */}
          {conteudo && conteudo.trim() && (
            <View style={styles.observacoesSection}>
              <Text style={styles.observacoesLabel}>Observações:</Text>
              <Text style={styles.observacoesText}>{conteudo}</Text>
            </View>
          )}

          {/* Informação de Invalidação */}
          {invalidado && (
            <View style={styles.invalidadoInfo}>
              <Text style={styles.invalidadoText}>DOCUMENTO INVALIDADO</Text>
              {motivoInvalidacao && motivoInvalidacao.trim() && (
                <Text style={styles.invalidadoMotivo}>
                  Motivo: {motivoInvalidacao}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Rodapé com Assinatura */}
        <View style={styles.footer}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>Assinatura</Text>
          <Text style={styles.signatureName}>Dr(a). {doutorNome}</Text>
          {doutorEspecialidade && (
            <Text style={styles.signatureInfo}>{doutorEspecialidade}</Text>
          )}
          {doutorCRM && (
            <Text style={styles.signatureInfo}>
              CRM {doutorCRM}
              {doutorCRMUF && `-${doutorCRMUF}`}
              {doutorRQE && ` | RQE: ${doutorRQE}`}
            </Text>
          )}
          
          {/* Informações da Clínica */}
          {(clinicaEndereco || clinicaTelefone || clinicaEmail || clinicaSite) && (
            <View style={styles.clinicaInfo}>
              {clinicaEndereco && <Text>{clinicaEndereco}</Text>}
              {clinicaTelefone && <Text>Tel: {clinicaTelefone}</Text>}
              {clinicaEmail && <Text>E-mail: {clinicaEmail}</Text>}
              {clinicaSite && <Text>Site: {clinicaSite}</Text>}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

export default AtestadoPdfView;

