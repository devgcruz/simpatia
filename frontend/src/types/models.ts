export interface IServico {
  id: number;
  nome: string;
  descricao: string;
  duracaoMin: number;
  preco: number;
  clinicaId: number;
}

export interface IPaciente {
  id: number;
  nome: string;
  telefone: string;
  clinicaId: number;
}