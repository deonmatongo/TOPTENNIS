import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Crosshair, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { getCurrentLocation } from "@/services/geolocationService";
import TennisCourtModal from "./TennisCourtModal";

const sampleLocations = [
  { name: "Central Park Tennis Center", address: "Central Park, New York City", zipCode: "10019", image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=600&q=80" },
  { name: "Griffith Park Tennis Courts", address: "Griffith Park, Los Angeles", zipCode: "90027", image: "https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?auto=format&fit=crop&w=600&q=80" },
  { name: "Millennium Park Tennis", address: "Millennium Park, Chicago", zipCode: "60601", image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=600&q=80" },
  { name: "South Beach Tennis Club", address: "South Beach, Miami", zipCode: "33139", image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=600&q=80" },
  { name: "Riverside Tennis Complex", address: "Riverside Drive, New York", zipCode: "10025", image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=600&q=80" },
  { name: "Beverly Hills Tennis Club", address: "Beverly Hills, Los Angeles", zipCode: "90210", image: "https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?auto=format&fit=crop&w=600&q=80" },
];

const Locations = () => {
  const [zipCode, setZipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const openMaps = (query: string) => {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
  };

  const handleSearch = async () => {
    if (!zipCode.trim()) return;
    setIsSearching(true);
    openMaps(`tennis courts near ${zipCode}`);
    setIsSearching(false);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      await getCurrentLocation();
      openMaps('tennis courts near me');
    } catch {
      openMaps('tennis courts near me');
    } finally {
      setIsLocating(false);
    }
  };

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });

  return (
    <section id="locations" className="py-16 sm:py-20 lg:py-28 overflow-hidden" style={{ backgroundColor: "#0B1526" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10 lg:mb-14">
          <div>
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full mb-4">
              Courts
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-3 text-white">
              Find a Court Near You
            </h2>
            <p className="text-base text-background/60 max-w-md leading-relaxed">
              Enter your ZIP code or use your current location to find tennis courts on Google Maps.
            </p>
          </div>

          {/* Search controls */}
          <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[340px]">
            <Button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              variant="outline"
              className="w-full border-background/10 bg-background/5 hover:bg-background/10 text-background hover:text-background justify-center rounded-xl"
            >
              {isLocating
                ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                : <Crosshair className="w-4 h-4 mr-2 text-orange-400" />
              }
              Use My Location
            </Button>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-background/30" />
                <Input
                  type="text"
                  placeholder="ZIP code"
                  value={zipCode}
                  onChange={e => setZipCode(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  maxLength={5}
                  className="pl-9 bg-background/5 border-background/10 text-background placeholder:text-background/30 focus:border-orange-500/60 rounded-xl"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !zipCode.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-5"
              >
                {isSearching
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <Search className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Courts carousel */}
        <div className="relative">
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 hidden sm:block">
            <button onClick={scrollLeft} className="h-10 w-10 rounded-xl bg-background/5 hover:bg-background/10 border border-background/10 flex items-center justify-center transition-colors">
              <ChevronLeft className="w-5 h-5 text-background/60" />
            </button>
          </div>
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 hidden sm:block">
            <button onClick={scrollRight} className="h-10 w-10 rounded-xl bg-background/5 hover:bg-background/10 border border-background/10 flex items-center justify-center transition-colors">
              <ChevronRight className="w-5 h-5 text-background/60" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {sampleLocations.map((loc, i) => (
              <div
                key={i}
                onClick={() => { setSelectedCourt(loc); setIsModalOpen(true); }}
                className="group flex-shrink-0 w-64 sm:w-72 cursor-pointer rounded-2xl overflow-hidden border border-background/10 hover:border-orange-500/40 bg-background/5 hover:bg-background/10 transition-all duration-300"
              >
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={loc.image}
                    alt={loc.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm text-background leading-snug mb-1 line-clamp-2">
                    {loc.name}
                  </h3>
                  <p className="text-xs text-background/50 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                    {loc.address}
                  </p>
                  <p className="text-[10px] text-orange-400/60 mt-2 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Click for details
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TennisCourtModal
        court={selectedCourt}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
};

export default Locations;
