import { Request, Response } from 'express';
import alergiaService from '../services/alergia.service';
import medicamentoService from '../services/medicamento.service';

class AlergiaController {
  async handleCreate(req: Request, res: Response) {
    try {
      const { pacienteId, medicamentoId, nomeMedicamento, principioAtivo, classeQuimica, excipientes, observacoes } = req.body;
      const { id: doutorId } = req.user!;

      if (!pacienteId || !nomeMedicamento) {
        return res.status(400).json({ message: 'Paciente e nome do medicamento são obrigatórios' });
      }

      if (!principioAtivo || !principioAtivo.trim()) {
        return res.status(400).json({ message: 'Princípio ativo é obrigatório para cadastrar alergia' });
      }

      // Validar que o princípio ativo existe no banco de dados
      const principioAtivoExiste = await medicamentoService.verificarPrincipioAtivoExiste(principioAtivo);
      if (!principioAtivoExiste) {
        return res.status(400).json({ 
          message: 'O princípio ativo informado não existe no banco de dados. Por favor, selecione um princípio ativo válido.' 
        });
      }

      const alergia = await alergiaService.create({
        pacienteId,
        medicamentoId,
        nomeMedicamento,
        principioAtivo: principioAtivo.trim(),
        classeQuimica: classeQuimica?.trim() || undefined,
        excipientes: excipientes?.trim() || undefined,
        observacoes: observacoes?.trim() || undefined,
        cadastradoPor: doutorId,
      });

      return res.status(201).json(alergia);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleGetByPaciente(req: Request, res: Response) {
    try {
      const pacienteId = Number(req.params.pacienteId);
      const alergias = await alergiaService.findByPaciente(pacienteId);
      return res.status(200).json(alergias);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleVerificarAlergia(req: Request, res: Response) {
    try {
      const pacienteId = Number(req.params.pacienteId);
      const { nomeMedicamento, principioAtivo, classeTerapeutica, excipientes } = req.body;

      if (!nomeMedicamento) {
        return res.status(400).json({ message: 'Nome do medicamento é obrigatório' });
      }

      const verificacao = await alergiaService.verificarAlergia(
        pacienteId, 
        nomeMedicamento, 
        principioAtivo,
        classeTerapeutica,
        excipientes
      );
      return res.status(200).json(verificacao);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleVerificarAlergiasEmMedicamentos(req: Request, res: Response) {
    try {
      const pacienteId = Number(req.params.pacienteId);
      const { medicamentos } = req.body;

      if (!Array.isArray(medicamentos)) {
        return res.status(400).json({ message: 'Medicamentos deve ser um array' });
      }

      const resultados = await alergiaService.verificarAlergiasEmMedicamentos(pacienteId, medicamentos);
      return res.status(200).json(resultados);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nomeMedicamento, principioAtivo, classeQuimica, excipientes, observacoes } = req.body;

      const alergia = await alergiaService.update(id, {
        nomeMedicamento,
        principioAtivo,
        classeQuimica,
        excipientes,
        observacoes,
      });

      return res.status(200).json(alergia);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { justificativaExclusao } = req.body;
      const { id: deletadoPor } = req.user!;

      if (!justificativaExclusao || !justificativaExclusao.trim()) {
        return res.status(400).json({ message: 'Justificativa da exclusão é obrigatória' });
      }

      await alergiaService.delete(id, deletadoPor, justificativaExclusao.trim());
      return res.status(200).json({ message: 'Alergia removida com sucesso' });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
}

export default new AlergiaController();

