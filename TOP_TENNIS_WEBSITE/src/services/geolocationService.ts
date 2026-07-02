
interface Coordinates {
  lat: number;
  lng: number;
}

interface GeolocationResult {
  coordinates: Coordinates;
  city: string;
  state: string;
}

interface TennisCourt {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  distance?: string;
  numericDistance?: number;
}

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Remove duplicate courts based on proximity and name similarity
const deduplicateCourts = (courts: TennisCourt[]): TennisCourt[] => {
  const unique: TennisCourt[] = [];
  const PROXIMITY_THRESHOLD = 0.001; // ~100 meters in degrees

  for (const court of courts) {
    const isDuplicate = unique.some(existing => {
      const distance = Math.sqrt(
        Math.pow(court.lat - existing.lat, 2) + 
        Math.pow(court.lng - existing.lng, 2)
      );
      
      // Check if courts are very close (likely same location)
      if (distance < PROXIMITY_THRESHOLD) {
        return true;
      }
      
      // Check for similar names (case insensitive, ignore common words)
      const normalize = (name: string) => 
        name.toLowerCase()
          .replace(/tennis|court|courts|center|centre|park|club/g, '')
          .replace(/[^\w\s]/g, '')
          .trim();
      
      const courtName = normalize(court.name);
      const existingName = normalize(existing.name);
      
      if (courtName && existingName && courtName === existingName) {
        return true;
      }
      
      return false;
    });

    if (!isDuplicate) {
      unique.push(court);
    }
  }

  return unique;
};

// Get real tennis courts from OpenStreetMap using Overpass API
export const getNearbyTennisCourtsFree = async (lat: number, lng: number, radiusKm: number = 5): Promise<TennisCourt[]> => {
  const delta = radiusKm / 111; // Rough conversion from km to degrees
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
  
  const query = `[out:json][timeout:25];
    (
      node["leisure"="pitch"]["sport"="tennis"](${bbox});
      way["leisure"="pitch"]["sport"="tennis"](${bbox});
      relation["leisure"="pitch"]["sport"="tennis"](${bbox});
    );
    out center;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    
    const courts: TennisCourt[] = data.elements.map((element: any) => {
      const courtLat = element.lat || element.center?.lat;
      const courtLng = element.lon || element.center?.lon;
      
      if (!courtLat || !courtLng) return null;
      
      const distance = calculateDistance(lat, lng, courtLat, courtLng);
      
      return {
        id: element.id.toString(),
        name: element.tags?.name || element.tags?.operator || `Tennis Court #${element.id}`,
        lat: courtLat,
        lng: courtLng,
        address: element.tags?.['addr:full'] || 
                 `${element.tags?.['addr:street'] || ''} ${element.tags?.['addr:housenumber'] || ''}`.trim() ||
                 `${courtLat.toFixed(4)}, ${courtLng.toFixed(4)}`,
        distance: `${distance.toFixed(1)} miles`,
        numericDistance: distance,
        tags: element.tags || {}
      };
    }).filter(Boolean);

    // Remove duplicates and sort by distance
    const uniqueCourts = deduplicateCourts(courts);
    return uniqueCourts.sort((a, b) => (a.numericDistance || 0) - (b.numericDistance || 0));
  } catch (error) {
    console.error('Error fetching tennis courts from OpenStreetMap:', error);
    return [];
  }
};

// Get user's current location using browser geolocation with IP fallback
export const getCurrentLocation = async (): Promise<GeolocationResult | null> => {
  return new Promise((resolve) => {
    // Try browser geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          console.log("User Location (GPS):", lat, lng);
          
          // Try to get city/state from coordinates using reverse geocoding
          try {
            const response = await fetch(`https://ipapi.co/json/`);
            const data = await response.json();
            resolve({
              coordinates: { lat, lng },
              city: data.city || "Unknown",
              state: data.region_code || "Unknown"
            });
          } catch (error) {
            console.warn("Could not get location details:", error);
            resolve({
              coordinates: { lat, lng },
              city: "Unknown",
              state: "Unknown"
            });
          }
        },
        async (error) => {
          console.warn("Geolocation denied, using IP fallback...", error);
          
          // Fallback to IP-based location
          try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            if (data.latitude && data.longitude) {
              console.log("User Location (IP):", data.latitude, data.longitude);
              resolve({
                coordinates: { lat: data.latitude, lng: data.longitude },
                city: data.city || "Unknown",
                state: data.region_code || "Unknown"
              });
            } else {
              throw new Error("Invalid IP location data");
            }
          } catch (ipError) {
            console.error("IP fallback failed:", ipError);
            // Final fallback to NYC coordinates
            resolve({
              coordinates: { lat: 40.7831, lng: -73.9712 },
              city: "New York",
              state: "NY"
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      console.warn("Geolocation not supported, using IP fallback...");
      
      // Fallback to IP-based location using an IIFE async function
      (async () => {
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          
          if (data.latitude && data.longitude) {
            resolve({
              coordinates: { lat: data.latitude, lng: data.longitude },
              city: data.city || "Unknown",
              state: data.region_code || "Unknown"
            });
          } else {
            throw new Error("Invalid IP location data");
          }
        } catch (error) {
          console.error("IP fallback failed:", error);
          // Final fallback to NYC coordinates
          resolve({
            coordinates: { lat: 40.7831, lng: -73.9712 },
            city: "New York",
            state: "NY"
          });
        }
      })();
    }
  });
};

// Free zip code to coordinates using OpenStreetMap Nominatim
export const getLocationFromZipCode = async (zipCode: string): Promise<GeolocationResult | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${zipCode}&countrycodes=us&limit=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const displayName = result.display_name || '';
      const parts = displayName.split(',');
      
      return {
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        },
        city: parts[1]?.trim() || 'Unknown',
        state: parts[2]?.trim() || 'Unknown'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching location:', error);
    return null;
  }
};

// Legacy function for backward compatibility - now uses real data from OpenStreetMap
export const findNearbyTennisCourts = async (userLocation: Coordinates): Promise<TennisCourt[]> => {
  return await getNearbyTennisCourtsFree(userLocation.lat, userLocation.lng);
};
