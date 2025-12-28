import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FeatureIA from './components/FeatureIA';
import FeatureSeguranca from './components/FeatureSeguranca';
import FeatureComunicacao from './components/FeatureComunicacao';
import SocialProof from './components/SocialProof';
import Pricing from './components/Pricing';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <FeatureIA />
      <FeatureSeguranca />
      <FeatureComunicacao />
      <SocialProof />
      <Pricing />
      <Footer />
    </div>
  );
}

export default App;

