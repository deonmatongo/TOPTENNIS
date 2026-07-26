
import Hero from "@/components/Hero";
import NewsSection from "@/components/NewsSection";
import WeatherForecast from "@/components/WeatherForecast";
import Locations from "@/components/Locations";
import TennisLadder from "@/components/TennisLadder";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CookieConsent from "@/components/CookieConsent";
import PageMeta from "@/components/PageMeta";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageMeta
        title="Top Tennis League | Competitive Tennis for All Skill Levels"
        description="Join a competitive tennis league near you. Men's, Women's, and Mixed Doubles divisions for all skill levels. Match with players at your level, schedule flexibly, and climb the ladder."
      />
      <Header />
      <Hero />
      <NewsSection />
      <WeatherForecast />
      <Locations />
      <TennisLadder />
      <FAQ />
      <Newsletter />
      <Footer />
      <CookieConsent />
    </div>
  );
};

export default Index;
