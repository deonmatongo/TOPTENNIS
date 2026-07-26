import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin, Search, Cloud, Sun, CloudRain, Wind,
  Thermometer, ChevronLeft, ChevronRight, CloudSnow, Zap, AlertCircle, Loader2,
} from "lucide-react";

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

function wmoToCategory(code: number): WmoCategory {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'partly-cloudy';
  if (code <= 48) return 'cloudy';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rainy';
  if (code <= 77 || code === 85 || code === 86) return 'snowy';
  return 'stormy';
}

function wmoToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain Showers';
  if (code <= 86) return 'Snow Showers';
  return 'Thunderstorm';
}

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
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: '6',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather request failed');
  const data = await res.json();
  const c = data.current;
  const d = data.daily;
  const forecast: WeatherData['forecast'] = d.time.slice(0, 5).map((isoDate: string, i: number) => {
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    return { date: label, high: Math.round(d.temperature_2m_max[i]), low: Math.round(d.temperature_2m_min[i]), condition: wmoToLabel(d.weather_code[i]), icon: wmoToCategory(d.weather_code[i]) };
  });
  return { temp: Math.round(c.temperature_2m), condition: wmoToLabel(c.weather_code), humidity: c.relative_humidity_2m, windSpeed: Math.round(c.wind_speed_10m), icon: wmoToCategory(c.weather_code), forecast };
}

function WeatherIcon({ type, className = "w-8 h-8" }: { type: WmoCategory; className?: string }) {
  switch (type) {
    case 'sunny': return <Sun className={`${className} text-yellow-400`} />;
    case 'partly-cloudy': return <Cloud className={`${className} text-slate-300`} />;
    case 'cloudy': return <Cloud className={`${className} text-slate-400`} />;
    case 'rainy': return <CloudRain className={`${className} text-blue-400`} />;
    case 'snowy': return <CloudSnow className={`${className} text-blue-300`} />;
    case 'stormy': return <Zap className={`${className} text-yellow-400`} />;
  }
}

const playTip = (icon: WmoCategory) => {
  switch (icon) {
    case 'sunny': return { text: "Great day to play!", color: "text-yellow-400" };
    case 'partly-cloudy': return { text: "Ideal conditions.", color: "text-green-400" };
    case 'cloudy': return { text: "Comfortable for play.", color: "text-slate-300" };
    case 'rainy': return { text: "Consider indoor courts.", color: "text-blue-400" };
    case 'snowy': return { text: "Courts likely closed.", color: "text-indigo-400" };
    case 'stormy': return { text: "Do not play outdoors.", color: "text-red-400" };
  }
};

const WeatherForecast = () => {
  const [query, setQuery] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const search = async (cityName: string) => {
    if (!cityName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const geo = await geocodeCity(cityName);
      const wx = await fetchWeather(geo.latitude, geo.longitude);
      setWeatherData({ location: [geo.name, geo.admin1, geo.country].filter(Boolean).join(', '), current: { temp: wx.temp, condition: wx.condition, humidity: wx.humidity, windSpeed: wx.windSpeed, icon: wx.icon }, forecast: wx.forecast });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { search('New York'); }, []);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); search(query); };
  const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });

  const tip = weatherData ? playTip(weatherData.current.icon) : null;

  return (
    <section className="py-16 sm:py-20 lg:py-28" style={{ backgroundColor: "#0B1526" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3"
              style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}
            >
              Court Conditions
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              Weather Forecast
            </h2>
            <p className="mt-3 text-base max-w-md leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Check before you head out — plan your match around the forecast.
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSubmit} className="flex gap-2 w-full sm:w-auto max-w-xs">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                type="text"
                placeholder="City name"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl text-white placeholder:text-white/30 focus:border-orange-500/60"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
            <Button type="submit" disabled={isLoading} size="sm" className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </form>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-6 text-sm text-red-400 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {weatherData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Current conditions */}
            <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                <MapPin className="w-4 h-4 text-orange-400" />
                <span className="truncate font-medium">{weatherData.location}</span>
              </div>

              <div className="flex items-center gap-5">
                <WeatherIcon type={weatherData.current.icon} className="w-14 h-14" />
                <div>
                  <div className="text-5xl font-black text-white leading-none">
                    {weatherData.current.temp}°
                  </div>
                  <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{weatherData.current.condition}</div>
                </div>
              </div>

              {tip && (
                <div className={`text-sm font-semibold ${tip.color} rounded-xl px-4 py-2.5`} style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  {tip.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-orange-400" />
                  <span>{weatherData.current.windSpeed} mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span>{weatherData.current.humidity}% humid</span>
                </div>
              </div>
            </div>

            {/* 5-day forecast */}
            <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>5-Day Forecast</h3>
                <div className="flex gap-1">
                  <button onClick={scrollLeft} className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors" style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }} onMouseOver={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")} onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={scrollRight} className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors" style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }} onMouseOver={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")} onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {weatherData.forecast.map((day, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-28 flex flex-col items-center gap-2 rounded-xl p-3 transition-colors"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.10)")}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>{day.date}</span>
                    <WeatherIcon type={day.icon} className="w-8 h-8" />
                    <div className="text-center">
                      <div className="text-lg font-black text-white leading-none">{day.high}°</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{day.low}°</div>
                    </div>
                    <span className="text-[10px] text-center leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{day.condition}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default WeatherForecast;
