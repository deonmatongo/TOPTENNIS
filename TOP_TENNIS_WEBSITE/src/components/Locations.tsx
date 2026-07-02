import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Crosshair, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocationFromZipCode, getCurrentLocation, getNearbyTennisCourtsFree } from "@/services/geolocationService";
import TennisCourtModal from "./TennisCourtModal";

const Locations = () => {
  const [zipCode, setZipCode] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentLocationInfo, setCurrentLocationInfo] = useState<string>("");
  const [realCourts, setRealCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const allLocations = [
    {
      name: "CENTRAL PARK TENNIS CENTER",
      address: "CENTRAL PARK, NEW YORK CITY",
      zipCode: "10019",
      distance: "2.3 miles",
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
    },
    {
      name: "GRIFFITH PARK TENNIS COURTS",
      address: "GRIFFITH PARK, LOS ANGELES",
      zipCode: "90027",
      distance: "1.8 miles",
      image: "https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2064&q=80"
    },
    {
      name: "MILLENNIUM PARK TENNIS",
      address: "MILLENNIUM PARK, CHICAGO",
      zipCode: "60601",
      distance: "0.9 miles",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
    },
    {
      name: "SOUTH BEACH TENNIS CLUB",
      address: "SOUTH BEACH, MIAMI",
      zipCode: "33139",
      distance: "3.1 miles",
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
    },
    {
      name: "RIVERSIDE TENNIS COMPLEX",
      address: "RIVERSIDE DRIVE, NEW YORK",
      zipCode: "10025",
      distance: "1.2 miles",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
    },
    {
      name: "BEVERLY HILLS TENNIS CLUB",
      address: "BEVERLY HILLS, LOS ANGELES",
      zipCode: "90210",
      distance: "4.2 miles",
      image: "https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2064&q=80"
    }
  ];

  const handleSearch = async () => {
    if (!zipCode.trim()) return;
    
    setIsSearching(true);
    console.log(`Redirecting to Google Maps for tennis courts near: ${zipCode}`);

    try {
      // Redirect to Google Maps with search for tennis courts near the zip code
      const searchQuery = `tennis courts near ${zipCode}`;
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      window.open(mapsUrl, '_blank');
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    console.log('Getting current location and redirecting to Google Maps...');

    try {
      const locationData = await getCurrentLocation();
      
      if (locationData) {
        console.log('Current location found:', locationData);
        
        // Redirect to Google Maps with search for tennis courts near current location
        const searchQuery = `tennis courts near me`;
        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        window.open(mapsUrl, '_blank');
      } else {
        console.log('No location data found');
        // Fallback to generic search
        const mapsUrl = `https://www.google.com/maps/search/tennis+courts+near+me`;
        window.open(mapsUrl, '_blank');
      }
    } catch (error) {
      console.error('Location error:', error);
      // Fallback to generic search
      const mapsUrl = `https://www.google.com/maps/search/tennis+courts+near+me`;
      window.open(mapsUrl, '_blank');
    } finally {
      setIsLocating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  
  const handleCourtClick = (court: any) => {
    setSelectedCourt(court);
    setIsModalOpen(true);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  // Show real courts when searched, otherwise show sample courts
  const displayLocations = hasSearched && searchResults.length > 0 ? searchResults : allLocations;

  return (
    <section id="locations" className="py-8 sm:py-12 lg:py-16 xl:py-20 bg-gradient-to-br from-orange-900 via-black to-orange-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 xl:gap-16 items-start">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-4 sm:mb-6 lg:mb-8">LOOKING FOR A COURT?</h2>
            <p className="text-sm sm:text-base lg:text-lg xl:text-xl mb-4 sm:mb-6 lg:mb-8 opacity-90 leading-relaxed max-w-lg mx-auto lg:mx-0">Ready to serve? Find the perfect court near you—just drop your ZIP code!</p>

            {/* Current Location Button */}
            <div className="mb-4 sm:mb-6">
              <Button 
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2"
              >
                {isLocating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                ) : (
                  <Crosshair className="w-4 h-4 mr-2" />
                )}
                Use My Current Location
              </Button>
              {currentLocationInfo && (
                <div id="location" className="text-sm text-orange-300 mt-2 font-medium">
                  📍 Located in: {currentLocationInfo}
                </div>
              )}
            </div>

            {/* Zip Code Search */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    type="text" 
                    placeholder="Enter zip code" 
                    value={zipCode} 
                    onChange={e => setZipCode(e.target.value)} 
                    onKeyPress={handleKeyPress}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-orange-500" 
                    maxLength={5} 
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || !zipCode.trim()} 
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 min-w-[100px]"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
              {hasSearched && (
                <p className="text-sm opacity-70 mt-2 text-center lg:text-left">
                  {searchResults.length > 0 
                    ? `Found ${searchResults.length} courts near ${currentLocationInfo || zipCode}` 
                    : `No courts found near ${currentLocationInfo || zipCode}. Try a different location.`
                  }
                </p>
              )}
            </div>
          </div>

          {/* Tennis Courts Carousel */}
          <div className="relative">
            {/* Navigation Buttons */}
            {displayLocations.length > 6 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={scrollLeft}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={scrollRight}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Scrollable Container */}
            <div 
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
              style={{ 
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {displayLocations.map((location, index) => (
                <div 
                  key={location.id || index} 
                  className="flex-shrink-0 w-64 cursor-pointer bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-orange-500/30"
                  style={{ scrollSnapAlign: 'start' }}
                  onClick={() => handleCourtClick(location)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-400 transition-colors">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base mb-2 leading-tight text-white hover:text-orange-300 transition-colors line-clamp-2">
                        {location.name}
                      </h3>
                      <p className="text-sm text-white/70 mb-2 line-clamp-2">{location.address}</p>
                      {hasSearched && location.distance && (
                        <div className="inline-flex items-center gap-1 bg-orange-500/20 text-orange-300 px-2 py-1 rounded-md text-xs font-medium mb-2">
                          <MapPin className="w-3 h-3" />
                          {location.distance} away
                        </div>
                      )}
                      <p className="text-xs text-white/40 italic">Click for more details</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Scroll Indicator */}
            <div className="flex justify-center mt-4 gap-1">
              {Array.from({ length: Math.ceil(displayLocations.length / 6) }).map((_, index) => (
                <div 
                  key={index} 
                  className="w-2 h-2 rounded-full bg-white/30"
                />
              ))}
            </div>
          </div>
        </div>
        
        {displayLocations.length === 0 && hasSearched && (
          <div className="text-center mt-8">
            <p className="text-white/60">Try searching for a different area or browse our popular courts above.</p>
          </div>
        )}
        
        <TennisCourtModal 
          court={selectedCourt}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </section>
  );
};

export default Locations;
