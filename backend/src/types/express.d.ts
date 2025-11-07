// src/types/express.d.ts

// Define os Níveis de Acesso (copiado do schema.prisma)
enum Role {
  DOUTOR,
  CLINICA_ADMIN,
  SUPER_ADMIN
}

// Estende a interface Request do Express
declare namespace Express {
  export interface Request {
    user?: {
      id: number;
      role: string; // Estamos usando string aqui para simplificar
      clinicaId: number;
    };
  }
}

