import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material';
import moment from 'moment';
import { IPaciente, IHistoricoPaciente } from '../../types/models';
import { getPacienteHistoricos } from '../../services/paciente.service';
import { getPrescricaoByProtocolo } from '../../services/prescricao.service';
import { pdf } from '@react-pdf/renderer';
import PrescricaoPdfView from '../PrescricaoPdfView';
import { IModeloPrescricaoPDF, modeloPrescricaoPadrao } from '../../types/prescricao';
import { toast } from 'sonner';

moment.locale('pt-br');

interface Props {
  open: boolean;
  onClose: () => void;
  paciente: IPaciente | null;
}

export const HistoricoPacienteModal: React.FC<Props> = ({ open, onClose, paciente }) => {
  const [historicos, setHistoricos] = useState<IHistoricoPaciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVisualizarPrescricao = async (prescricaoProtocolo: string) => {
    try {
      // Buscar prescrição completa pelo protocolo
      const prescricao = await getPrescricaoByProtocolo(prescricaoProtocolo);
      
      if (!prescricao) {
        toast.error('Prescrição não encontrada');
        return;
      }

      if (!prescricao.paciente) {
        toast.error('Dados do paciente não encontrados');
        return;
      }

      // Carregar modelo do doutor ou usar padrão
      let modeloPrescricao: IModeloPrescricaoPDF = modeloPrescricaoPadrao;
      let logoURL = '';
      
      const modeloStr = prescricao.doutor.modeloPrescricao || '';
      if (modeloStr) {
        try {
          const modeloCarregado = JSON.parse(modeloStr) as IModeloPrescricaoPDF;
          modeloPrescricao = {
            ...modeloPrescricaoPadrao,
            ...modeloCarregado,
            logoWatermark: {
              ...modeloPrescricaoPadrao.logoWatermark,
              ...(modeloCarregado.logoWatermark || {}),
            },
            header: {
              ...modeloPrescricaoPadrao.header,
              ...(modeloCarregado.header || {}),
            },
            medicoInfo: {
              ...modeloPrescricaoPadrao.medicoInfo,
              ...(modeloCarregado.medicoInfo || {}),
            },
            pacienteInfo: {
              ...modeloPrescricaoPadrao.pacienteInfo,
              ...(modeloCarregado.pacienteInfo || {}),
              showCPF: true,
              showEndereco: true,
            },
            prescricao: {
              ...modeloPrescricaoPadrao.prescricao,
              ...(modeloCarregado.prescricao || {}),
            },
            assinatura: {
              ...modeloPrescricaoPadrao.assinatura,
              ...(modeloCarregado.assinatura || {}),
            },
            footer: {
              ...modeloPrescricaoPadrao.footer,
              ...(modeloCarregado.footer || {}),
            },
          };
          logoURL = modeloPrescricao.logoUrl || '';
        } catch (error) {
          console.warn('Modelo de prescrição não é JSON válido, usando padrão:', error);
          modeloPrescricao = modeloPrescricaoPadrao;
          logoURL = '';
        }
      }
      
      // Montar endereço do paciente
      const enderecoPaciente = [
        prescricao.paciente.logradouro,
        prescricao.paciente.numero,
        prescricao.paciente.bairro,
        prescricao.paciente.cidade,
        prescricao.paciente.estado
      ].filter(Boolean).join(', ') || '';
      
      // Separar texto da prescrição em linhas
      const itensPrescricao = prescricao.conteudo.split('\n').filter(line => line.trim());
      
      // Obter dados da clínica
      const clinicaNome = prescricao.doutor.clinica?.nome || 'Clínica';
      const clinicaEndereco = prescricao.doutor.clinica?.endereco || '';
      const clinicaTelefone = prescricao.doutor.clinica?.telefone || '';
      const clinicaEmail = prescricao.doutor.clinica?.email || '';
      const clinicaSite = prescricao.doutor.clinica?.site || '';
      const clinicaCNPJ = prescricao.doutor.clinica?.cnpj;

      // Gerar PDF
      const pdfDoc = (
        <PrescricaoPdfView
          pacienteNome={prescricao.paciente.nome || ''}
          pacienteEndereco={enderecoPaciente}
          pacienteCPF={prescricao.paciente.cpf || undefined}
          data={moment(prescricao.createdAt).format('YYYY-MM-DD')}
          seguroSaude={prescricao.paciente.convenio || ''}
          diagnostico=""
          doutorNome={prescricao.doutor.nome || ''}
          doutorEspecialidade={prescricao.doutor.especialidade || ''}
          doutorTagline={modeloPrescricao.medicoInfo.tagline || ''}
          doutorCRM={prescricao.doutor.crm}
          doutorCRMUF={prescricao.doutor.crmUf}
          doutorRQE={prescricao.doutor.rqe}
          itensPrescricao={itensPrescricao}
          clinicaNome={clinicaNome}
          clinicaEndereco={clinicaEndereco}
          clinicaTelefone={clinicaTelefone}
          clinicaEmail={clinicaEmail}
          clinicaSite={clinicaSite}
          clinicaCNPJ={clinicaCNPJ}
          clinicaLogoUrl={logoURL}
          modelo={modeloPrescricao}
          isControleEspecial={false}
        />
      );

      // Gerar blob do PDF e abrir para impressão
      pdf(pdfDoc).toBlob().then((blob) => {
        if (blob.size === 0) {
          toast.error('Erro: PDF gerado está vazio');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              toast.success('Prescrição carregada com sucesso!');
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 250);
          };
          
          printWindow.onerror = () => {
            toast.error('Erro ao abrir janela de impressão');
          };
        } else {
          toast.error('Não foi possível abrir a janela de impressão. Verifique se o pop-up está bloqueado.');
        }
      }).catch((error) => {
        console.error('Erro ao gerar PDF:', error);
        toast.error(`Erro ao gerar prescrição: ${error.message || 'Erro desconhecido'}`);
      });
    } catch (error: any) {
      console.error('Erro ao visualizar prescrição:', error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido ao visualizar prescrição'}`);
    }
  };

  useEffect(() => {
    if (open && paciente) {
      const carregarHistorico = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await getPacienteHistoricos(paciente.id);
          setHistoricos(data);
        } catch (err: any) {
          setError(err?.response?.data?.message ?? 'Não foi possível carregar o histórico.');
        } finally {
          setLoading(false);
        }
      };
      carregarHistorico();
    } else {
      setHistoricos([]);
      setError(null);
    }
  }, [open, paciente]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Histórico do Paciente
        {paciente && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {paciente.nome}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : historicos.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Nenhum histórico disponível para este paciente.
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 500, overflowY: 'auto' }}>
            {historicos.map((historico, index) => {
              const realizadoEm = moment(historico.realizadoEm);
              const realizadoLabel = `${realizadoEm.format('DD/MM/YYYY')} às ${realizadoEm.format('HH:mm')}`;
              const finalizadoEm = moment(historico.criadoEm);
              const finalizadoLabel = finalizadoEm.isValid()
                ? `${finalizadoEm.format('DD/MM/YYYY')} às ${finalizadoEm.format('HH:mm')}`
                : null;
              const servicoNome = historico.servico?.nome ?? 'Consulta';
              const profissionalNome = historico.doutor?.nome
                ? `Profissional: ${historico.doutor.nome}`
                : null;
              
              // Dados do agendamento
              const agendamentoData = historico.agendamento
                ? moment(historico.agendamento.dataHora).format('DD/MM/YYYY [às] HH:mm')
                : null;

              const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
              
              // Função para extrair o primeiro medicamento do conteúdo
              const extrairPrimeiroMedicamento = (conteudo: string): string => {
                if (!conteudo) return '';
                const linhas = conteudo.split('\n').filter(line => line.trim());
                if (linhas.length === 0) return '';
                const primeiraLinha = linhas[0].trim();
                // Limitar a 30 caracteres e adicionar ... se necessário
                return primeiraLinha.length > 30 ? primeiraLinha.substring(0, 30) + '...' : primeiraLinha;
              };
              
              return (
                <React.Fragment key={historico.id}>
                  <ListItem alignItems="flex-start" disableGutters>
                    <ListItemText
                      primary={
                        <Box sx={{ position: 'relative' }}>
                          {/* Marca d'água no canto superior direito */}
                          <Typography
                            variant="h4"
                            sx={{
                              position: 'absolute',
                              top: -10,
                              right: 0,
                              fontSize: '3rem',
                              fontWeight: 'bold',
                              color: 'rgba(0, 0, 0, 0.08)',
                              zIndex: 0,
                              pointerEvents: 'none',
                              userSelect: 'none',
                            }}
                          >
                            #{historico.id}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5} sx={{ position: 'relative', zIndex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {`${servicoNome} • ${realizadoLabel}`}
                            </Typography>
                          </Box>
                          {agendamentoData && (
                            <Typography variant="caption" color="primary" display="block" sx={{ fontWeight: 500 }}>
                              Agendamento: {agendamentoData}
                            </Typography>
                          )}
                          {profissionalNome && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {profissionalNome}
                            </Typography>
                          )}
                          {finalizadoLabel && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {`Finalizado em ${finalizadoLabel}`}
                            </Typography>
                          )}
                          {prescricoesHistorico.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                Prescrições Médicas:
                              </Typography>
                              {prescricoesHistorico.map((prescricao) => {
                                const primeiroMedicamento = extrairPrimeiroMedicamento(prescricao.conteudo || '');
                                const labelTexto = primeiroMedicamento 
                                  ? `#${prescricao.id} - ${primeiroMedicamento}`
                                  : `#${prescricao.id}`;
                                
                                return (
                                  <Tooltip
                                    key={prescricao.id}
                                    title={
                                      <Box component="div" sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                                        {prescricao.conteudo || 'Sem conteúdo'}
                                      </Box>
                                    }
                                    arrow
                                    enterDelay={1000}
                                    placement="top"
                                  >
                                    <Chip
                                      label={labelTexto}
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      onClick={() => handleVisualizarPrescricao(prescricao.protocolo)}
                                      sx={{ 
                                        mr: 0.5, 
                                        mb: 0.5,
                                        cursor: 'pointer',
                                        '&:hover': {
                                          backgroundColor: 'primary.light',
                                          color: 'primary.main',
                                          borderColor: 'primary.main',
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {historico.descricao}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {index < historicos.length - 1 && <Divider component="li" />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};


