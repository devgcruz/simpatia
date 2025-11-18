// Interface para o modelo de prescrição PDF editável
export interface IModeloPrescricaoPDF {
  // Logo como marca d'água
  logoUrl?: string;
  logoWatermark: {
    enabled: boolean;
    opacity: number; // 0 a 1
    color: string; // Cor para logo em escala de cinza (ex: #9E9E9E)
    size: {
      width: number;
      height: number;
    };
    position: {
      top: number; // Posição vertical em pontos (pt) - calculada automaticamente para centralizar
      left: number; // Posição horizontal em pontos (pt) - calculada automaticamente para centralizar
    };
  };
  
  // Header
  header: {
    backgroundColor: string;
    showTitle: boolean;
    title: string;
    titleColor: string;
    titleSize: number;
    showLogoInHeader: boolean;
    logoHeaderSize: {
      width: number;
      height: number;
    };
  };
  
  // Informações do médico no header
  medicoInfo: {
    showNome: boolean;
    showEspecialidade: boolean;
    showTagline: boolean;
    tagline?: string;
    nomeColor: string;
    nomeSize: number;
    especialidadeColor: string;
    especialidadeSize: number;
    taglineColor: string;
    taglineSize: number;
  };
  
  // Informações do paciente
  pacienteInfo: {
    showNome: boolean;
    showCPF: boolean;
    showEndereco: boolean;
    showSeguro: boolean;
    showDiagnostico: boolean;
    showData: boolean;
    labelColor: string;
    labelSize: number;
    textColor: string;
    textSize: number;
    borderColor: string;
  };
  
  // Seção de prescrição (Rx)
  prescricao: {
    showTitle: boolean;
    title: string;
    titleColor: string;
    titleSize: number;
    itemColor: string;
    itemSize: number;
    lineHeight: number;
  };
  
  // Assinatura
  assinatura: {
    showLinha: boolean;
    showNome: boolean;
    linhaColor: string;
    textoColor: string;
    textoSize: number;
    position: {
      bottom: number;
      right?: number;
      left?: number;
      width: number;
    };
  };
  
  // Footer
  footer: {
    backgroundColor: string;
    showWaves: boolean;
    wave1Color: string;
    wave2Color: string;
    showQRCode: boolean;
    showContactInfo: boolean;
    contactInfoColor: string;
    contactInfoSize: number;
    showClinicaNome: boolean;
    clinicaNomeColor: string;
    clinicaNomeSize: number;
  };
}

// Modelo padrão
export const modeloPrescricaoPadrao: IModeloPrescricaoPDF = {
  logoWatermark: {
    enabled: true,
    opacity: 0.08,
    color: '#9E9E9E',
    size: {
      width: 200, // largura em pontos (pt)
      height: 200, // altura em pontos (pt)
    },
    position: {
      top: 320.945, // Será recalculado automaticamente para centralizar
      left: 197.64, // Será recalculado automaticamente para centralizar
    },
  },
  header: {
    backgroundColor: '#F5F5F5',
    showTitle: true,
    title: 'PRESCRIÇÃO',
    titleColor: '#9E9E9E',
    titleSize: 12,
    showLogoInHeader: true,
    logoHeaderSize: {
      width: 50,
      height: 50,
    },
  },
  medicoInfo: {
    showNome: true,
    showEspecialidade: true,
    showTagline: false,
    nomeColor: '#9E9E9E',
    nomeSize: 24,
    especialidadeColor: '#9E9E9E',
    especialidadeSize: 12,
    taglineColor: '#9E9E9E',
    taglineSize: 10,
  },
  pacienteInfo: {
    showNome: true,
    showCPF: true, // Habilitado - CPF do paciente deve aparecer
    showEndereco: true, // Habilitado - Endereço do paciente deve aparecer
    showSeguro: false,
    showDiagnostico: false,
    showData: true,
    labelColor: '#616161',
    labelSize: 9,
    textColor: '#424242',
    textSize: 11,
    borderColor: '#EEEEEE',
  },
  prescricao: {
    showTitle: true,
    title: 'Prescrição:',
    titleColor: '#9E9E9E',
    titleSize: 28,
    itemColor: '#424242',
    itemSize: 12,
    lineHeight: 1.5,
  },
  assinatura: {
    showLinha: true,
    showNome: true,
    linhaColor: '#9E9E9E',
    textoColor: '#616161',
    textoSize: 10,
    position: {
      bottom: 100,
      right: 50,
      width: 200,
    },
  },
  footer: {
    backgroundColor: '#F5F5F5',
    showWaves: true,
    wave1Color: '#E0E0E0',
    wave2Color: '#BDBDBD',
    showQRCode: true,
    showContactInfo: true,
    contactInfoColor: '#616161',
    contactInfoSize: 8,
    showClinicaNome: true,
    clinicaNomeColor: '#616161',
    clinicaNomeSize: 8,
  },
};

