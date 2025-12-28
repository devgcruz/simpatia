import { useState, useEffect } from 'react';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-lg' : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-medical-blue to-medical-light-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className={`text-2xl font-bold ${isScrolled ? 'text-medical-dark' : 'text-white'}`}>
              Simpatia
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#demo"
              className={`font-medium hover:text-medical-blue transition-colors ${
                isScrolled ? 'text-gray-700' : 'text-white'
              }`}
            >
              Funcionalidades
            </a>
            <a
              href="#precos"
              className={`font-medium hover:text-medical-blue transition-colors ${
                isScrolled ? 'text-gray-700' : 'text-white'
              }`}
            >
              Preços
            </a>
            <a
              href="#contato"
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                isScrolled
                  ? 'bg-medical-blue text-white hover:bg-medical-light-blue'
                  : 'bg-white text-medical-blue hover:bg-blue-50'
              }`}
            >
              Começar Agora
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;

