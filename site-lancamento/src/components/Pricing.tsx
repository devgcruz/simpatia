import { motion } from 'framer-motion';

const Pricing = () => {
  const plans = [
    {
      name: 'Essencial',
      price: 'R$ 297',
      period: '/mês',
      description: 'Ideal para clínicas pequenas que precisam de organização básica',
      features: [
        'Agenda completa',
        'Prontuário eletrônico',
        'Gestão de pacientes',
        'Emissão de atestados',
        'Emissão de prescrições',
        'Suporte por email',
      ],
      cta: 'Começar Agora',
      popular: false,
    },
    {
      name: 'Smart',
      price: 'R$ 497',
      period: '/mês',
      description: 'Recomendado: Tudo do Essencial + IA no WhatsApp + Alertas',
      features: [
        'Tudo do plano Essencial',
        'IA no WhatsApp 24/7',
        'Confirmação automática',
        'Detecção de urgências',
        'Encaixes inteligentes',
        'Alerta de alergias cruzadas',
        'Banco de medicamentos',
        'Suporte prioritário',
      ],
      cta: 'Começar Agora',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Sob Consulta',
      period: '',
      description: 'Para clínicas com múltiplas unidades e necessidades específicas',
      features: [
        'Tudo do plano Smart',
        'Multi-unidades',
        'API dedicada',
        'Integrações personalizadas',
        'Treinamento da equipe',
        'Gerente de conta dedicado',
        'Suporte 24/7',
        'SLA garantido',
      ],
      cta: 'Falar com Vendas',
      popular: false,
    },
  ];

  return (
    <section id="precos" className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-medical-dark mb-4">
            Planos que se adaptam à sua{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-blue to-medical-light-blue">
              Clínica
            </span>
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Escolha o plano ideal para o tamanho e necessidades da sua clínica. Sem surpresas, sem taxas escondidas.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-gradient-to-br from-medical-blue to-medical-light-blue text-white shadow-2xl scale-105'
                  : 'bg-gray-50 border-2 border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-medical-green text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-medical-dark'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-blue-100' : 'text-gray-600'}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline">
                  <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-medical-dark'}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={`ml-2 ${plan.popular ? 'text-blue-100' : 'text-gray-600'}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <svg
                      className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'text-medical-green' : 'text-medical-green'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className={plan.popular ? 'text-blue-50' : 'text-gray-700'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#contato"
                className={`block w-full text-center py-4 rounded-lg font-semibold transition-all duration-300 ${
                  plan.popular
                    ? 'bg-white text-medical-blue hover:bg-blue-50'
                    : 'bg-medical-blue text-white hover:bg-medical-light-blue'
                } transform hover:scale-105`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-green-50 border-2 border-medical-green rounded-full px-6 py-3">
            <svg className="w-6 h-6 text-medical-green" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-medical-dark font-semibold">
              Garantia de 30 dias ou seu dinheiro de volta
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;

