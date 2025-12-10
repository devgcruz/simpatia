import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Criar pasta de uploads se não existir
const uploadsDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fotosPacientesDir = path.join(__dirname, '../../uploads/fotos-pacientes');
if (!fs.existsSync(fotosPacientesDir)) {
  fs.mkdirSync(fotosPacientesDir, { recursive: true });
}

// Configuração do multer para logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Nome único: timestamp + nome original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

// Configuração do multer para fotos de pacientes
const storageFotosPacientes = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fotosPacientesDir);
  },
  filename: (req, file, cb) => {
    // Nome único: timestamp + nome original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `foto-paciente-${uniqueSuffix}${ext}`);
  },
});

// Filtrar apenas imagens
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter,
});

const uploadFotoPaciente = multer({
  storage: storageFotosPacientes,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter,
});

// Rota para upload de logo (authMiddleware será aplicado no index.ts)
router.post('/logo', upload.single('logo'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    // Retornar URL do arquivo
    const fileUrl = `/api/uploads/logos/${req.file.filename}`;
    
    res.json({
      message: 'Logo enviado com sucesso',
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao fazer upload do logo' });
  }
});

// Rota para upload de foto de paciente (authMiddleware será aplicado no index.ts)
router.post('/foto-paciente', uploadFotoPaciente.single('foto'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    // Retornar URL do arquivo
    const fileUrl = `/api/uploads/fotos-pacientes/${req.file.filename}`;
    
    res.json({
      message: 'Foto enviada com sucesso',
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Erro ao fazer upload da foto' });
  }
});

export default router;

