import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Phone, Star, Wifi, Car, Coffee } from "lucide-react";

const Courts = () => {
  const courts = [
    {
      id: 1,
      name: "Downtown Tennis Center",
      address: "123 Main Street, Downtown",
      phone: "(555) 123-4567",
      rating: 4.8,
      courts: 8,
      surface: "Hard Court",
      lighting: "LED Floodlights",
      hours: "6:00 AM - 10:00 PM",
      price: "$25/hour",
      amenities: ["Parking", "Pro Shop", "Locker Rooms", "WiFi"],
      image: "/placeholder.svg",
      featured: true
    },
    {
      id: 2,
      name: "Riverside Courts",
      address: "456 River Road, Riverside",
      phone: "(555) 234-5678", 
      rating: 4.6,
      courts: 6,
      surface: "Clay Court",
      lighting: "Natural Light",
      hours: "7:00 AM - 8:00 PM",
      price: "$30/hour",
      amenities: ["Parking", "Restrooms", "Water Fountains"],
      image: "/placeholder.svg",
      featured: false
    },
    {
      id: 3,
      name: "City Park Tennis Complex",
      address: "789 Park Avenue, Midtown",
      phone: "(555) 345-6789",
      rating: 4.7,
      courts: 12,
      surface: "Hard Court",
      lighting: "LED Floodlights",
      hours: "5:30 AM - 11:00 PM",
      price: "$20/hour",
      amenities: ["Parking", "Café", "Equipment Rental", "WiFi", "Showers"],
      image: "/placeholder.svg",
      featured: true
    },
    {
      id: 4,
      name: "Tennis Academy",
      address: "321 Sports Drive, Westside",
      phone: "(555) 456-7890",
      rating: 4.9,
      courts: 10,
      surface: "Hard Court",
      lighting: "Premium LED",
      hours: "6:00 AM - 9:00 PM",
      price: "$35/hour",
      amenities: ["Parking", "Pro Shop", "Coaching", "Locker Rooms", "Café"],
      image: "/placeholder.svg",
      featured: true
    },
    {
      id: 5,
      name: "Community Sports Center",
      address: "654 Community Blvd, Eastside",
      phone: "(555) 567-8901",
      rating: 4.4,
      courts: 4,
      surface: "Hard Court",
      lighting: "Standard Lights",
      hours: "8:00 AM - 6:00 PM",
      price: "$15/hour",
      amenities: ["Parking", "Restrooms"],
      image: "/placeholder.svg",
      featured: false
    },
    {
      id: 6,
      name: "Youth Tennis Academy",
      address: "987 Youth Lane, Southside",
      phone: "(555) 678-9012",
      rating: 4.5,
      courts: 6,
      surface: "Hard Court",
      lighting: "LED Floodlights",
      hours: "7:00 AM - 7:00 PM",
      price: "$18/hour",
      amenities: ["Parking", "Youth Programs", "Equipment Rental"],
      image: "/placeholder.svg",
      featured: false
    }
  ];

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case "parking":
        return <Car className="h-4 w-4" />;
      case "wifi":
        return <Wifi className="h-4 w-4" />;
      case "café":
      case "cafe":
        return <Coffee className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const featuredCourts = courts.filter(court => court.featured);
  const regularCourts = courts.filter(court => !court.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white overflow-x-hidden">
      <Header />
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-24">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">Tennis Court Locator</h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Find the perfect tennis courts in your area. Premium facilities with top-quality surfaces and amenities.
          </p>
        </div>

        {/* Featured Courts */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Courts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCourts.map((court) => (
              <Card key={court.id} className="hover:shadow-lg transition-shadow duration-300 border-orange-200">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge className="bg-orange-100 text-orange-800">
                      Featured
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{court.rating}</span>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{court.name}</CardTitle>
                  <CardDescription className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{court.address}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Courts:</span> {court.courts}
                    </div>
                    <div>
                      <span className="font-medium">Surface:</span> {court.surface}
                    </div>
                    <div>
                      <span className="font-medium">Lighting:</span> {court.lighting}
                    </div>
                    <div>
                      <span className="font-medium">Price:</span> {court.price}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 text-sm">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span>{court.hours}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-sm">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>{court.phone}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Amenities:</div>
                    <div className="flex flex-wrap gap-2">
                      {court.amenities.map((amenity, index) => (
                        <div key={index} className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full text-xs">
                          {getAmenityIcon(amenity)}
                          <span>{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                      Book Now
                    </Button>
                    <Button variant="outline" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* All Courts */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">All Courts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularCourts.map((court) => (
              <Card key={court.id} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary">
                      {court.courts} Courts
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{court.rating}</span>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{court.name}</CardTitle>
                  <CardDescription className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{court.address}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Surface:</span> {court.surface}
                    </div>
                    <div>
                      <span className="font-medium">Price:</span> {court.price}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 text-sm">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span>{court.hours}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-sm">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>{court.phone}</span>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                      Book Now
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Court Locations</h2>
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Interactive map coming soon</p>
            <p className="text-sm text-gray-500 mt-2">
              View all court locations on an interactive map with directions and real-time availability
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Courts;