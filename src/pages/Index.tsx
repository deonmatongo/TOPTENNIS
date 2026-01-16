
import Hero from "@/components/Hero";
import NewsSection from "@/components/NewsSection";
import Players from "@/components/Players";
import WeatherForecast from "@/components/WeatherForecast";
import Locations from "@/components/Locations";
import TennisLadder from "@/components/TennisLadder";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CookieConsent from "@/components/CookieConsent";

const Index = () => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Header />
      <Hero />
      <NewsSection />
      <Players />
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
