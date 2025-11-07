import 'dotenv/config';
import axios from 'axios';

async function testAPILogin() {
  try {
    const email = 'admin@mail.com';
    const senha = 'admin';

    console.log('Testando login via API...');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${senha}`);
    console.log('URL: http://localhost:3333/api/auth/login\n');

    const response = await axios.post(
      'http://localhost:3333/api/auth/login',
      { email, senha },
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Login bem-sucedido!');
    console.log('Status:', response.status);
    console.log('Dados do usuário:', JSON.stringify(response.data, null, 2));
    console.log('Cookies recebidos:', response.headers['set-cookie']);
  } catch (error: any) {
    if (error.response) {
      console.error('❌ Erro na resposta da API:');
      console.error('Status:', error.response.status);
      console.error('Mensagem:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('❌ Erro: Não foi possível conectar ao servidor');
      console.error('Certifique-se de que o backend está rodando na porta 3333');
    } else {
      console.error('❌ Erro:', error.message);
    }
    process.exit(1);
  }
}

testAPILogin();

