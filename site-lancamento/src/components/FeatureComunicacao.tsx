import { motion } from 'framer-motion';

const FeatureComunicacao = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              COMPLIANCE & PRIVACIDADE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-medical-dark mb-6">
              Comunicação{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-blue to-medical-light-blue">
                Blindada
              </span>
            </h2>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Elimine grupos de WhatsApp pessoais para discutir casos clínicos. Use nosso chat interno criptografado, seguro e profissional.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-medical-blue bg-opacity-10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-medical-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-medical-dark mb-2">Criptografia End-to-End</h3>
                  <p className="text-gray-700">
                    Todas as mensagens são criptografadas. Apenas membros autorizados da equipe têm acesso.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-medical-green bg-opacity-10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-medical-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-medical-dark mb-2">Status de Leitura</h3>
                  <p className="text-gray-700">
                    Saiba quando sua mensagem foi lida. Controle total sobre a comunicação da equipe.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-500 bg-opacity-10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-medical-dark mb-2">Envio de Arquivos Seguro</h3>
                  <p className="text-gray-700">
                    Compartilhe exames, imagens e documentos com segurança. Tudo armazenado de forma criptografada.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500 bg-opacity-10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-medical-dark mb-2">Separação Total de Dados</h3>
                  <p className="text-gray-700">
                    Cada clínica tem seu próprio ambiente isolado. Zero risco de vazamento de informações entre organizações.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-medical-blue to-medical-light-blue rounded-3xl p-8 shadow-2xl">
              <div className="bg-white rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-medical-blue rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">S</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Chat Interno Simpatia</p>
                    <p className="text-sm text-gray-500">Equipe da Clínica</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-medical-blue rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">DR</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800 mb-1">Dr. Silva</p>
                        <p className="text-sm text-gray-700">Paciente João precisa de retorno em 30 dias. Pode agendar?</p>
                        <p className="text-xs text-gray-500 mt-1">10:30</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-medical-green rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">RC</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800 mb-1">Recepcionista</p>
                        <p className="text-sm text-gray-700">Claro! Já agendei para 15/02 às 14h. ✅</p>
                        <p className="text-xs text-gray-500 mt-1">10:32</p>
                        <div className="flex items-center gap-1 mt-1">
                          <svg className="w-4 h-4 text-medical-green" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-medical-green">Lida</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">EN</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800 mb-1">Enfermeira</p>
                        <p className="text-sm text-gray-700">Enviei o resultado do exame no chat. 📄</p>
                        <p className="text-xs text-gray-500 mt-1">10:35</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-medical-green" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Criptografia End-to-End Ativa</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeatureComunicacao;

