import { Request, Response } from 'express';
import dashboardService from '../services/dashboard.service';

class DashboardController {
  async handleGetMetrics(req: Request, res: Response) {
    try {
      const user = req.user!;

      // Validação de role
      if (user.role !== 'CLINICA_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem acessar estas métricas.' });
      }

      const metrics = await dashboardService.getMetrics(user);
      return res.status(200).json(metrics);
    } catch (error: any) {
      if (error.message === 'Acesso negado. Apenas administradores podem acessar estas métricas.') {
        return res.status(403).json({ message: error.message });
      }
      console.error('Erro ao buscar métricas do dashboard:', error);
      return res.status(500).json({ message: 'Erro ao buscar métricas do dashboard' });
    }
  }
}

export default new DashboardController();

