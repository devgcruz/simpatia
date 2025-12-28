import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const FeatureIA = () => {
  const [currentMessage, setCurrentMessage] = useState(0);

  const messages = [
    { sender: 'patient', text: 'Oi, preciso marcar uma consulta', delay: 1000 },
    { sender: 'ia', text: 'Olá! Claro, vou te ajudar. Qual especialidade você precisa?', delay: 2000 },
    { sender: 'patient', text: 'Preciso de um dentista, tenho uma dor de dente', delay: 3000 },
    { sender: 'ia', text: 'Entendo. Vejo que você está com dor. Para priorizar seu atendimento, a dor é intensa? Você consegue aguardar até amanhã ou precisa de urgência?', delay: 4000 },
    { sender: 'patient', text: 'É bem forte, não consigo esperar muito', delay: 5000 },
    { sender: 'ia', text: 'Perfeito! Identifiquei como urgência. Tenho um horário hoje às 15h com Dr. Silva. Posso confirmar?', delay: 6000 },
    { sender: 'patient', text: 'Sim, perfeito!', delay: 7000 },
    { sender: 'ia', text: '✅ Agendamento confirmado para hoje às 15h com Dr. Silva. Enviarei um lembrete 2h antes. Até logo!', delay: 8000 },
  ];

  useEffect(() => {
    setCurrentMessage(0);
    const timers: NodeJS.Timeout[] = [];
    
    messages.forEach((msg, index) => {
      const timer = setTimeout(() => {
        setCurrentMessage(index + 1);
      }, msg.delay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <section id="demo" className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-medical-dark mb-4">
            A Secretária IA que{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-blue to-medical-light-blue">
              Entende Contexto
            </span>
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Não é um chatbot burro. É uma IA Generativa (Gemini) que entende contexto, detecta urgências e gerencia sua agenda inteligentemente.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* WhatsApp Simulation */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-gray-100 rounded-3xl p-6 shadow-2xl"
          >
            <div className="bg-medical-green rounded-t-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-medical-green" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Simpatia IA</p>
                <p className="text-green-100 text-sm">Online</p>
              </div>
            </div>
            <div className="bg-white rounded-b-2xl p-4 h-96 overflow-y-auto">
              {messages.slice(0, currentMessage).map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`mb-4 flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.sender === 'patient'
                        ? 'bg-medical-light-blue text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-medical-blue bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-medical-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-medical-dark mb-2">Agendamento Natural</h3>
                <p className="text-gray-700">
                  Pacientes agendam por voz ou texto no WhatsApp de forma natural, como se estivessem falando com uma recepcionista real.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-medical-green bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-medical-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-medical-dark mb-2">Encaixes Inteligentes</h3>
                <p className="text-gray-700">
                  Preenche automaticamente buracos na agenda, otimizando sua capacidade e reduzindo tempo ocioso.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-500 bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-medical-dark mb-2">Detecção Automática de Urgências</h3>
                <p className="text-gray-700">
                  Identifica automaticamente casos urgentes através de análise de linguagem natural e prioriza o atendimento.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-500 bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-medical-dark mb-2">Confirmação 24/7</h3>
                <p className="text-gray-700">
                  Envia lembretes automáticos via WhatsApp, reduzindo no-show em até 40% no primeiro mês.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeatureIA;

