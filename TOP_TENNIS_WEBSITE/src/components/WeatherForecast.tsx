import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin, Search, Cloud, Sun, CloudRain, Wind,
  Thermometer, ChevronLeft, ChevronRight, CloudSnow, Zap, AlertCircle, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherData {
  location: string;
  current: {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    icon: WmoCategory;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: WmoCategory;
  }>;
}

type WmoCategory = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';

// ─── WMO weather code helpers ─────────────────────────────────────────────────
// Full reference: https://open-meteo.com/en/docs#weathervariables

function wmoToCategory(code: number): WmoCategory {
  if (code === 0)                             return 'sunny';
  if (code <= 3)                              return 'partly-cloudy';
  if (code <= 48)                             return 'cloudy';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rainy';
  if (code <= 77 || code === 85 || code === 86) return 'snowy';
  return 'stormy'; // 95, 96, 99
}

function wmoToLabel(code: number): string {
  if (code === 0)              return 'Clear Sky';
  if (code === 1)              return 'Mostly Clear';
  if (code === 2)              return 'Partly Cloudy';
  if (code === 3)              return 'Overcast';
  if (code <= 48)              return 'Foggy';
  if (code <= 55)              return 'Drizzle';
  if (code <= 67)              return 'Rain';
  if (code <= 77)              return 'Snow';
  if (code <= 82)              return 'Rain Showers';
  if (code <= 86)              return 'Snow Showers';
  return 'Thunderstorm';
}

// ─── Open-Meteo fetch helpers ─────────────────────────────────────────────────

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

async function geocodeCity(city: string): Promise<GeoResult> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  if (!data.results?.length) throw new Error(`No results found for "${city}"`);
  return data.results[0] as GeoResult;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData['current'] & { forecast: WeatherData['forecast'] }> {
  const params = new URLSearchParams({
    latitude:          String(lat),
    longitude:         String(lon),
    current:           'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily:             'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days:     '6',
    temperature_unit:  'fahrenheit',
    wind_speed_unit:   'mph',
    timezone:          'auto',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather request failed');
  const data = await res.json();

  const c = data.current;
  const d = data.daily;

  const forecast: WeatherData['forecast'] = d.time.slice(0, 5).map((isoDate: string, i: number) => {
    const label = i === 0 ? 'Today'
                : i === 1 ? 'Tomorrow'
                : new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    return {
      date:      label,
      high:      Math.round(d.temperature_2m_max[i]),
      low:       Math.round(d.temperature_2m_min[i]),
      condition: wmoToLabel(d.weather_code[i]),
      icon:      wmoToCategory(d.weather_code[i]),
    };
  });

  return {
    temp:      Math.round(c.temperature_2m),
    condition: wmoToLabel(c.weather_code),
    humidity:  c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
    icon:      wmoToCategory(c.weather_code),
    forecast,
  };
}

// ─── Icon component ───────────────────────────────────────────────────────────

function WeatherIcon({ type, className = "w-6 h-6 sm:w-8 sm:h-8" }: { type: WmoCategory; className?: string }) {
  switch (type) {
    case 'sunny':        return <Sun       className={`${className} text-yellow-500`} />;
    case 'partly-cloudy':return <Cloud     className={`${className} text-gray-400`} />;
    case 'cloudy':       return <Cloud     className={`${className} text-gray-500`} />;
    case 'rainy':        return <CloudRain className={`${className} text-blue-500`} />;
    case 'snowy':        return <CloudSnow className={`${className} text-blue-300`} />;
    case 'stormy':       return <Zap       className={`${className} text-yellow-600`} />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

const WeatherForecast = () => {
  const [query,       setQuery]       = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const scrollContainerRef            = useRef<HTMLDivElement>(null);

  const search = async (cityName: string) => {
    if (!cityName.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const geo = await geocodeCity(cityName);
      const wx  = await fetchWeather(geo.latitude, geo.longitude);

      const locationLabel = [geo.name, geo.admin1, geo.country]
        .filter(Boolean).join(', ');

      setWeatherData({
        location: locationLabel,
        current:  { temp: wx.temp, condition: wx.condition, humidity: wx.humidity, windSpeed: wx.windSpeed, icon: wx.icon },
        forecast: wx.forecast,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { search('New York'); }, []);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); search(query); };

  const scrollLeft  = () => scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left:  300, behavior: 'smooth' });

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

        {/* Search */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Enter city name"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300 focus:border-black h-11 sm:h-12 text-sm sm:text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-black hover:bg-gray-800 text-white px-4 sm:px-6 h-11 sm:h-12 font-semibold text-sm sm:text-base"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Search className="w-4 h-4 mr-2" />SEARCH</>
              }
            </Button>
          </form>

          {error && (
            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {weatherData && (
          <div className="space-y-6 lg:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">

              {/* Current conditions */}
              <Card className="lg:col-span-1 border-2 border-gray-200 shadow-lg">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-black text-black">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span className="truncate">{weatherData.location}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <WeatherIcon type={weatherData.current.icon} />
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
                          <Wind className="w-3 h-3 sm:w-4 sm:h-4" />Wind
                        </span>
                        <span className="font-semibold">{weatherData.current.windSpeed} mph</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium">
                          <Thermometer className="w-3 h-3 sm:w-4 sm:h-4" />Humidity
                        </span>
                        <span className="font-semibold">{weatherData.current.humidity}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5-day forecast */}
              <div className="lg:col-span-2">
                <Card className="border-2 border-gray-200 shadow-lg">
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-lg sm:text-xl font-black text-black">5-DAY FORECAST</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="relative">
                      <Button variant="outline" size="icon"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 border-gray-200 h-8 w-8"
                        onClick={scrollLeft}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 border-gray-200 h-8 w-8"
                        onClick={scrollRight}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>

                      <div
                        ref={scrollContainerRef}
                        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 px-10"
                        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {weatherData.forecast.map((day, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 w-32 text-center p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                            style={{ scrollSnapAlign: 'start' }}
                          >
                            <div className="font-bold text-sm mb-3 text-black uppercase">{day.date}</div>
                            <div className="flex justify-center mb-3">
                              <WeatherIcon type={day.icon} />
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
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Tennis weather tips */}
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
