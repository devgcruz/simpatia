// Script para gerar certificados SSL auto-assinados para desenvolvimento
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, '../certs');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

// Criar diretório se não existir
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// Verificar se os certificados já existem
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✅ Certificados SSL já existem em:', certDir);
  process.exit(0);
}

console.log('🔐 Gerando certificados SSL para desenvolvimento...');

try {
  // Gerar chave privada e certificado auto-assinado
  // Válido por 365 dias, sem senha, para localhost e 127.0.0.1
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 365 -subj "/C=BR/ST=SP/L=SaoPaulo/O=Dev/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"`,
    { stdio: 'inherit' }
  );
  
  console.log('✅ Certificados SSL gerados com sucesso!');
  console.log(`   Chave: ${keyPath}`);
  console.log(`   Certificado: ${certPath}`);
  console.log('\n⚠️  ATENÇÃO: Estes são certificados auto-assinados apenas para desenvolvimento.');
  console.log('   Seu navegador mostrará um aviso de segurança. Aceite para continuar.\n');
} catch (error) {
  console.error('❌ Erro ao gerar certificados:', error.message);
  console.log('\n💡 Dica: Certifique-se de ter o OpenSSL instalado.');
  console.log('   Windows: Baixe de https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   Ou use: choco install openssl (se tiver Chocolatey)');
  process.exit(1);
}

