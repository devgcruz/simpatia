# Simpatia Frontend

Frontend moderno e escalável para o sistema de atendimento médico com IA.

## 🚀 Tecnologias

- **React 18** - Biblioteca UI moderna
- **TypeScript** - Tipagem estática
- **Material-UI (MUI)** - Componentes de interface
- **Framer Motion** - Animações fluidas
- **Vite** - Build tool rápida
- **React Router** - Roteamento
- **Axios** - Cliente HTTP

## 📦 Instalação

```bash
cd frontend
npm install
```

## 🛠️ Desenvolvimento

1. Certifique-se de que o backend está rodando na porta 3333
2. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`

## 📁 Estrutura do Projeto

```
src/
  ├── components/    # Componentes reutilizáveis (Loading, etc)
  ├── contexts/      # Contextos React (AuthContext)
  ├── pages/         # Páginas da aplicação (Login, Dashboard, etc)
  ├── services/      # Serviços de API (api.ts, auth.service.ts)
  └── theme/         # Configuração do tema MUI
```

## 🎨 Características

- ✅ Tela de login moderna e animada
- ✅ Tema customizado com foco em área médica/IA
- ✅ Animações fluidas com Framer Motion
- ✅ Integração completa com backend
- ✅ Autenticação via cookies httpOnly
- ✅ Design responsivo
- ✅ TypeScript para type safety

## 🔐 Autenticação

O sistema utiliza autenticação via cookies httpOnly para máxima segurança. O token JWT é armazenado automaticamente pelo navegador após o login bem-sucedido.

## 🎯 Próximos Passos

- [ ] Dashboard completo
- [ ] Gerenciamento de pacientes
- [ ] Sistema de agendamentos
- [ ] Integração com IA para atendimento

