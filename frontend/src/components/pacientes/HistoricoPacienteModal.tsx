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
  Grid,
  TextField,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import moment from 'moment';
import { IPaciente, IHistoricoPaciente } from '../../types/models';
import { getPacienteHistoricos, updateHistoricoPaciente } from '../../services/paciente.service';
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
  const [filtroData, setFiltroData] = useState('');
  const [filtroPrescricao, setFiltroPrescricao] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [editingHistorico, setEditingHistorico] = useState<IHistoricoPaciente | null>(null);
  const [descricaoEditando, setDescricaoEditando] = useState('');
  const [openEditModal, setOpenEditModal] = useState(false);
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  const extrairPrimeiroMedicamento = (conteudo: string): string => {
    if (!conteudo) return '';
    const linhas = conteudo.split('\n').filter((line) => line.trim());
    if (linhas.length === 0) return '';
    const primeiraLinha = linhas[0].trim();
    return primeiraLinha.length > 30 ? `${primeiraLinha.substring(0, 30)}...` : primeiraLinha;
  };

  const handleAbrirEdicaoHistorico = (historico: IHistoricoPaciente) => {
    setEditingHistorico(historico);
    setDescricaoEditando(historico.descricao || '');
    setOpenEditModal(true);
  };

  const handleFecharEdicaoHistorico = () => {
    setEditingHistorico(null);
    setDescricaoEditando('');
    setOpenEditModal(false);
  };

  const handleSalvarDescricaoHistorico = async () => {
    if (!editingHistorico || !descricaoEditando.trim()) {
      toast.error('A descrição não pode ficar vazia.');
      return;
    }
    try {
      setSalvandoHistorico(true);
      await updateHistoricoPaciente(editingHistorico.id, descricaoEditando.trim());
      setHistoricos((prev) =>
        prev.map((hist) =>
          hist.id === editingHistorico.id ? { ...hist, descricao: descricaoEditando.trim() } : hist
        )
      );
      toast.success('Descrição atualizada com sucesso!');
      handleFecharEdicaoHistorico();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar descrição.');
    } finally {
      setSalvandoHistorico(false);
    }
  };

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
      setFiltroData('');
      setFiltroPrescricao('');
      setFiltroDescricao('');
      setEditingHistorico(null);
      setDescricaoEditando('');
      setOpenEditModal(false);
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
          <>
            <Box sx={{ mb: 1.5 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Filtrar por Data"
                    type="date"
                    value={filtroData}
                    onChange={(e) => setFiltroData(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Filtrar por Prescrição"
                    value={filtroPrescricao}
                    onChange={(e) => setFiltroPrescricao(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="ID ou conteúdo"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Filtrar por Descrição/Profissional"
                    value={filtroDescricao}
                    onChange={(e) => setFiltroDescricao(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="ID, profissional ou descrição"
                  />
                </Grid>
              </Grid>
              {(filtroData || filtroPrescricao || filtroDescricao) && (
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setFiltroData('');
                      setFiltroPrescricao('');
                      setFiltroDescricao('');
                    }}
                  >
                    Limpar filtros
                  </Button>
                </Box>
              )}
            </Box>

            {(() => {
              const historicosFiltrados = historicos.filter((historico) => {
                if (filtroData) {
                  const dataHistorico = moment(historico.realizadoEm).format('YYYY-MM-DD');
                  if (dataHistorico !== filtroData) {
                    return false;
                  }
                }

                if (filtroPrescricao) {
                  const filtroLower = filtroPrescricao.toLowerCase();
                  const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                  const encontrouPrescricao = prescricoesHistorico.some((prescricao) => {
                    const idMatch = prescricao.id.toString().includes(filtroPrescricao);
                    const conteudoMatch = prescricao.conteudo?.toLowerCase().includes(filtroLower);
                    return idMatch || conteudoMatch;
                  });
                  if (!encontrouPrescricao) {
                    return false;
                  }
                }

                if (filtroDescricao) {
                  const filtroLower = filtroDescricao.toLowerCase();
                  const descricaoMatch = historico.descricao?.toLowerCase().includes(filtroLower) || false;
                  const idMatch = historico.id.toString().includes(filtroDescricao);
                  const profissionalMatch = historico.doutor?.nome?.toLowerCase().includes(filtroLower) || false;
                  if (!descricaoMatch && !idMatch && !profissionalMatch) {
                    return false;
                  }
                }

                return true;
              });

              if (historicosFiltrados.length === 0) {
                return (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      Nenhum histórico encontrado com os filtros aplicados.
                    </Typography>
                  </Box>
                );
              }

              return (
                <List sx={{ maxHeight: 500, overflowY: 'auto' }}>
                  {historicosFiltrados.map((historico, index) => {
                    const realizadoEm = moment(historico.realizadoEm);
                    const realizadoLabel = `${realizadoEm.format('DD/MM/YYYY')} às ${realizadoEm.format('HH:mm')}`;
                    const finalizadoEm = moment(historico.criadoEm);
                    const finalizadoLabel = finalizadoEm.isValid()
                      ? `${finalizadoEm.format('DD/MM/YYYY')} às ${finalizadoEm.format('HH:mm')}`
                      : null;
                    const servicoNome = historico.servico?.nome ?? 'Consulta';
                    const profissionalNome = historico.doutor?.nome ? `Profissional: ${historico.doutor.nome}` : null;
                    const prescricoesHistorico = historico.prescricoes || historico.agendamento?.prescricoes || [];
                    const descricaoCompleta = historico.descricao || 'Sem descrição registrada.';

                    return (
                      <React.Fragment key={historico.id}>
                        <ListItem alignItems="flex-start" disableGutters sx={{ transition: 'background-color 0.3s ease' }}>
                          <ListItemText
                            primary={
                              <Box sx={{ position: 'relative' }}>
                                <Typography
                                  variant="h4"
                                  sx={{
                                    position: 'absolute',
                                    top: -10,
                                    right: 20,
                                    fontSize: '2rem',
                                    fontWeight: 'bold',
                                    color: 'rgba(0, 0, 0, 0.08)',
                                    zIndex: 0,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                  }}
                                >
                                  #{historico.id}
                                </Typography>
                                <Box sx={{ position: 'relative', zIndex: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {`${servicoNome} • ${realizadoLabel}`}
                                  </Typography>
                                  {profissionalNome && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {profissionalNome}
                                    </Typography>
                                  )}
                                  {finalizadoLabel && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {`Finalizado em ${finalizadoLabel}`}
                                      {historico.duracaoMinutos && (
                                        <span> • Duração: {historico.duracaoMinutos} min</span>
                                      )}
                                    </Typography>
                                  )}
                                  {prescricoesHistorico.length > 0 && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                        Prescrições Médicas:
                                      </Typography>
                                      {prescricoesHistorico.map((prescricao) => {
                                        const primeiroMedicamento = extrairPrimeiroMedicamento(prescricao.conteudo || '');
                                        const isPrescricaoAvulsa = !('agendamentoId' in prescricao) || prescricao.agendamentoId === null || prescricao.agendamentoId === undefined;
                                        const labelTexto = primeiroMedicamento
                                          ? `#${prescricao.id} - ${primeiroMedicamento}`
                                          : `#${prescricao.id}`;

                                        return (
                                          <Box key={prescricao.id} sx={{ display: 'inline-block', mr: 0.5, mb: 0.5 }}>
                                            <Tooltip
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
                                                  cursor: 'pointer',
                                                  '&:hover': {
                                                    backgroundColor: 'primary.light',
                                                    color: 'primary.main',
                                                    borderColor: 'primary.main',
                                                  },
                                                }}
                                              />
                                            </Tooltip>
                                            {isPrescricaoAvulsa && (
                                              <Chip
                                                label="Prescrição Fora do Atendimento"
                                                size="small"
                                                color="warning"
                                                variant="filled"
                                                sx={{ ml: 0.5, fontSize: '0.65rem', height: '20px' }}
                                              />
                                            )}
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            }
                            secondary={
                              <Tooltip
                                title={
                                  <Box component="div" sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                                    {descricaoCompleta}
                                  </Box>
                                }
                                arrow
                                enterDelay={500}
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mt: 1,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    cursor: 'pointer',
                                    '&:hover': { color: 'primary.main' },
                                  }}
                                  onClick={() => handleAbrirEdicaoHistorico(historico)}
                                >
                                  {descricaoCompleta}
                                </Typography>
                              </Tooltip>
                            }
                          />
                        </ListItem>
                        {index < historicosFiltrados.length - 1 && <Divider component="li" />}
                      </React.Fragment>
                    );
                  })}
                </List>
              );
            })()}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
      <Dialog
        open={openEditModal}
        onClose={handleFecharEdicaoHistorico}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DescriptionIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Visualizar/Editar Atendimento #{editingHistorico?.id}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {editingHistorico && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Data do Atendimento: {moment(editingHistorico.realizadoEm).format('DD/MM/YYYY [às] HH:mm')}
              </Typography>
              {editingHistorico.duracaoMinutos && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  Duração: {editingHistorico.duracaoMinutos} min
                </Typography>
              )}
              <TextField
                label="Descrição do atendimento"
                multiline
                minRows={8}
                fullWidth
                value={descricaoEditando}
                onChange={(event) => setDescricaoEditando(event.target.value)}
                placeholder="Atualize a descrição deste atendimento..."
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFecharEdicaoHistorico} disabled={salvandoHistorico}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSalvarDescricaoHistorico}
            disabled={!descricaoEditando.trim() || salvandoHistorico}
          >
            {salvandoHistorico ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};


