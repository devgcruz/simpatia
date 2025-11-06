// TODO: Implementar integração completa com LangChain e Gemini
// Por enquanto, vamos usar uma lógica básica simulada

import whatsappService from './whatsapp.service';
import pacienteService from './pacientes.service';

class IaService {

    async handleMensagem(mensagemBruta: any) {
        try {
            // 1. Parsear a mensagem do WhatsApp
            const texto = mensagemBruta.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
            const telefone = mensagemBruta.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

            if (!texto || !telefone) {
                console.error('Estrutura da mensagem inválida:', JSON.stringify(mensagemBruta, null, 2));
                return;
            }

            console.log(`Mensagem de ${telefone}: ${texto}`);

            // 2. Buscar paciente pelo telefone
            let paciente = await pacienteService.getByTelefone(telefone);

            // 3. Lógica de IA (Simulada por enquanto)
            // TODO: Implementar LangChain e Gemini aqui
            let resposta = "";

            if (!paciente) {
                // Se o paciente não existe, pedir o nome para cadastrá-lo
                resposta = "Olá! 👋 Bem-vindo à Clínica! Para começar, preciso do seu nome completo, por favor.";
            } else if (texto.toLowerCase().includes("oi") || texto.toLowerCase().includes("olá") || texto.toLowerCase().includes("ola")) {
                resposta = `Olá, ${paciente.nome}! 👋 Sou a assistente virtual da Clínica. Como posso ajudar você hoje?\n\nVocê pode:\n• Verificar horários disponíveis\n• Agendar uma consulta\n• Ver meus serviços`;
            } else if (texto.toLowerCase().includes("horários") || texto.toLowerCase().includes("horarios") || texto.toLowerCase().includes("disponível") || texto.toLowerCase().includes("disponivel")) {
                // TODO: Chamar o disponibilidade.service
                resposta = "Estou verificando os horários disponíveis... (Esta funcionalidade será implementada em breve)";
            } else if (texto.toLowerCase().includes("agendar") || texto.toLowerCase().includes("marcar")) {
                // TODO: Implementar lógica de agendamento
                resposta = "Para agendar uma consulta, preciso de algumas informações:\n• Qual serviço você deseja?\n• Qual data você prefere?\n\n(Esta funcionalidade será implementada em breve)";
            } else if (texto.toLowerCase().includes("serviços") || texto.toLowerCase().includes("servicos")) {
                // TODO: Buscar serviços disponíveis
                resposta = "Aqui estão nossos serviços:\n\n(Esta funcionalidade será implementada em breve)";
            } else {
                resposta = "Desculpe, não entendi completamente. Estou aprendendo! 😊\n\nVocê pode:\n• Dizer 'oi' para começar\n• Perguntar sobre 'horários'\n• Solicitar 'agendar' uma consulta\n• Ver nossos 'serviços'";
            }

            // 4. Enviar resposta via WhatsApp
            await whatsappService.enviarMensagem(telefone, resposta);

        } catch (error: any) {
            console.error("Erro no processamento da IA:", error);
            // Tentar enviar mensagem de erro (se possível)
            try {
                const telefone = mensagemBruta.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
                if (telefone) {
                    await whatsappService.enviarMensagem(
                        telefone,
                        "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente em alguns instantes."
                    );
                }
            } catch (err) {
                console.error("Erro ao enviar mensagem de erro:", err);
            }
        }
    }
}

export default new IaService();

