import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Crosshair, Sun, Droplets, Layers } from "lucide-react";
import { getCurrentLocation } from "@/services/geolocationService";

const surfaceTypes = [
  {
    name: "Hard Court",
    description: "The most common surface in North America. Consistent, medium-paced bounce. Great for all-round players.",
    icon: Layers,
  },
  {
    name: "Clay Court",
    description: "Slower pace with a high bounce. Rewards patience and baseline play. Easier on the joints.",
    icon: Droplets,
  },
  {
    name: "Grass Court",
    description: "Fast and low-bouncing. Suits serve-and-volley players. Less common but available in parks and private clubs.",
    icon: Sun,
  },
];

const Courts = () => {
  const [zipCode, setZipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const openMaps = (query: string) => {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, "_blank");
  };

  const handleSearch = () => {
    if (!zipCode.trim()) return;
    setIsSearching(true);
    openMaps(`tennis courts near ${zipCode}`);
    setIsSearching(false);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      await getCurrentLocation();
      openMaps("tennis courts near me");
    } catch {
      openMaps("tennis courts near me");
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <PageMeta
        title="Find Tennis Courts Near You | Top Tennis League"
        description="Locate nearby tennis courts — hard court, clay, and grass. Search by ZIP code or use your current location to find courts, hours, and amenities on Google Maps."
      />
      <Header />

      {/* Hero */}
      <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: "#0B1526" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
              <span
                className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
                style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}
              >
                Courts
              </span>
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
                Find a Tennis Court Near You
              </h1>
              <p className="text-base text-white/50 max-w-lg leading-relaxed">
                Search by ZIP code or use your location to find local courts on Google Maps —
                with real-time hours, directions, and reviews.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search section */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-900">Search for Courts</h2>

          <Button
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            variant="outline"
            className="w-full border-gray-200 justify-center rounded-xl"
          >
            {isLocating ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent mr-2" />
            ) : (
              <Crosshair className="w-4 h-4 mr-2 text-orange-500" />
            )}
            Use My Current Location
          </Button>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-100" />
            or search by ZIP code
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Enter ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                maxLength={5}
                className="pl-9 rounded-xl"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !zipCode.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-5"
            >
              {isSearching ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Opens Google Maps with tennis courts near your location.
          </p>
        </div>
      </div>

      {/* Surface types */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <h2 className="text-2xl font-black text-gray-900 mb-8">Court Surface Types</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {surfaceTypes.map(({ name, description, icon: Icon }) => (
            <div
              key={name}
              className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-orange-200 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{name}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Courts;
