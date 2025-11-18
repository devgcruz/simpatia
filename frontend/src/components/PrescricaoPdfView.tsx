import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../types/prescricao';

interface PrescricaoPdfViewProps {
  pacienteNome: string;
  pacienteEndereco: string;
  pacienteCPF?: string; // CPF do paciente
  data?: string; // Formato AAAA-MM-DD (opcional, removido da exibição automática)
  seguroSaude: string; // "Insurance" na imagem
  diagnostico: string;
  doutorNome: string;
  doutorEspecialidade: string; // "Urologist" na imagem
  doutorTagline: string; // "your tagline here" na imagem
  doutorCRM?: string; // CRM do médico
  doutorCRMUF?: string; // UF do CRM
  doutorRQE?: string; // RQE (Registro de Qualificação de Especialista)
  itensPrescricao: string[]; // Array de strings, cada uma é uma linha da prescrição (Rx)
  clinicaNome: string;
  clinicaEndereco: string;
  clinicaTelefone: string;
  clinicaEmail: string;
  clinicaSite: string;
  clinicaCNPJ?: string; // CNPJ da clínica (obrigatório para receitas de controle especial)
  clinicaLogoUrl?: string; // URL da imagem do logo da clínica para a marca d'água
  modelo?: IModeloPrescricaoPDF; // Modelo personalizado do doutor
  isControleEspecial?: boolean; // Se for receita de controle especial (branca em duas vias)
}

// Função para criar estilos dinâmicos baseados no modelo
const criarEstilos = (modelo: IModeloPrescricaoPDF, escalaFonte: number = 1) => StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    padding: 0,
  },
  header: {
    backgroundColor: modelo.header.backgroundColor,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Alinhar ao topo para permitir quebra de linha
    marginBottom: 30,
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '55%', // Limitar largura do header esquerdo
    flexShrink: 1, // Permitir encolher se necessário
  },
  logoHeader: {
    width: modelo.header.logoHeaderSize.width,
    height: modelo.header.logoHeaderSize.height,
    marginRight: 10,
  },
  headerRight: {
    textAlign: 'right',
    maxWidth: '45%', // Limitar largura do header direito para não sobrepor
    flexShrink: 1, // Permitir encolher se necessário
  },
  title: {
    fontSize: modelo.medicoInfo.nomeSize * escalaFonte * 0.7, // Reduzir ainda mais o nome do doutor
    fontWeight: 'bold',
    color: modelo.medicoInfo.nomeColor,
    maxWidth: 150, // Limitar largura para evitar sobreposição
  },
  subtitle: {
    fontSize: modelo.medicoInfo.especialidadeSize * escalaFonte,
    color: modelo.medicoInfo.especialidadeColor,
  },
  tagline: {
    fontSize: modelo.medicoInfo.taglineSize * escalaFonte,
    color: modelo.medicoInfo.taglineColor,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: modelo.header.titleSize * escalaFonte,
    color: modelo.header.titleColor,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 30,
    marginBottom: 10,
  },
  patientInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  patientInfoItem: {
    width: '48%', // Quase metade da largura
    marginBottom: 10,
    paddingBottom: 2,
    flexShrink: 1, // Permitir encolher se necessário
    minWidth: 0, // Permitir que o flex funcione corretamente
  },
  patientInfoLabel: {
    fontSize: modelo.pacienteInfo.labelSize * escalaFonte,
    color: modelo.pacienteInfo.labelColor,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  patientInfoText: {
    fontSize: modelo.pacienteInfo.textSize * escalaFonte,
    color: modelo.pacienteInfo.textColor,
    flexWrap: 'wrap', // Permitir quebra de linha
    wordBreak: 'break-word', // Quebrar palavras longas se necessário
  },
  patientInfoBorder: {
    borderBottomWidth: 1,
    borderBottomColor: modelo.pacienteInfo.borderColor,
  },
  rxSection: {
    marginHorizontal: 30,
    marginTop: 5, // Subir mais o campo
    marginBottom: 50,
    position: 'relative',
  },
  rxTitle: {
    fontSize: modelo.prescricao.titleSize * escalaFonte * 0.5, // Reduzir pela metade
    fontWeight: 'bold',
    color: modelo.prescricao.titleColor,
    marginBottom: 15,
  },
  rxItem: {
    fontSize: modelo.prescricao.itemSize * escalaFonte,
    marginBottom: 5,
    color: modelo.prescricao.itemColor,
    lineHeight: modelo.prescricao.lineHeight,
  },
  signatureSection: {
    position: 'absolute',
    bottom: modelo.assinatura.position.bottom,
    left: modelo.assinatura.position.left || ((420 - (modelo.assinatura.position.width || 200)) / 2), // Centralizar horizontalmente na coluna
    paddingTop: 10,
    width: modelo.assinatura.position.width || 200, // Largura padrão se não especificada
    alignItems: 'center',
  },
  signatureText: {
    fontSize: modelo.assinatura.textoSize * escalaFonte,
    color: modelo.assinatura.textoColor,
  },
  signatureName: {
    fontSize: (modelo.assinatura.textoSize + 1) * escalaFonte,
    color: modelo.assinatura.textoColor,
    marginTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: modelo.footer.backgroundColor,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 30,
  },
  qrCode: {
    width: 40,
    height: 40,
    marginRight: 10,
    backgroundColor: modelo.footer.wave2Color,
  },
  contactInfo: {
    fontSize: modelo.footer.contactInfoSize * escalaFonte,
    color: modelo.footer.contactInfoColor,
    lineHeight: 1.4,
  },
  footerRight: {
    marginRight: 30,
    textAlign: 'right',
    fontSize: modelo.footer.clinicaNomeSize * escalaFonte,
    color: modelo.footer.clinicaNomeColor,
  },
  // Estilo para a marca d'água
  watermark: {
    position: 'absolute',
    top: modelo.logoWatermark.position.top,
    left: modelo.logoWatermark.position.left,
    width: modelo.logoWatermark.size.width,
    height: modelo.logoWatermark.size.height,
    opacity: modelo.logoWatermark.opacity,
  },
});

const PrescricaoPdfView: React.FC<PrescricaoPdfViewProps> = ({
  pacienteNome,
  pacienteEndereco,
  pacienteCPF,
  data: _data, // Não usado mais - data será preenchida manualmente na assinatura
  seguroSaude: _seguroSaude, // Não usado mais, mas mantido na interface
  diagnostico: _diagnostico, // Não usado mais, mas mantido na interface
  doutorNome,
  doutorEspecialidade,
  doutorTagline,
  doutorCRM,
  doutorCRMUF,
  doutorRQE,
  itensPrescricao,
  clinicaNome,
  clinicaEndereco,
  clinicaTelefone,
  clinicaEmail,
  clinicaSite,
  clinicaCNPJ,
  clinicaLogoUrl,
  modelo = modeloPrescricaoPadrao,
  isControleEspecial = false,
}) => {
  // Usar logoUrl do modelo se disponível, senão usar clinicaLogoUrl
  const logoUrl = modelo.logoUrl || clinicaLogoUrl;
  
  // Fator de redução proporcional para ajustar ao espaço reduzido (duas prescrições lado a lado)
  const escalaFonte = 0.75; // Reduzir para 75% do tamanho original
  
  // Calcular posição centralizada da marca d'água para A4 em paisagem
  // A4 paisagem em pontos (pt): 841.89pt (largura) x 595.28pt (altura)
  // Cada prescrição ocupa metade da largura: ~420pt
  const a4LandscapeWidth = 841.89; // largura da folha A4 paisagem em pontos
  const a4LandscapeHeight = 595.28; // altura da folha A4 paisagem em pontos
  const colunaWidth = a4LandscapeWidth / 2; // Largura de cada coluna (~420pt)
  const colunaHeight = a4LandscapeHeight; // Altura de cada coluna (mesma da folha)
  
  const watermarkWidth = modelo.logoWatermark.size.width;
  const watermarkHeight = modelo.logoWatermark.size.height;
  
  // Centralizar horizontalmente e verticalmente em cada coluna
  const centeredLeft = (colunaWidth - watermarkWidth) / 2;
  const centeredTop = (colunaHeight - watermarkHeight) / 2;
  
  // Calcular posição centralizada da assinatura em cada coluna
  const signatureWidth = modelo.assinatura.position.width || 200;
  const centeredSignatureLeft = (colunaWidth - signatureWidth) / 2;
  
  // Atualizar posição da marca d'água para centralizar
  const modeloCentralizado = {
    ...modelo,
    logoWatermark: {
      ...modelo.logoWatermark,
      position: {
        top: centeredTop,
        left: centeredLeft,
      },
    },
    // Garantir que pacienteInfo tenha os valores corretos
    pacienteInfo: {
      ...modelo.pacienteInfo,
      showCPF: modelo.pacienteInfo.showCPF ?? true,
      showEndereco: modelo.pacienteInfo.showEndereco ?? true,
    },
    // Posição centralizada da assinatura
    assinatura: {
      ...modelo.assinatura,
      position: {
        ...modelo.assinatura.position,
        left: centeredSignatureLeft,
      },
    },
  };
  
  console.log('PrescricaoPdfView - modelo recebido:', modelo);
  console.log('PrescricaoPdfView - modeloCentralizado:', modeloCentralizado);
  console.log('PrescricaoPdfView - showCPF:', modeloCentralizado.pacienteInfo.showCPF);
  console.log('PrescricaoPdfView - showEndereco:', modeloCentralizado.pacienteInfo.showEndereco);
  console.log('PrescricaoPdfView - pacienteCPF:', pacienteCPF);
  console.log('PrescricaoPdfView - pacienteEndereco:', pacienteEndereco);
  
  // Criar estilos dinâmicos baseados no modelo centralizado
  const styles = criarEstilos(modeloCentralizado, escalaFonte);

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

  const dataReceita = _data || new Date().toISOString();
  const dataFormatada = formatarData(dataReceita);

  // Formatar CPF para XXX.XXX.XXX-XX
  const formatarCPF = (cpf: string) => {
    if (!cpf) return '';
    const cpfLimpo = cpf.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (cpfLimpo.length !== 11) return cpf; // Se não tiver 11 dígitos, retorna como está
    return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Componente para renderizar uma prescrição (coluna)
  const renderPrescricao = (rotuloVia: string) => (
      <View style={{
        width: '49.5%', // Metade da largura menos espaçamento
        height: '100%',
        position: 'relative',
      }}>
        {/* Marca d'água - Logo centralizada */}
        {modeloCentralizado.logoWatermark.enabled && logoUrl && (
          <Image 
            style={styles.watermark} 
            src={logoUrl}
            // Aplicar cor cinza através de um filtro (nota: react-pdf não suporta CSS filters diretamente)
          />
        )}
        
        {/* Header - Identificação do Emissor */}
        {modeloCentralizado.header.showTitle && (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* Logo no cabeçalho */}
              {modeloCentralizado.header.showLogoInHeader && logoUrl && (
                <Image style={styles.logoHeader} src={logoUrl} />
              )}
              <View>
                <Text style={styles.headerTitle}>{modeloCentralizado.header.title}</Text>
                {/* Dados da Clínica */}
                <View style={{ marginTop: 5 }}>
                  <Text style={[styles.subtitle, { fontSize: 10 * escalaFonte, marginBottom: 2 }]}>{clinicaNome}</Text>
                  {clinicaTelefone && (
                    <Text style={[styles.subtitle, { fontSize: 9 * escalaFonte }]}>Tel: {clinicaTelefone}</Text>
                  )}
                  {/* CNPJ obrigatório para receitas de controle especial */}
                  {isControleEspecial && clinicaCNPJ && (
                    <Text style={[styles.subtitle, { fontSize: 9 * escalaFonte, fontWeight: 'bold', marginTop: 2 }]}>
                      CNPJ: {clinicaCNPJ}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.headerRight}>
              {/* Nome do Profissional */}
              {modeloCentralizado.medicoInfo.showNome && (() => {
                // Calcular tamanho dinâmico da fonte baseado no comprimento do nome
                const nomeCompleto = `Dr(a). ${doutorNome}`;
                const comprimentoNome = nomeCompleto.length;
                // Fator de redução base: 0.5, reduz ainda mais se o nome for muito longo
                let fatorReducao = 0.5;
                if (comprimentoNome > 30) {
                  fatorReducao = 0.4;
                } else if (comprimentoNome > 25) {
                  fatorReducao = 0.45;
                }
                const tamanhoFonte = modeloCentralizado.medicoInfo.nomeSize * escalaFonte * fatorReducao;
                
                return (
                  <Text 
                    style={{
                      fontSize: tamanhoFonte,
                      fontWeight: 'bold',
                      color: modeloCentralizado.medicoInfo.nomeColor,
                      maxWidth: 150,
                      textAlign: 'right',
                    }}
                  >
                    {nomeCompleto}
                  </Text>
                );
              })()}
              {/* Número de Registro: CRM e UF */}
              {doutorCRM && (
                <Text style={[styles.subtitle, { fontSize: 11 * escalaFonte, marginTop: 2 }]}>
                  CRM {doutorCRM}
                  {doutorCRMUF && `-${doutorCRMUF}`}
                </Text>
              )}
              {/* RQE (Registro de Qualificação de Especialista) */}
              {doutorRQE && (
                <Text style={[styles.subtitle, { fontSize: 10 * escalaFonte, marginTop: 1 }]}>
                  RQE: {doutorRQE}
                </Text>
              )}
              {modeloCentralizado.medicoInfo.showEspecialidade && doutorEspecialidade && (
                <Text style={styles.subtitle}>{doutorEspecialidade}</Text>
              )}
              {modeloCentralizado.medicoInfo.showTagline && doutorTagline && (
                <Text style={styles.tagline}>{doutorTagline}</Text>
              )}
              {/* Checkbox para identificar a via */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 16, // Duas linhas de espaçamento (aproximadamente 2x line-height de 8)
                paddingVertical: 2,
              }}>
                <View style={{
                  width: modeloCentralizado.medicoInfo.especialidadeSize * escalaFonte * 0.6, // Mesmo tamanho da fonte das informações
                  height: modeloCentralizado.medicoInfo.especialidadeSize * escalaFonte * 0.6,
                  borderWidth: 1,
                  borderColor: modeloCentralizado.medicoInfo.especialidadeColor,
                  marginRight: 6,
                  backgroundColor: '#FFFFFF',
                }} />
                <Text style={{
                  fontSize: modeloCentralizado.medicoInfo.especialidadeSize * escalaFonte, // Mesmo tamanho das informações do médico
                  color: modeloCentralizado.medicoInfo.especialidadeColor,
                  fontWeight: 'bold',
                }}>
                  {rotuloVia}
                </Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Informações do Paciente */}
        <View style={styles.section}>
          <View style={styles.patientInfoGrid}>
            {modeloCentralizado.pacienteInfo.showNome && (
              <View style={styles.patientInfoItem}>
                <Text style={styles.patientInfoLabel}>Nome do Paciente</Text>
                <View style={styles.patientInfoBorder}>
                  <Text style={styles.patientInfoText}>{pacienteNome}</Text>
                </View>
              </View>
            )}
            {modeloCentralizado.pacienteInfo.showCPF && (
              <View style={styles.patientInfoItem}>
                <Text style={styles.patientInfoLabel}>CPF</Text>
                <View style={styles.patientInfoBorder}>
                  <Text style={styles.patientInfoText}>
                    {pacienteCPF && pacienteCPF.trim() ? formatarCPF(pacienteCPF) : '-'}
                  </Text>
                </View>
              </View>
            )}
            {modeloCentralizado.pacienteInfo.showEndereco && (
              <View style={[styles.patientInfoItem, { width: '100%' }]}>
                <Text style={styles.patientInfoLabel}>Endereço</Text>
                <View style={styles.patientInfoBorder}>
                  <Text 
                    style={styles.patientInfoText}
                    wrap={true} // Permitir quebra de linha
                  >
                    {pacienteEndereco && pacienteEndereco.trim() ? pacienteEndereco : '-'}
                  </Text>
                </View>
              </View>
            )}
            {modeloCentralizado.pacienteInfo.showData && (
              <View style={styles.patientInfoItem}>
                <Text style={styles.patientInfoLabel}>Data da Receita</Text>
                <View style={styles.patientInfoBorder}>
                  <Text style={styles.patientInfoText}>{dataFormatada}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        
        {/* Seção Rx (Prescrição) */}
        <View style={styles.rxSection}>
          {modeloCentralizado.prescricao.showTitle && (
            <Text style={styles.rxTitle}>{modeloCentralizado.prescricao.title}</Text>
          )}
          {itensPrescricao.map((item, index) => (
            <Text key={index} style={styles.rxItem}>
              {item}
            </Text>
          ))}
        </View>
        
        {/* Seção de Assinatura */}
        {modeloCentralizado.assinatura.showNome && (
          <View style={styles.signatureSection}>
            {modeloCentralizado.assinatura.showLinha && (
              <View style={{
                width: '100%',
                height: 1,
                backgroundColor: modeloCentralizado.assinatura.linhaColor,
                marginBottom: 10,
              }} />
            )}
            <Text style={{ 
              fontSize: modeloCentralizado.assinatura.textoSize * escalaFonte, 
              color: modeloCentralizado.assinatura.textoColor,
              marginBottom: 5,
              textAlign: 'center'
            }}>Assinatura</Text>
            <Text style={{ 
              fontSize: (modeloCentralizado.assinatura.textoSize + 1) * escalaFonte, 
              color: modeloCentralizado.assinatura.textoColor,
              marginTop: 5,
              textAlign: 'center'
            }}>Dr(a). {doutorNome}</Text>
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {/* QR Code placeholder */}
            {modeloCentralizado.footer.showQRCode && (
              <View style={styles.qrCode}>
                <Text style={{ fontSize: 6, color: modeloCentralizado.footer.contactInfoColor, textAlign: 'center', marginTop: 15 }}>QR</Text>
              </View>
            )}
            {modeloCentralizado.footer.showContactInfo && (
              <View style={styles.contactInfo}>
                {clinicaTelefone && <Text>{clinicaTelefone}</Text>}
                {clinicaEmail && <Text>{clinicaEmail}</Text>}
                {clinicaSite && <Text>{clinicaSite}</Text>}
                {clinicaEndereco && <Text>{clinicaEndereco}</Text>}
              </View>
            )}
          </View>
          {modeloCentralizado.footer.showClinicaNome && (
            <View style={styles.footerRight}>
              <Text>{clinicaNome || 'Este documento foi gerado eletronicamente'}</Text>
            </View>
          )}
        </View>
      </View>
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Container principal com duas colunas lado a lado */}
        <View style={{
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          justifyContent: 'space-between',
          paddingHorizontal: 15,
          gap: 10, // Pequeno espaçamento entre as duas prescrições
        }}>
          {/* Primeira via (Farmácia) - com assinatura */}
          {renderPrescricao('1ª Via Farmácia')}
          
          {/* Segunda via (Paciente) - com assinatura */}
          {renderPrescricao('2ª Via Paciente')}
        </View>
      </Page>
    </Document>
  );
};

export default PrescricaoPdfView;

