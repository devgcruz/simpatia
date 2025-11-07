# Configuração do Banco de Dados

## Problema de Autenticação

Se você está recebendo o erro:
```
Error: P1000: Authentication failed against database server
```

Isso significa que as credenciais do PostgreSQL no arquivo `.env` estão incorretas.

## Como Corrigir

### 1. Verifique se o PostgreSQL está rodando

```bash
# Windows (PowerShell)
Get-Service -Name postgresql*

# Ou verifique se a porta 5432 está em uso
netstat -an | findstr 5432
```

### 2. Corrija o DATABASE_URL no arquivo `.env`

O formato correto é:
```
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/NOME_DO_BANCO?schema=public"
```

**Exemplo:**
```
DATABASE_URL="postgresql://postgres:minhasenha@localhost:5432/simpatia?schema=public"
```

**Importante:**
- Se sua senha contém caracteres especiais (como `@`), você precisa codificá-la em URL:
  - `@` vira `%40`
  - `#` vira `%23`
  - `$` vira `%24`
  - etc.

### 3. Crie o banco de dados (se não existir)

Conecte-se ao PostgreSQL e execute:

```sql
CREATE DATABASE simpatia;
```

### 4. Execute as migrações

Depois de corrigir as credenciais, execute:

```bash
# Aplicar todas as migrações pendentes
npx prisma migrate dev

# OU, para desenvolvimento rápido (sem criar migrações)
npx prisma db push
```

### 5. Gerar o Prisma Client

```bash
npx prisma generate
```

## Comandos Úteis

```bash
# Ver status das migrações
npx prisma migrate status

# Resetar o banco (CUIDADO: apaga todos os dados!)
npx prisma migrate reset

# Ver o schema do banco
npx prisma studio
```

## Testar a Conexão

Execute o script de teste:

```bash
npm run test-db-connection
```

