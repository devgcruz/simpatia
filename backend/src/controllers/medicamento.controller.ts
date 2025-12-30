import { Request, Response } from 'express';
import medicamentoService from '../services/medicamento.service';

class MedicamentoController {
  async handleGetAll(req: Request, res: Response) {
    try {
      const {
        nomeProduto,
        numeroRegistroProduto,
        classeTerapeutica,
        categoriaRegulatoria,
        situacaoRegistro,
        principioAtivo,
        empresaDetentoraRegistro,
        skip,
        take,
      } = req.query;

      const filters: any = {};
      if (nomeProduto) filters.nomeProduto = nomeProduto as string;
      if (numeroRegistroProduto) filters.numeroRegistroProduto = numeroRegistroProduto as string;
      if (classeTerapeutica) filters.classeTerapeutica = classeTerapeutica as string;
      if (categoriaRegulatoria) filters.categoriaRegulatoria = categoriaRegulatoria as string;
      if (situacaoRegistro) filters.situacaoRegistro = situacaoRegistro as string;
      if (principioAtivo) filters.principioAtivo = principioAtivo as string;
      if (empresaDetentoraRegistro) filters.empresaDetentoraRegistro = empresaDetentoraRegistro as string;

      const skipNumber = skip ? Number(skip) : undefined;
      const takeNumber = take ? Number(take) : undefined;

      const result = await medicamentoService.getAll(filters, skipNumber, takeNumber);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleGetById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const medicamento = await medicamentoService.getById(id);
      return res.status(200).json(medicamento);
    } catch (error: any) {
      if (error.message === 'Medicamento não encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  async handleCreate(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const {
        tipoProduto,
        nomeProduto,
        dataFinalizacaoProcesso,
        categoriaRegulatoria,
        numeroRegistroProduto,
        dataVencimentoRegistro,
        numeroProcesso,
        classeTerapeutica,
        empresaDetentoraRegistro,
        situacaoRegistro,
        principioAtivo,
      } = req.body;

      const novoMedicamento = await medicamentoService.create({
        tipoProduto,
        nomeProduto,
        dataFinalizacaoProcesso: dataFinalizacaoProcesso ? new Date(dataFinalizacaoProcesso) : undefined,
        categoriaRegulatoria,
        numeroRegistroProduto,
        dataVencimentoRegistro: dataVencimentoRegistro ? new Date(dataVencimentoRegistro) : undefined,
        numeroProcesso,
        classeTerapeutica,
        empresaDetentoraRegistro,
        situacaoRegistro,
        principioAtivo,
      }, user);

      return res.status(201).json(novoMedicamento);
    } catch (error: any) {
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const id = Number(req.params.id);
      const {
        tipoProduto,
        nomeProduto,
        dataFinalizacaoProcesso,
        categoriaRegulatoria,
        numeroRegistroProduto,
        dataVencimentoRegistro,
        numeroProcesso,
        classeTerapeutica,
        empresaDetentoraRegistro,
        situacaoRegistro,
        principioAtivo,
      } = req.body;

      const data: any = {};
      if (tipoProduto !== undefined) data.tipoProduto = tipoProduto;
      if (nomeProduto !== undefined) data.nomeProduto = nomeProduto;
      if (dataFinalizacaoProcesso !== undefined) data.dataFinalizacaoProcesso = dataFinalizacaoProcesso ? new Date(dataFinalizacaoProcesso) : null;
      if (categoriaRegulatoria !== undefined) data.categoriaRegulatoria = categoriaRegulatoria;
      if (numeroRegistroProduto !== undefined) data.numeroRegistroProduto = numeroRegistroProduto;
      if (dataVencimentoRegistro !== undefined) data.dataVencimentoRegistro = dataVencimentoRegistro ? new Date(dataVencimentoRegistro) : null;
      if (numeroProcesso !== undefined) data.numeroProcesso = numeroProcesso;
      if (classeTerapeutica !== undefined) data.classeTerapeutica = classeTerapeutica;
      if (empresaDetentoraRegistro !== undefined) data.empresaDetentoraRegistro = empresaDetentoraRegistro;
      if (situacaoRegistro !== undefined) data.situacaoRegistro = situacaoRegistro;
      if (principioAtivo !== undefined) data.principioAtivo = principioAtivo;

      const medicamentoAtualizado = await medicamentoService.update(id, data, user);
      return res.status(200).json(medicamentoAtualizado);
    } catch (error: any) {
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === 'Medicamento não encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleDelete(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const id = Number(req.params.id);
      await medicamentoService.delete(id, user);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === 'Medicamento não encontrado.') {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  async handleBulkCreate(req: Request, res: Response) {
    try {
      const user = req.user!; // User vem do middleware de autenticação
      const { medicamentos } = req.body;

      if (!Array.isArray(medicamentos)) {
        return res.status(400).json({ message: 'medicamentos deve ser um array.' });
      }

      const result = await medicamentoService.bulkCreate(medicamentos, user);
      return res.status(201).json({
        message: `${result.count} medicamento(s) criado(s) com sucesso.`,
        count: result.count,
      });
    } catch (error: any) {
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async handleGetPrincipiosAtivos(req: Request, res: Response) {
    try {
      const { busca } = req.query;
      const principiosAtivos = await medicamentoService.getPrincipiosAtivos(busca as string);
      return res.status(200).json(principiosAtivos);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  async handleVerificarPrincipioAtivo(req: Request, res: Response) {
    try {
      const { principioAtivo } = req.body;

      if (!principioAtivo || !principioAtivo.trim()) {
        return res.status(400).json({ message: 'Princípio ativo é obrigatório.' });
      }

      const existe = await medicamentoService.verificarPrincipioAtivoExiste(principioAtivo);
      return res.status(200).json({ existe });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
}

export default new MedicamentoController();

