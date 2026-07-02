
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Search, Cloud, Sun, CloudRain, Wind, Thermometer, ChevronLeft, ChevronRight } from "lucide-react";

interface WeatherData {
  location: string;
  current: {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    icon: string;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
  }>;
}

const WeatherForecast = () => {
  const [location, setLocation] = useState("");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Mock weather data for demonstration
  const mockWeatherData: WeatherData = {
    location: "New York, NY",
    current: {
      temp: 72,
      condition: "Partly Cloudy",
      humidity: 65,
      windSpeed: 8,
      icon: "partly-cloudy"
    },
    forecast: [
      { date: "Today", high: 75, low: 68, condition: "Sunny", icon: "sunny" },
      { date: "Tomorrow", high: 73, low: 65, condition: "Partly Cloudy", icon: "partly-cloudy" },
      { date: "Thursday", high: 70, low: 62, condition: "Cloudy", icon: "cloudy" },
      { date: "Friday", high: 68, low: 60, condition: "Light Rain", icon: "rainy" },
      { date: "Saturday", high: 74, low: 66, condition: "Sunny", icon: "sunny" }
    ]
  };

  const handleSearch = async () => {
    if (!location.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);

    // Simulate API call
    setTimeout(() => {
      const mockData = {
        ...mockWeatherData,
        location: location || "New York, NY"
      };
      setWeatherData(mockData);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const getWeatherIcon = (iconType: string) => {
    switch (iconType) {
      case 'sunny':
        return <Sun className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />;
      case 'partly-cloudy':
        return <Cloud className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />;
      case 'cloudy':
        return <Cloud className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />;
      case 'rainy':
        return <CloudRain className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />;
      default:
        return <Sun className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />;
    }
  };

  // Load default weather on component mount
  useEffect(() => {
    setWeatherData(mockWeatherData);
  }, []);

  return (
    <section className="py-8 sm:py-12 lg:py-16 xl:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black mb-3 sm:mb-4 lg:mb-6 text-black">
            WEATHER FORECAST
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-4">
            Check the weather forecast to plan your perfect tennis match. Don't let the weather catch you off guard!
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                type="text" 
                placeholder="Enter city name" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                onKeyPress={handleKeyPress}
                className="pl-10 bg-white border-gray-300 focus:border-black h-11 sm:h-12 text-sm sm:text-base" 
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading} 
              className="bg-black hover:bg-gray-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 h-11 sm:h-12 font-semibold text-sm sm:text-base"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  <span className="hidden xs:inline">SEARCH</span>
                  <span className="xs:hidden">GO</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {weatherData && (
          <div className="space-y-6 lg:space-y-8">
            {/* Weather Cards - Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Current Weather */}
              <Card className="lg:col-span-1 border-2 border-gray-200 shadow-lg">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-black text-black">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="truncate">{weatherData.location}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      {getWeatherIcon(weatherData.current.icon)}
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-black mb-1">
                      {weatherData.current.temp}°F
                    </div>
                    <div className="text-gray-600 mb-4 font-medium text-sm sm:text-base">
                      {weatherData.current.condition}
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium">
                          <Wind className="w-3 h-3 sm:w-4 sm:h-4" />
                          Wind
                        </span>
                        <span className="font-semibold">{weatherData.current.windSpeed} mph</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium">
                          <Thermometer className="w-3 h-3 sm:w-4 sm:h-4" />
                          Humidity
                        </span>
                        <span className="font-semibold">{weatherData.current.humidity}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5-Day Forecast */}
              <div className="lg:col-span-2">
                <Card className="border-2 border-gray-200 shadow-lg">
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-lg sm:text-xl font-black text-black">5-DAY FORECAST</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="relative">
                      {/* Navigation Buttons */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50 backdrop-blur-sm h-8 w-8"
                        onClick={scrollLeft}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50 backdrop-blur-sm h-8 w-8"
                        onClick={scrollRight}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>

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
                        {weatherData.forecast.map((day, index) => (
                          <div 
                            key={index} 
                            className="flex-shrink-0 w-32 text-center p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                            style={{ scrollSnapAlign: 'start' }}
                          >
                            <div className="font-bold text-sm mb-3 text-black uppercase">{day.date}</div>
                            <div className="flex justify-center mb-3">
                              {getWeatherIcon(day.icon)}
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="font-black text-black text-lg">{day.high}°</div>
                              <div className="text-gray-500 font-semibold">{day.low}°</div>
                            </div>
                            <div className="text-xs text-gray-600 mt-2 font-medium leading-tight">
                              {day.condition}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Scroll Indicator */}
                      <div className="flex justify-center mt-4 gap-1">
                        {Array.from({ length: Math.ceil(weatherData.forecast.length / 3) }).map((_, index) => (
                          <div 
                            key={index} 
                            className="w-2 h-2 rounded-full bg-gray-300"
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Tennis Weather Tips */}
        <div className="mt-6 sm:mt-8 lg:mt-12">
          <Card className="bg-black text-white shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-black mb-4 text-center">TENNIS WEATHER TIPS</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div className="text-center p-3 rounded-lg">
                  <div className="flex justify-center mb-2">
                    <Sun className="w-8 h-8 text-yellow-400" />
                  </div>
                  <strong className="block mb-1 text-sm sm:text-base">SUNNY DAYS</strong>
                  <span className="leading-relaxed">Perfect for tennis! Stay hydrated and wear sunscreen.</span>
                </div>
                <div className="text-center p-3 rounded-lg">
                  <div className="flex justify-center mb-2">
                    <Cloud className="w-8 h-8 text-gray-300" />
                  </div>
                  <strong className="block mb-1 text-sm sm:text-base">PARTLY CLOUDY</strong>
                  <span className="leading-relaxed">Ideal conditions with comfortable temperatures.</span>
                </div>
                <div className="text-center p-3 rounded-lg">
                  <div className="flex justify-center mb-2">
                    <CloudRain className="w-8 h-8 text-blue-400" />
                  </div>
                  <strong className="block mb-1 text-sm sm:text-base">RAINY DAYS</strong>
                  <span className="leading-relaxed">Consider indoor courts or reschedule your match.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default WeatherForecast;
