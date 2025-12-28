import { motion } from 'framer-motion';

const SocialProof = () => {
  const testimonials = [
    {
      name: 'Dr. Carlos Mendes',
      role: 'Diretor Clínico - Clínica Saúde Total',
      specialty: 'Cardiologia',
      quote: 'Reduzimos nosso no-show em 40% no primeiro mês. A IA no WhatsApp mudou completamente nossa operação.',
      avatar: 'CM',
    },
    {
      name: 'Dra. Ana Paula Silva',
      role: 'Dentista - Sorriso Perfeito',
      specialty: 'Odontologia',
      quote: 'Finalmente consegui focar no que importa: meus pacientes. A agenda se organiza sozinha.',
      avatar: 'AS',
    },
    {
      name: 'Dr. Roberto Lima',
      role: 'Psicólogo - Mente Sã',
      specialty: 'Psicologia',
      quote: 'A segurança dos dados e o chat interno criptografado foram decisivos na nossa escolha.',
      avatar: 'RL',
    },
  ];

  const stats = [
    { number: '40%', label: 'Redução de No-Show' },
    { number: '24/7', label: 'Disponibilidade da IA' },
    { number: '99.9%', label: 'Uptime Garantido' },
    { number: '256-bit', label: 'Criptografia' },
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-medical-blue to-medical-light-blue">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.number}</div>
              <div className="text-blue-100 text-sm md:text-base">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-blue-100 text-xl">
            Médicos, dentistas e psicólogos que transformaram suas clínicas
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-medical-blue to-medical-light-blue rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{testimonial.avatar}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed italic mb-4">
                "{testimonial.quote}"
              </p>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Partner Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 text-center"
        >
          <p className="text-blue-100 text-sm mb-8">Clínicas que confiam no Simpatia</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-80">
            {['Clínica Saúde Total', 'Sorriso Perfeito', 'Mente Sã', 'Vida Plena', 'Bem Estar'].map((name, index) => (
              <div key={index} className="text-white font-semibold text-lg">
                {name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SocialProof;

